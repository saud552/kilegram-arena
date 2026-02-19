// ============================================
// لوحة تحكم الأدمن - Kilegram Admin Dashboard
// ============================================

import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Users, Megaphone, Ban, Gift, Shield, Activity } from 'lucide-react';

interface PlayerProfile {
  id: string;
  user_id: string;
  username: string;
  level: number;
  xp: number;
  k_coins: number;
  k_gems: number;
  total_kills: number;
  total_wins: number;
  total_matches: number;
  is_banned: boolean;
  created_at: string;
}

interface GameEvent {
  id: string;
  title: string;
  content: string;
  event_type: string;
  is_active: boolean;
  created_at: string;
}

const AdminDashboard = () => {
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [players, setPlayers] = useState<PlayerProfile[]>([]);
  const [events, setEvents] = useState<GameEvent[]>([]);
  const [activeTab, setActiveTab] = useState<'players' | 'events' | 'stats'>('players');
  const [newEvent, setNewEvent] = useState({ title: '', content: '', event_type: 'news' });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAdminRole();
  }, []);

  const checkAdminRole = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate('/');
      return;
    }

    const { data: roles } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id);

    const hasAdmin = roles?.some(r => r.role === 'admin');
    if (!hasAdmin) {
      navigate('/');
      return;
    }

    setIsAdmin(true);
    loadData();
  };

  const loadData = async () => {
    setLoading(true);
    const [profilesRes, eventsRes] = await Promise.all([
      supabase.from('profiles').select('*').order('created_at', { ascending: false }),
      supabase.from('game_events').select('*').order('created_at', { ascending: false }),
    ]);

    if (profilesRes.data) setPlayers(profilesRes.data);
    if (eventsRes.data) setEvents(eventsRes.data);
    setLoading(false);
  };

  const toggleBan = async (userId: string, currentlyBanned: boolean) => {
    await supabase
      .from('profiles')
      .update({ is_banned: !currentlyBanned })
      .eq('user_id', userId);
    loadData();
  };

  const grantCoins = async (userId: string, amount: number) => {
    const player = players.find(p => p.user_id === userId);
    if (!player) return;
    await supabase
      .from('profiles')
      .update({ k_coins: player.k_coins + amount })
      .eq('user_id', userId);
    loadData();
  };

  const publishEvent = async () => {
    if (!newEvent.title || !newEvent.content) return;
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from('game_events').insert({
      title: newEvent.title,
      content: newEvent.content,
      event_type: newEvent.event_type,
      created_by: user?.id,
    });
    setNewEvent({ title: '', content: '', event_type: 'news' });
    loadData();
  };

  const toggleEventActive = async (eventId: string, isActive: boolean) => {
    await supabase
      .from('game_events')
      .update({ is_active: !isActive })
      .eq('id', eventId);
    loadData();
  };

  if (isAdmin === null || loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-cyan-400 animate-pulse text-lg">جاري التحقق من الصلاحيات...</div>
      </div>
    );
  }

  const totalPlayers = players.length;
  const bannedPlayers = players.filter(p => p.is_banned).length;
  const totalKills = players.reduce((sum, p) => sum + p.total_kills, 0);
  const totalMatches = players.reduce((sum, p) => sum + p.total_matches, 0);

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Header */}
      <div className="bg-slate-900 border-b border-cyan-500/20 p-4 flex items-center gap-3">
        <button onClick={() => navigate('/')} className="p-2 rounded-lg bg-white/5">
          <ArrowLeft size={20} />
        </button>
        <Shield className="text-cyan-400" size={24} />
        <h1 className="text-xl font-bold text-cyan-400">لوحة تحكم الأدمن</h1>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 gap-3 p-4">
        <div className="bg-slate-800 rounded-xl p-4 border border-cyan-500/20">
          <Users size={20} className="text-cyan-400 mb-1" />
          <div className="text-2xl font-bold">{totalPlayers}</div>
          <div className="text-xs text-gray-400">إجمالي اللاعبين</div>
        </div>
        <div className="bg-slate-800 rounded-xl p-4 border border-red-500/20">
          <Ban size={20} className="text-red-400 mb-1" />
          <div className="text-2xl font-bold">{bannedPlayers}</div>
          <div className="text-xs text-gray-400">محظورون</div>
        </div>
        <div className="bg-slate-800 rounded-xl p-4 border border-yellow-500/20">
          <Activity size={20} className="text-yellow-400 mb-1" />
          <div className="text-2xl font-bold">{totalMatches}</div>
          <div className="text-xs text-gray-400">مباريات</div>
        </div>
        <div className="bg-slate-800 rounded-xl p-4 border border-red-500/20">
          <div className="text-red-400 mb-1">💀</div>
          <div className="text-2xl font-bold">{totalKills}</div>
          <div className="text-xs text-gray-400">إجمالي القتلى</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 px-4 mb-4">
        {(['players', 'events', 'stats'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-2 rounded-lg text-sm font-semibold transition ${
              activeTab === tab
                ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/40'
                : 'bg-white/5 text-gray-400'
            }`}
          >
            {tab === 'players' ? 'اللاعبون' : tab === 'events' ? 'الأحداث' : 'إحصائيات'}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="px-4 pb-20">
        {activeTab === 'players' && (
          <div className="space-y-3">
            {players.map(player => (
              <div key={player.id} className={`bg-slate-800 rounded-xl p-4 border ${player.is_banned ? 'border-red-500/40' : 'border-white/10'}`}>
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <span className="font-bold">{player.username}</span>
                    <span className="text-xs text-gray-400 ml-2">Lv.{player.level}</span>
                    {player.is_banned && <span className="text-xs text-red-400 ml-2">🚫 محظور</span>}
                  </div>
                  <div className="text-xs text-gray-400">
                    💰 {player.k_coins} | 💎 {player.k_gems}
                  </div>
                </div>
                <div className="text-xs text-gray-400 mb-3">
                  ⚔️ {player.total_kills} قتلى | 🏆 {player.total_wins} فوز | 🎮 {player.total_matches} مباراة
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => toggleBan(player.user_id, player.is_banned)}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-semibold ${
                      player.is_banned ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                    }`}
                  >
                    {player.is_banned ? 'إلغاء الحظر' : 'حظر'}
                  </button>
                  <button
                    onClick={() => grantCoins(player.user_id, 100)}
                    className="flex-1 py-1.5 rounded-lg text-xs font-semibold bg-yellow-500/20 text-yellow-400"
                  >
                    <Gift size={12} className="inline mr-1" />
                    +100 عملة
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'events' && (
          <div className="space-y-4">
            {/* New Event Form */}
            <div className="bg-slate-800 rounded-xl p-4 border border-cyan-500/20">
              <h3 className="font-bold text-cyan-400 mb-3 flex items-center gap-2">
                <Megaphone size={16} />
                نشر حدث جديد
              </h3>
              <input
                value={newEvent.title}
                onChange={e => setNewEvent(prev => ({ ...prev, title: e.target.value }))}
                placeholder="عنوان الحدث"
                className="w-full bg-slate-700 rounded-lg p-2 mb-2 text-sm text-white placeholder-gray-400 border border-white/10"
              />
              <textarea
                value={newEvent.content}
                onChange={e => setNewEvent(prev => ({ ...prev, content: e.target.value }))}
                placeholder="محتوى الحدث"
                rows={3}
                className="w-full bg-slate-700 rounded-lg p-2 mb-2 text-sm text-white placeholder-gray-400 border border-white/10 resize-none"
              />
              <select
                value={newEvent.event_type}
                onChange={e => setNewEvent(prev => ({ ...prev, event_type: e.target.value }))}
                className="w-full bg-slate-700 rounded-lg p-2 mb-3 text-sm text-white border border-white/10"
              >
                <option value="news">📰 خبر</option>
                <option value="update">🔄 تحديث</option>
                <option value="event">🎉 فعالية</option>
                <option value="maintenance">🔧 صيانة</option>
              </select>
              <button
                onClick={publishEvent}
                className="w-full py-2 bg-cyan-500/20 text-cyan-400 rounded-lg font-semibold border border-cyan-500/40"
              >
                نشر الحدث
              </button>
            </div>

            {/* Existing Events */}
            {events.map(event => (
              <div key={event.id} className={`bg-slate-800 rounded-xl p-4 border ${event.is_active ? 'border-green-500/20' : 'border-gray-500/20'}`}>
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-sm">{event.title}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${event.is_active ? 'bg-green-500/20 text-green-400' : 'bg-gray-500/20 text-gray-400'}`}>
                    {event.is_active ? 'نشط' : 'معطل'}
                  </span>
                </div>
                <p className="text-xs text-gray-400 mb-2">{event.content}</p>
                <button
                  onClick={() => toggleEventActive(event.id, event.is_active)}
                  className="text-xs text-cyan-400 underline"
                >
                  {event.is_active ? 'تعطيل' : 'تفعيل'}
                </button>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'stats' && (
          <div className="space-y-4">
            <div className="bg-slate-800 rounded-xl p-4 border border-white/10">
              <h3 className="font-bold mb-3">توزيع المستويات</h3>
              <div className="space-y-2">
                {Array.from({ length: 5 }, (_, i) => i + 1).map(level => {
                  const count = players.filter(p => p.level === level).length;
                  const pct = totalPlayers > 0 ? (count / totalPlayers) * 100 : 0;
                  return (
                    <div key={level} className="flex items-center gap-2">
                      <span className="text-xs w-12 text-gray-400">Lv.{level}</span>
                      <div className="flex-1 bg-slate-700 rounded-full h-3">
                        <div
                          className="bg-cyan-500 h-3 rounded-full transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="text-xs text-gray-400 w-8">{count}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="bg-slate-800 rounded-xl p-4 border border-white/10">
              <h3 className="font-bold mb-3">أعلى 5 لاعبين</h3>
              <div className="space-y-2">
                {players
                  .sort((a, b) => b.total_kills - a.total_kills)
                  .slice(0, 5)
                  .map((p, i) => (
                    <div key={p.id} className="flex items-center justify-between text-sm">
                      <span>
                        {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`}{' '}
                        {p.username}
                      </span>
                      <span className="text-gray-400">💀 {p.total_kills}</span>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminDashboard;
