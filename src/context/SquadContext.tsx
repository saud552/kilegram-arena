// ============================================
// ملف: src/context/SquadContext.tsx
// الوظيفة: إدارة السكواد مع دعم تقسيم اللاعبين إلى فريقين (أزرق/أحمر)
// ============================================

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { useAuth } from './AuthContext'
import { RealtimeChannel } from '@supabase/supabase-js'

export type Team = 'blue' | 'red'

export interface SquadMember {
  user_id: string
  joined_at: string
  team?: Team // الفريق الذي ينتمي إليه العضو
}

export interface Squad {
  id: string
  creator_id: string
  squad_code: string
  status: 'waiting' | 'in-game'
  max_players: number
  members: SquadMember[]
  // عند بدء اللعبة، سنقسم الأعضاء إلى فريقين
  teams?: {
    blue: string[]  // قائمة user_ids
    red: string[]
  }
}

interface SquadContextType {
  currentSquad: Squad | null
  loading: boolean
  createSquad: () => Promise<void>
  joinSquad: (code: string) => Promise<boolean>
  leaveSquad: () => Promise<void>
  startGame: () => Promise<void>
  refreshSquad: () => Promise<void>
}

const SquadContext = createContext<SquadContextType | undefined>(undefined)

export const SquadProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth()
  const [currentSquad, setCurrentSquad] = useState<Squad | null>(null)
  const [loading, setLoading] = useState(false)
  const [subscription, setSubscription] = useState<RealtimeChannel | null>(null)

  useEffect(() => {
    if (user) {
      checkExistingSquad()
    }
    return () => {
      if (subscription) subscription.unsubscribe()
    }
  }, [user])

  const checkExistingSquad = async () => {
    if (!user) return
    const { data: memberData, error } = await supabase
      .from('squad_members')
      .select('squad_id')
      .eq('user_id', user.id)
      .maybeSingle()

    if (error) {
      console.error('Error checking existing squad:', error)
      return
    }

    if (memberData) {
      await fetchSquadById(memberData.squad_id)
    }
  }

  const fetchSquadById = async (squadId: string) => {
    if (!user) return
    const { data: squad, error: squadError } = await supabase
      .from('squads')
      .select('*')
      .eq('id', squadId)
      .single()

    if (squadError || !squad) {
      console.error('Error fetching squad:', squadError)
      return
    }

    const { data: members, error: membersError } = await supabase
      .from('squad_members')
      .select('user_id, joined_at')
      .eq('squad_id', squadId)

    if (membersError) {
      console.error('Error fetching members:', membersError)
      return
    }

    // تحويل الأعضاء إلى الصيغة الجديدة (بدون فريق حتى الآن)
    const squadMembers: SquadMember[] = members.map(m => ({
      user_id: m.user_id,
      joined_at: m.joined_at,
    }))

    setCurrentSquad({ ...squad, status: squad.status as 'waiting' | 'in-game', members: squadMembers })
    subscribeToSquad(squadId)
  }

  const subscribeToSquad = (squadId: string) => {
    if (subscription) subscription.unsubscribe()

    const channel = supabase
      .channel(`squad:${squadId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'squad_members',
          filter: `squad_id=eq.${squadId}`,
        },
        async () => {
          await fetchSquadById(squadId)
        }
      )
      .subscribe()

    setSubscription(channel)
  }

  const createSquad = async () => {
    if (!user) return
    setLoading(true)
    try {
      const generateCode = () => {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ0123456789'
        let code = ''
        for (let i = 0; i < 6; i++) {
          code += chars[Math.floor(Math.random() * chars.length)]
        }
        return code
      }

      let squadCode = generateCode()
      let attempts = 0
      while (attempts < 5) {
        const { data: existing } = await supabase
          .from('squads')
          .select('id')
          .eq('squad_code', squadCode)
          .maybeSingle()
        if (!existing) break
        squadCode = generateCode()
        attempts++
      }

      const { data: squad, error: squadError } = await supabase
        .from('squads')
        .insert({
          creator_id: user.id,
          squad_code: squadCode,
          status: 'waiting',
          max_players: 4,
        })
        .select()
        .single()

      if (squadError) throw squadError

      const { error: memberError } = await supabase
        .from('squad_members')
        .insert({ squad_id: squad.id, user_id: user.id })

      if (memberError) throw memberError

      setCurrentSquad({
        ...squad,
        status: squad.status as 'waiting' | 'in-game',
        members: [{ user_id: user.id, joined_at: new Date().toISOString() }],
      })

      subscribeToSquad(squad.id)
    } catch (error) {
      console.error('Error creating squad:', error)
    } finally {
      setLoading(false)
    }
  }

  const joinSquad = async (code: string): Promise<boolean> => {
    if (!user) return false
    setLoading(true)
    try {
      const { data: squad, error: squadError } = await supabase
        .from('squads')
        .select('*')
        .eq('squad_code', code.toUpperCase())
        .eq('status', 'waiting')
        .single()

      if (squadError || !squad) {
        return false
      }

      const { count, error: countError } = await supabase
        .from('squad_members')
        .select('*', { count: 'exact', head: true })
        .eq('squad_id', squad.id)

      if (countError) throw countError
      if (count && count >= squad.max_players) {
        return false
      }

      const { data: existingMember } = await supabase
        .from('squad_members')
        .select('id')
        .eq('squad_id', squad.id)
        .eq('user_id', user.id)
        .maybeSingle()

      if (existingMember) {
        await fetchSquadById(squad.id)
        return true
      }

      const { error: memberError } = await supabase
        .from('squad_members')
        .insert({ squad_id: squad.id, user_id: user.id })

      if (memberError) throw memberError

      await fetchSquadById(squad.id)
      return true
    } catch (error) {
      console.error('Error joining squad:', error)
      return false
    } finally {
      setLoading(false)
    }
  }

  const leaveSquad = async () => {
    if (!user || !currentSquad) return
    setLoading(true)
    try {
      const { error } = await supabase
        .from('squad_members')
        .delete()
        .eq('squad_id', currentSquad.id)
        .eq('user_id', user.id)

      if (error) throw error

      setCurrentSquad(null)
      if (subscription) {
        subscription.unsubscribe()
        setSubscription(null)
      }
    } catch (error) {
      console.error('Error leaving squad:', error)
    } finally {
      setLoading(false)
    }
  }

  // دالة تقسيم اللاعبين إلى فريقين (تُستدعى عند بدء اللعبة)
  const assignTeams = (members: SquadMember[]): { blue: string[]; red: string[] } => {
    // خلط الأعضاء عشوائياً
    const shuffled = [...members].sort(() => 0.5 - Math.random())
    const half = Math.ceil(shuffled.length / 2)
    const blue = shuffled.slice(0, half).map(m => m.user_id)
    const red = shuffled.slice(half).map(m => m.user_id)
    return { blue, red }
  }

  const startGame = async () => {
    if (!currentSquad) return
    if (currentSquad.creator_id !== user?.id) {
      alert('Only the leader can start the game')
      return
    }
    if (currentSquad.members.length < currentSquad.max_players) {
      alert('Waiting for more players...')
      return
    }

    // تقسيم الأعضاء إلى فريقين
    const teams = assignTeams(currentSquad.members)

    // تحديث السكواد في قاعدة البيانات مع تعيين الفرق (يمكن إضافتها كحقل JSON)
    const { error } = await supabase
      .from('squads')
      .update({ 
        status: 'in-game',
        // يمكن إضافة حقل teams في جدول squads إذا أردت تخزينه، لكننا سنستخدم broadcast لنقل الفرق
      })
      .eq('id', currentSquad.id)

    if (error) {
      console.error('Error starting game:', error)
    } else {
      // تحديث الحالة المحلية
      setCurrentSquad({
        ...currentSquad,
        status: 'in-game',
        teams,
      })
      // إرسال حدث broadcast للاعبين الآخرين بأن اللعبة بدأت مع معلومات الفرق
      // (يمكن إرسالها عبر القناة)
      const channel = supabase.channel(`room_${currentSquad.squad_code}`)
      channel.send({
        type: 'broadcast',
        event: 'game_started',
        payload: { teams },
      })
      // لا نحتاج إلى التنقل هنا، سيتم التنقل من LobbyScreen
    }
  }

  const refreshSquad = async () => {
    if (currentSquad) {
      await fetchSquadById(currentSquad.id)
    }
  }

  return (
    <SquadContext.Provider
      value={{
        currentSquad,
        loading,
        createSquad,
        joinSquad,
        leaveSquad,
        startGame,
        refreshSquad,
      }}
    >
      {children}
    </SquadContext.Provider>
  )
}

export const useSquad = () => {
  const context = useContext(SquadContext)
  if (!context) throw new Error('useSquad must be used within SquadProvider')
  return context
}