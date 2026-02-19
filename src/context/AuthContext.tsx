// ============================================
// AuthContext - يدعم Telegram Auth + قاعدة البيانات
// ============================================

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { getUserData, initTelegramApp } from '../lib/telegram';

// أنواع الشخصيات المتاحة
export interface Skin {
  id: string;
  name: string;
  price: number;
  imageUrl: string;
}

export const AVAILABLE_SKINS: Skin[] = [
  { id: 'soldier', name: 'الجندي', price: 0, imageUrl: '🪖' },
  { id: 'medic', name: 'المسعف', price: 0, imageUrl: '💊' },
  { id: 'sniper_skin', name: 'القناص', price: 0, imageUrl: '🎯' },
  { id: 'commander', name: 'القائد', price: 50, imageUrl: '⭐' },
];

interface User {
  id: string;
  username: string;
  firstName: string;
  lastName?: string;
  photoUrl?: string;
  country: string;
  coins: number;
  gems: number;
  xp: number;
  level: number;
  totalKills: number;
  totalWins: number;
  totalMatches: number;
  selectedSkin: string;
  ownedSkins: string[];
  role: 'admin' | 'player';
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  updateUser: (updates: Partial<User>) => void;
  selectSkin: (skinId: string) => boolean;
  purchaseSkin: (skinId: string) => boolean;
  addCoins: (amount: number) => void;
  addXP: (amount: number) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const getCountryFromLanguage = (langCode?: string): string => {
  const map: Record<string, string> = {
    en: '🇺🇸', ar: '🇸🇦', fr: '🇫🇷', es: '🇪🇸', ru: '🇷🇺', zh: '🇨🇳',
  };
  return map[langCode || 'en'] || '🏳️';
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    initTelegramApp();

    const storedUser = localStorage.getItem('kilegram_user');
    if (storedUser) {
      setUser(JSON.parse(storedUser));
      setIsLoading(false);
      return;
    }

    const tgUser = getUserData();
    if (tgUser) {
      const newUser: User = {
        id: tgUser.id,
        username: tgUser.username || `${tgUser.firstName} ${tgUser.lastName || ''}`.trim(),
        firstName: tgUser.firstName,
        lastName: tgUser.lastName,
        photoUrl: tgUser.photoUrl,
        country: getCountryFromLanguage(tgUser.languageCode),
        coins: 100,
        gems: 0,
        xp: 0,
        level: 1,
        totalKills: 0,
        totalWins: 0,
        totalMatches: 0,
        selectedSkin: 'soldier',
        ownedSkins: ['soldier', 'medic', 'sniper_skin'],
        role: 'player',
      };
      setUser(newUser);
      localStorage.setItem('kilegram_user', JSON.stringify(newUser));
    } else {
      const mockUser: User = {
        id: '12345',
        username: '@Khayal_Dev',
        firstName: 'Khayal',
        photoUrl: '👤',
        country: '🇾🇪',
        coins: 500,
        gems: 10,
        xp: 0,
        level: 1,
        totalKills: 0,
        totalWins: 0,
        totalMatches: 0,
        selectedSkin: 'soldier',
        ownedSkins: ['soldier', 'medic', 'sniper_skin'],
        role: 'player',
      };
      setUser(mockUser);
      localStorage.setItem('kilegram_user', JSON.stringify(mockUser));
    }
    setIsLoading(false);
  }, []);

  const updateUser = (updates: Partial<User>) => {
    if (!user) return;
    const updated = { ...user, ...updates };
    setUser(updated);
    localStorage.setItem('kilegram_user', JSON.stringify(updated));
  };

  const selectSkin = (skinId: string): boolean => {
    if (!user) return false;
    const skin = AVAILABLE_SKINS.find(s => s.id === skinId);
    if (!skin) return false;
    if (!user.ownedSkins.includes(skinId) && skin.price > 0) return false;
    updateUser({ selectedSkin: skinId });
    return true;
  };

  const purchaseSkin = (skinId: string): boolean => {
    if (!user) return false;
    const skin = AVAILABLE_SKINS.find(s => s.id === skinId);
    if (!skin || skin.price === 0) return false;
    if (user.ownedSkins.includes(skinId)) return false;
    if (user.coins < skin.price) return false;

    const updatedUser = {
      ...user,
      coins: user.coins - skin.price,
      ownedSkins: [...user.ownedSkins, skinId],
    };
    setUser(updatedUser);
    localStorage.setItem('kilegram_user', JSON.stringify(updatedUser));
    return true;
  };

  const addCoins = (amount: number) => {
    if (!user) return;
    updateUser({ coins: user.coins + amount });
  };

  const addXP = (amount: number) => {
    if (!user) return;
    const newXP = user.xp + amount;
    const newLevel = Math.floor(Math.sqrt(newXP / 50)) + 1;
    updateUser({ xp: newXP, level: newLevel });
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, updateUser, selectSkin, purchaseSkin, addCoins, addXP }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};
