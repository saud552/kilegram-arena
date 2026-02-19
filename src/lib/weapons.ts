// ============================================
// نظام الأسلحة المتقدم - Kilegram Alpha
// ============================================

export type AmmoType = '5.56mm' | '9mm' | '.300mag' | '12gauge';

export interface WeaponConfig {
  id: string;
  name: string;
  nameAr: string;
  type: 'assault_rifle' | 'smg' | 'sniper' | 'shotgun';
  damage: number;
  fireRate: number; // ms between shots
  bulletSpeed: number;
  bulletRange: number; // max distance in pixels
  magazineSize: number;
  reloadTime: number; // ms
  ammoType: AmmoType;
  spread: number; // radians of spread (0 = perfectly accurate)
  pelletsPerShot: number; // for shotgun
  emoji: string;
  soundId: string;
}

export const WEAPONS: Record<string, WeaponConfig> = {
  m4_tech: {
    id: 'm4_tech',
    name: 'M4-Tech',
    nameAr: 'M4-تك',
    type: 'assault_rifle',
    damage: 12,
    fireRate: 120,
    bulletSpeed: 10,
    bulletRange: 500,
    magazineSize: 30,
    reloadTime: 2000,
    ammoType: '5.56mm',
    spread: 0.05,
    pelletsPerShot: 1,
    emoji: '🔫',
    soundId: 'ar_fire',
  },
  viper_smg: {
    id: 'viper_smg',
    name: 'Viper-9',
    nameAr: 'فايبر-9',
    type: 'smg',
    damage: 8,
    fireRate: 80,
    bulletSpeed: 9,
    bulletRange: 350,
    magazineSize: 35,
    reloadTime: 1500,
    ammoType: '9mm',
    spread: 0.08,
    pelletsPerShot: 1,
    emoji: '🔫',
    soundId: 'smg_fire',
  },
  awm_x: {
    id: 'awm_x',
    name: 'AWM-X',
    nameAr: 'AWM-إكس',
    type: 'sniper',
    damage: 55,
    fireRate: 1500,
    bulletSpeed: 16,
    bulletRange: 900,
    magazineSize: 5,
    reloadTime: 3500,
    ammoType: '.300mag',
    spread: 0.01,
    pelletsPerShot: 1,
    emoji: '🔭',
    soundId: 'sniper_fire',
  },
  thunder_sg: {
    id: 'thunder_sg',
    name: 'Thunder-12',
    nameAr: 'ثاندر-12',
    type: 'shotgun',
    damage: 15, // per pellet
    fireRate: 800,
    bulletSpeed: 8,
    bulletRange: 200,
    magazineSize: 6,
    reloadTime: 2500,
    ammoType: '12gauge',
    spread: 0.3,
    pelletsPerShot: 6,
    emoji: '🔫',
    soundId: 'shotgun_fire',
  },
};

export const DEFAULT_WEAPON = 'm4_tech';

// Ammo display names
export const AMMO_NAMES: Record<AmmoType, string> = {
  '5.56mm': '5.56mm',
  '9mm': '9mm',
  '.300mag': '.300 Magnum',
  '12gauge': '12 Gauge',
};

// Loot item types
export type LootType = 'ammo_556' | 'ammo_9mm' | 'ammo_300' | 'ammo_12g' | 'medkit' | 'armor' | 'weapon';

export interface LootItem {
  id: string;
  x: number;
  y: number;
  type: LootType;
  amount: number;
  weaponId?: string; // if type is 'weapon'
  radius: number;
  emoji: string;
}

export const LOOT_CONFIGS: Record<LootType, { emoji: string; amount: number; radius: number }> = {
  ammo_556: { emoji: '📦', amount: 30, radius: 12 },
  ammo_9mm: { emoji: '📦', amount: 35, radius: 12 },
  ammo_300: { emoji: '📦', amount: 5, radius: 12 },
  ammo_12g: { emoji: '📦', amount: 12, radius: 12 },
  medkit: { emoji: '💊', amount: 25, radius: 14 },
  armor: { emoji: '🛡️', amount: 50, radius: 14 },
  weapon: { emoji: '🔫', amount: 1, radius: 16 },
};

// Weapon state for a player
export interface WeaponState {
  currentWeapon: WeaponConfig;
  ammoInMag: number;
  reserveAmmo: Record<AmmoType, number>;
  isReloading: boolean;
  reloadStartTime: number;
  lastShotTime: number;
  skinLevel: number; // 1-5 cosmetic
}

export function createDefaultWeaponState(): WeaponState {
  return {
    currentWeapon: WEAPONS[DEFAULT_WEAPON],
    ammoInMag: WEAPONS[DEFAULT_WEAPON].magazineSize,
    reserveAmmo: {
      '5.56mm': 90,
      '9mm': 0,
      '.300mag': 0,
      '12gauge': 0,
    },
    isReloading: false,
    reloadStartTime: 0,
    lastShotTime: 0,
    skinLevel: 1,
  };
}

// XP calculation
export function calculateXP(kills: number, placement: number, survived: boolean): number {
  let xp = kills * 20;
  if (placement === 1) xp += 100;
  else if (placement <= 3) xp += 50;
  if (survived) xp += 10;
  return xp;
}

export function getLevelFromXP(xp: number): number {
  // Each level requires progressively more XP
  return Math.floor(Math.sqrt(xp / 50)) + 1;
}
