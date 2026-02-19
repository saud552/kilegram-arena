// ============================================
// ملف: src/components/LobbyScreen.tsx
// الوظيفة: شاشة غرفة الانتظار (السكواد) مع زر الدعوة المحسن
// ============================================

import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSquad } from '../context/SquadContext';
import { useAuth } from '../context/AuthContext';
import { motion } from 'framer-motion';
import { Copy, Users, Share2, ArrowLeft, Play } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { inviteFriend, showPopup, hapticImpact } from '../lib/telegram';

const LobbyScreen = () => {
  const { currentSquad, loading, leaveSquad } = useSquad();
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !currentSquad) {
      navigate('/');
    }
  }, [currentSquad, loading, navigate]);

  if (loading || !currentSquad) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-kilegram-blue animate-pulse">جاري تحميل السكواد...</div>
      </div>
    );
  }

  const isLeader = currentSquad.creator_id === user?.id;
  const members = currentSquad.members || [];
  const slots = Array.from({ length: currentSquad.max_players }, (_, i) => {
    const member = members[i];
    return member ? member.user_id : null;
  });

  const copyCode = () => {
    navigator.clipboard.writeText(currentSquad.squad_code);
    hapticImpact('light');
    showPopup('تم نسخ الكود!', 'نجاح');
  };

  const handleInvite = () => {
    hapticImpact('medium');
    inviteFriend(currentSquad.squad_code, 'KilegramBot'); // استبدل باسم البوت الخاص بك
  };

  const handleLeave = async () => {
    hapticImpact('heavy');
    await leaveSquad();
    navigate('/');
  };

  const startGame = async () => {
    if (!isLeader) return;
    if (members.length < currentSquad.max_players) {
      showPopup('يرجى انتظار اكتمال الفريق', 'لا يمكن البدء');
      return;
    }
    hapticImpact('medium');
    const { error } = await supabase
      .from('squads')
      .update({ status: 'in-game' })
      .eq('id', currentSquad.id);
    if (error) {
      console.error('Error starting game:', error);
      showPopup('حدث خطأ في بدء اللعبة', 'خطأ');
    } else {
      navigate('/arena');
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white pb-20">
      {/* رأس الصفحة */}
      <div className="flex items-center p-4 border-b border-white/10 bg-slate-900/50 backdrop-blur-sm">
        <button onClick={handleLeave} className="mr-3 text-gray-400 hover:text-white">
          <ArrowLeft size={24} />
        </button>
        <h1 className="text-xl font-bold text-kilegram-blue">غرفة الانتظار</h1>
      </div>

      {/* بطاقة الكود */}
      <div className="mx-4 mt-6 p-5 bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl border border-kilegram-blue/30 shadow-lg">
        <div className="flex justify-between items-center">
          <span className="text-gray-400 text-sm">كود الفريق</span>
          <button onClick={copyCode} className="flex items-center gap-1 text-kilegram-blue hover:text-kilegram-blue/80">
            <Copy size={16} />
            <span className="text-xs">نسخ</span>
          </button>
        </div>
        <div className="text-3xl font-mono font-bold tracking-wider text-white mt-1">
          {currentSquad.squad_code}
        </div>
      </div>

      {/* فتحات اللاعبين */}
      <div className="mx-4 mt-6">
        <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
          <Users size={20} className="text-kilegram-blue" />
          اللاعبين ({members.length}/{currentSquad.max_players})
        </h2>
        <div className="space-y-3">
          {slots.map((userId, index) => {
            const isFilled = !!userId;
            const isCurrentUser = userId === user?.id;
            return (
              <motion.div
                key={index}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
                className={`p-4 rounded-xl border-2 transition-all ${
                  isFilled
                    ? 'border-kilegram-blue bg-slate-800/50'
                    : 'border-dashed border-gray-600 bg-slate-900/50 animate-pulse'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                    isFilled ? 'bg-gradient-to-br from-kilegram-blue to-kill-red' : 'bg-gray-700'
                  }`}>
                    {isFilled ? (
                      <span className="text-white text-sm font-bold">
                        {isCurrentUser ? '👤' : '👥'}
                      </span>
                    ) : (
                      <span className="text-gray-400">?</span>
                    )}
                  </div>
                  <div>
                    {isFilled ? (
                      <div>
                        <span className="text-white font-medium">
                          {isCurrentUser ? `${user?.username} (أنت)` : `لاعب ${index + 1}`}
                        </span>
                        {index === 0 && <span className="mr-2 text-xs text-kilegram-blue">القائد</span>}
                      </div>
                    ) : (
                      <span className="text-gray-400">بانتظار لاعب...</span>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* زر الدعوة */}
      <div className="mx-4 mt-8">
        <button
          onClick={handleInvite}
          className="w-full py-4 bg-white/5 border border-white/10 rounded-xl text-white font-semibold flex items-center justify-center gap-2 hover:bg-white/10 transition"
        >
          <Share2 size={20} className="text-kilegram-blue" />
          دعوة صديق
        </button>
      </div>

      {/* زر بدء اللعبة (للقائد فقط) */}
      {isLeader && (
        <div className="mx-4 mt-4">
          <button
            onClick={startGame}
            className={`w-full py-4 rounded-xl font-bold flex items-center justify-center gap-2 transition ${
              members.length === currentSquad.max_players
                ? 'bg-gradient-to-r from-kilegram-blue to-kill-red text-white shadow-lg shadow-kilegram-blue/20'
                : 'bg-gray-700 text-gray-400 cursor-not-allowed'
            }`}
            disabled={members.length !== currentSquad.max_players}
          >
            <Play size={20} />
            بدء اللعبة
          </button>
          {members.length < currentSquad.max_players && (
            <p className="text-center text-sm text-gray-500 mt-2">
              انتظار {currentSquad.max_players - members.length} لاعبين آخرين...
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default LobbyScreen;