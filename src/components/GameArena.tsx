// ============================================
// GameArena - ساحة المعركة مع نظام أسلحة متقدم
// ============================================

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSquad } from '../context/SquadContext';
import { useAuth } from '../context/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { RealtimeChannel } from '@supabase/supabase-js';
import { ArrowLeft } from 'lucide-react';
import { hapticImpact } from '../lib/telegram';
import { soundManager } from '../lib/soundManager';
import {
  WEAPONS, WeaponState, createDefaultWeaponState,
  LootItem, LootType, LOOT_CONFIGS, AmmoType,
} from '../lib/weapons';

// Constants
const MAP_WIDTH = 2000;
const MAP_HEIGHT = 2000;
const PLAYER_RADIUS = 15;
const PLAYER_SPEED = 4;
const BULLET_SIZE = 4;
const GRID_SIZE = 50;
const GRID_COLOR = 'rgba(0, 166, 255, 0.15)';
const BROADCAST_INTERVAL = 50;
const REMOTE_TIMEOUT = 2000;
const ZONE_START_RADIUS = 800;
const ZONE_SHRINK_RATE = 50;
const ZONE_SHRINK_INTERVAL = 10000;
const ZONE_DAMAGE = 0.5;
const MIN_ZONE_RADIUS = 150;
const LOOT_SPAWN_COUNT = 30;

interface Vector2 { x: number; y: number }

interface Bullet {
  x: number; y: number;
  vx: number; vy: number;
  life: number;
  damage: number;
}

interface RemotePlayer {
  userId: string; username: string;
  x: number; y: number;
  targetX: number; targetY: number;
  rotation: number; health: number;
  lastUpdate: number;
  team?: 'blue' | 'red';
  skin?: string;
}

// Generate random loot items
function generateLoot(): LootItem[] {
  const types: LootType[] = ['ammo_556', 'ammo_9mm', 'ammo_300', 'ammo_12g', 'medkit', 'armor'];
  const weaponIds = Object.keys(WEAPONS);
  const items: LootItem[] = [];

  for (let i = 0; i < LOOT_SPAWN_COUNT; i++) {
    const isWeapon = Math.random() < 0.15;
    const type: LootType = isWeapon ? 'weapon' : types[Math.floor(Math.random() * types.length)];
    const config = LOOT_CONFIGS[type];
    items.push({
      id: `loot_${i}`,
      x: Math.random() * (MAP_WIDTH - 100) + 50,
      y: Math.random() * (MAP_HEIGHT - 100) + 50,
      type,
      amount: config.amount,
      weaponId: isWeapon ? weaponIds[Math.floor(Math.random() * weaponIds.length)] : undefined,
      radius: config.radius,
      emoji: isWeapon ? '🔫' : config.emoji,
    });
  }
  return items;
}

const GameArena = () => {
  const navigate = useNavigate();
  const { currentSquad, loading } = useSquad();
  const { user, addCoins, addXP } = useAuth();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<number>();
  const channelRef = useRef<RealtimeChannel | null>(null);
  const lastBroadcastTime = useRef<number>(0);

  // Player state
  const [playerPos, setPlayerPos] = useState<Vector2>({ x: MAP_WIDTH / 2, y: MAP_HEIGHT / 2 });
  const playerVel = useRef<Vector2>({ x: 0, y: 0 });
  const playerRotation = useRef<number>(0);
  const [localHealth, setLocalHealth] = useState(100);
  const [armor, setArmor] = useState(0);
  const [isDead, setIsDead] = useState(false);
  const bullets = useRef<Bullet[]>([]);
  const [kills, setKills] = useState(0);

  // Weapon state
  const weaponState = useRef<WeaponState>(createDefaultWeaponState());
  const [weaponDisplay, setWeaponDisplay] = useState({
    name: weaponState.current.currentWeapon.nameAr,
    ammoInMag: weaponState.current.ammoInMag,
    reserveAmmo: weaponState.current.reserveAmmo[weaponState.current.currentWeapon.ammoType],
    isReloading: false,
    reloadProgress: 0,
  });

  // Loot
  const lootItems = useRef<LootItem[]>(generateLoot());

  // Remote players
  const remotePlayersRef = useRef<Map<string, RemotePlayer>>(new Map());
  const [, forceUpdate] = useState({});

  // Teams & Zone
  const [myTeam, setMyTeam] = useState<'blue' | 'red'>('blue');
  const [zoneCenter] = useState<Vector2>({ x: MAP_WIDTH / 2, y: MAP_HEIGHT / 2 });
  const [zoneRadius, setZoneRadius] = useState(ZONE_START_RADIUS);

  // Controls
  const [joystickActive, setJoystickActive] = useState(false);
  const joystickVector = useRef<Vector2>({ x: 0, y: 0 });
  const [shooting, setShooting] = useState(false);
  const touchStartPos = useRef<Vector2 | null>(null);
  const joystickBasePos = useRef<Vector2>({ x: 100, y: 100 });
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });

  // Redirect if no squad
  useEffect(() => {
    if (!loading && !currentSquad) navigate('/');
  }, [currentSquad, loading, navigate]);

  // Realtime channel
  useEffect(() => {
    if (!currentSquad || !user) return;
    const channel = supabase.channel(`room_${currentSquad.squad_code}`, {
      config: { broadcast: { self: true } },
    });

    channel
      .on('broadcast', { event: 'player_update' }, ({ payload }) => {
        if (payload.userId === user.id) return;
        const remote = remotePlayersRef.current.get(payload.userId);
        const now = Date.now();
        if (remote) {
          remote.targetX = payload.x;
          remote.targetY = payload.y;
          remote.rotation = payload.rotation;
          remote.health = payload.health;
          remote.lastUpdate = now;
        } else {
          remotePlayersRef.current.set(payload.userId, {
            ...payload, targetX: payload.x, targetY: payload.y, lastUpdate: now,
          });
        }
        forceUpdate({});
      })
      .on('broadcast', { event: 'player_hit' }, ({ payload }) => {
        if (payload.targetUserId === user.id) {
          setLocalHealth(prev => {
            const absorbed = Math.min(armor, payload.damage * 0.5);
            const actualDamage = payload.damage - absorbed;
            if (absorbed > 0) setArmor(a => Math.max(0, a - absorbed));
            const newHealth = Math.max(0, prev - actualDamage);
            if (newHealth <= 0 && !isDead) {
              setIsDead(true);
              channel.send({
                type: 'broadcast', event: 'player_died',
                payload: { userId: user.id, killerId: payload.killerId },
              });
            }
            return newHealth;
          });
          soundManager.playHit();
        }
      })
      .on('broadcast', { event: 'player_died' }, ({ payload }) => {
        if (payload.killerId === user.id) {
          addCoins(10);
          addXP(20);
          setKills(prev => prev + 1);
          hapticImpact('heavy');
        }
      })
      .on('broadcast', { event: 'game_started' }, ({ payload }) => {
        const { teams } = payload;
        if (teams.blue.includes(user.id)) setMyTeam('blue');
        else setMyTeam('red');
      })
      .subscribe();

    channelRef.current = channel;
    return () => { channel.unsubscribe(); };
  }, [currentSquad, user]);

  // Canvas resize
  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        const { width, height } = containerRef.current.getBoundingClientRect();
        setCanvasSize({ width, height });
      }
    };
    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  // Reload handler
  const startReload = useCallback(() => {
    const ws = weaponState.current;
    if (ws.isReloading) return;
    const ammoType = ws.currentWeapon.ammoType;
    if (ws.reserveAmmo[ammoType] <= 0) return;
    if (ws.ammoInMag >= ws.currentWeapon.magazineSize) return;

    ws.isReloading = true;
    ws.reloadStartTime = performance.now();
    soundManager.playReload();

    setTimeout(() => {
      const needed = ws.currentWeapon.magazineSize - ws.ammoInMag;
      const available = ws.reserveAmmo[ammoType];
      const toLoad = Math.min(needed, available);
      ws.ammoInMag += toLoad;
      ws.reserveAmmo[ammoType] -= toLoad;
      ws.isReloading = false;
      setWeaponDisplay(prev => ({
        ...prev,
        ammoInMag: ws.ammoInMag,
        reserveAmmo: ws.reserveAmmo[ammoType],
        isReloading: false,
      }));
    }, ws.currentWeapon.reloadTime);
  }, []);

  // Switch weapon
  const switchWeapon = useCallback((weaponId: string) => {
    const weapon = WEAPONS[weaponId];
    if (!weapon) return;
    const ws = weaponState.current;
    ws.currentWeapon = weapon;
    ws.ammoInMag = Math.min(ws.ammoInMag, weapon.magazineSize);
    ws.isReloading = false;
    setWeaponDisplay({
      name: weapon.nameAr,
      ammoInMag: ws.ammoInMag,
      reserveAmmo: ws.reserveAmmo[weapon.ammoType],
      isReloading: false,
      reloadProgress: 0,
    });
  }, []);

  // Game loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const gameLoop = (timestamp: number) => {
      if (isDead) {
        render(ctx, timestamp);
        animationRef.current = requestAnimationFrame(gameLoop);
        return;
      }

      const ws = weaponState.current;

      // Movement
      if (joystickActive) {
        const joy = joystickVector.current;
        const len = Math.hypot(joy.x, joy.y);
        if (len > 0) {
          playerVel.current.x = (joy.x / len) * PLAYER_SPEED;
          playerVel.current.y = (joy.y / len) * PLAYER_SPEED;
          playerRotation.current = Math.atan2(joy.y, joy.x);
        }
      } else {
        playerVel.current.x *= 0.95;
        playerVel.current.y *= 0.95;
        if (Math.abs(playerVel.current.x) < 0.1) playerVel.current.x = 0;
        if (Math.abs(playerVel.current.y) < 0.1) playerVel.current.y = 0;
      }

      setPlayerPos(prev => ({
        x: Math.max(PLAYER_RADIUS, Math.min(MAP_WIDTH - PLAYER_RADIUS, prev.x + playerVel.current.x)),
        y: Math.max(PLAYER_RADIUS, Math.min(MAP_HEIGHT - PLAYER_RADIUS, prev.y + playerVel.current.y)),
      }));

      // Shooting with weapon system
      if (shooting && !ws.isReloading) {
        if (ws.ammoInMag <= 0) {
          startReload();
        } else if (timestamp - ws.lastShotTime > ws.currentWeapon.fireRate) {
          ws.lastShotTime = timestamp;
          ws.ammoInMag--;

          const angle = playerRotation.current;
          const weapon = ws.currentWeapon;

          for (let p = 0; p < weapon.pelletsPerShot; p++) {
            const spreadAngle = angle + (Math.random() - 0.5) * weapon.spread;
            const dirX = Math.cos(spreadAngle);
            const dirY = Math.sin(spreadAngle);
            bullets.current.push({
              x: playerPos.x + dirX * (PLAYER_RADIUS + 2),
              y: playerPos.y + dirY * (PLAYER_RADIUS + 2),
              vx: dirX * weapon.bulletSpeed,
              vy: dirY * weapon.bulletSpeed,
              life: weapon.bulletRange / weapon.bulletSpeed / 60,
              damage: weapon.damage,
            });
          }

          soundManager.playGunshot(weapon.soundId);
          hapticImpact('light');

          setWeaponDisplay(prev => ({
            ...prev,
            ammoInMag: ws.ammoInMag,
          }));
        }
      }

      // Update reload progress
      if (ws.isReloading) {
        const elapsed = timestamp - ws.reloadStartTime;
        const progress = Math.min(1, elapsed / ws.currentWeapon.reloadTime);
        setWeaponDisplay(prev => ({ ...prev, isReloading: true, reloadProgress: progress }));
      }

      // Update bullets & check collisions
      bullets.current = bullets.current
        .map(b => {
          b.x += b.vx;
          b.y += b.vy;
          b.life -= 1 / 60;

          for (const [id, remote] of remotePlayersRef.current.entries()) {
            if (remote.health <= 0 || remote.team === myTeam) continue;
            const dist = Math.hypot(b.x - remote.x, b.y - remote.y);
            if (dist < PLAYER_RADIUS + BULLET_SIZE / 2) {
              remote.health -= b.damage;
              channelRef.current?.send({
                type: 'broadcast', event: 'player_hit',
                payload: { targetUserId: id, damage: b.damage, killerId: user?.id },
              });
              if (remote.health <= 0) {
                channelRef.current?.send({
                  type: 'broadcast', event: 'player_died',
                  payload: { userId: id, killerId: user?.id },
                });
              }
              return null;
            }
          }
          return b;
        })
        .filter(b => b !== null && b.life > 0 && b.x >= 0 && b.x <= MAP_WIDTH && b.y >= 0 && b.y <= MAP_HEIGHT) as Bullet[];

      // Loot pickup
      lootItems.current = lootItems.current.filter(loot => {
        const dist = Math.hypot(playerPos.x - loot.x, playerPos.y - loot.y);
        if (dist < PLAYER_RADIUS + loot.radius) {
          soundManager.playPickup();
          hapticImpact('light');

          if (loot.type === 'medkit') {
            setLocalHealth(h => Math.min(100, h + loot.amount));
          } else if (loot.type === 'armor') {
            setArmor(a => Math.min(100, a + loot.amount));
          } else if (loot.type === 'weapon' && loot.weaponId) {
            switchWeapon(loot.weaponId);
          } else {
            // Ammo
            const ammoMap: Record<string, AmmoType> = {
              ammo_556: '5.56mm', ammo_9mm: '9mm', ammo_300: '.300mag', ammo_12g: '12gauge',
            };
            const ammoType = ammoMap[loot.type];
            if (ammoType) {
              ws.reserveAmmo[ammoType] += loot.amount;
              setWeaponDisplay(prev => ({
                ...prev,
                reserveAmmo: ws.reserveAmmo[ws.currentWeapon.ammoType],
              }));
            }
          }
          return false;
        }
        return true;
      });

      // Remote player interpolation
      const now = Date.now();
      remotePlayersRef.current.forEach((remote, id) => {
        remote.x += (remote.targetX - remote.x) * 0.1;
        remote.y += (remote.targetY - remote.y) * 0.1;
        if (now - remote.lastUpdate > REMOTE_TIMEOUT) remotePlayersRef.current.delete(id);
      });

      // Zone damage
      const distFromCenter = Math.hypot(playerPos.x - zoneCenter.x, playerPos.y - zoneCenter.y);
      if (distFromCenter > zoneRadius) {
        setLocalHealth(prev => Math.max(0, prev - ZONE_DAMAGE));
      }

      // Broadcast position
      if (timestamp - lastBroadcastTime.current > BROADCAST_INTERVAL) {
        lastBroadcastTime.current = timestamp;
        channelRef.current?.send({
          type: 'broadcast', event: 'player_update',
          payload: {
            userId: user?.id, username: user?.username,
            x: playerPos.x, y: playerPos.y,
            rotation: playerRotation.current,
            health: localHealth, team: myTeam,
            skin: user?.selectedSkin,
          },
        });
      }

      render(ctx, timestamp);
      animationRef.current = requestAnimationFrame(gameLoop);
    };

    animationRef.current = requestAnimationFrame(gameLoop);
    return () => { if (animationRef.current) cancelAnimationFrame(animationRef.current); };
  }, [joystickActive, shooting, playerPos, localHealth, isDead, user, myTeam, zoneCenter, zoneRadius, armor, startReload, switchWeapon]);

  // Zone shrinking
  useEffect(() => {
    if (!currentSquad || currentSquad.status !== 'in-game') return;
    const interval = setInterval(() => {
      setZoneRadius(prev => Math.max(MIN_ZONE_RADIUS, prev - ZONE_SHRINK_RATE));
    }, ZONE_SHRINK_INTERVAL);
    return () => clearInterval(interval);
  }, [currentSquad]);

  // Render function
  const render = (ctx: CanvasRenderingContext2D, _timestamp: number) => {
    const { width, height } = canvasSize;
    if (width === 0 || height === 0) return;
    const halfW = width / 2;
    const halfH = height / 2;

    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = '#0b1120';
    ctx.fillRect(0, 0, width, height);

    // Grid
    const offsetX = playerPos.x % GRID_SIZE;
    const offsetY = playerPos.y % GRID_SIZE;
    ctx.strokeStyle = GRID_COLOR;
    ctx.lineWidth = 1;
    for (let x = -offsetX; x < width; x += GRID_SIZE) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke();
    }
    for (let y = -offsetY; y < height; y += GRID_SIZE) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke();
    }

    // Zone circle
    const zsx = zoneCenter.x - playerPos.x + halfW;
    const zsy = zoneCenter.y - playerPos.y + halfH;
    ctx.beginPath();
    ctx.arc(zsx, zsy, zoneRadius, 0, Math.PI * 2);
    ctx.strokeStyle = '#00ff00';
    ctx.lineWidth = 2;
    ctx.setLineDash([10, 10]);
    ctx.stroke();
    ctx.setLineDash([]);

    // Danger zone overlay (outside circle)
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, width, height);
    ctx.arc(zsx, zsy, zoneRadius, 0, Math.PI * 2, true);
    ctx.fillStyle = 'rgba(255, 0, 0, 0.08)';
    ctx.fill();
    ctx.restore();

    // Loot items
    lootItems.current.forEach(loot => {
      const sx = loot.x - playerPos.x + halfW;
      const sy = loot.y - playerPos.y + halfH;
      if (sx < -30 || sx > width + 30 || sy < -30 || sy > height + 30) return;

      ctx.beginPath();
      ctx.arc(sx, sy, loot.radius, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.font = `${loot.radius}px serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(loot.emoji, sx, sy);
    });

    // Bullets
    ctx.shadowColor = '#ffff00';
    ctx.shadowBlur = 8;
    bullets.current.forEach(b => {
      const sx = b.x - playerPos.x + halfW;
      const sy = b.y - playerPos.y + halfH;
      if (sx < 0 || sx > width || sy < 0 || sy > height) return;

      // Bullet trail
      ctx.beginPath();
      ctx.arc(sx, sy, BULLET_SIZE, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255, 200, 50, ${Math.min(1, b.life * 3)})`;
      ctx.fill();

      // Muzzle flash effect (first few frames)
      if (b.life > 0.9) {
        ctx.beginPath();
        ctx.arc(sx, sy, BULLET_SIZE * 3, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255, 255, 200, 0.3)';
        ctx.fill();
      }
    });
    ctx.shadowBlur = 0;

    // Remote players
    remotePlayersRef.current.forEach(remote => {
      const sx = remote.x - playerPos.x + halfW;
      const sy = remote.y - playerPos.y + halfH;
      if (sx < -50 || sx > width + 50 || sy < -50 || sy > height + 50) return;

      const isTeammate = remote.team === myTeam;
      const bodyColor = remote.team === 'blue' ? '#4d8fff' : '#ff4d4d';

      // Teammate glow
      if (isTeammate && remote.health > 0) {
        ctx.beginPath();
        ctx.arc(sx, sy, PLAYER_RADIUS + 5, 0, Math.PI * 2);
        ctx.strokeStyle = '#00ff88';
        ctx.lineWidth = 2;
        ctx.shadowColor = '#00ff88';
        ctx.shadowBlur = 10;
        ctx.stroke();
        ctx.shadowBlur = 0;
      }

      // Body
      ctx.beginPath();
      ctx.arc(sx, sy, PLAYER_RADIUS, 0, Math.PI * 2);
      ctx.fillStyle = remote.health > 0 ? bodyColor : '#444';
      ctx.fill();

      // Direction indicator
      const tipX = sx + Math.cos(remote.rotation) * (PLAYER_RADIUS + 5);
      const tipY = sy + Math.sin(remote.rotation) * (PLAYER_RADIUS + 5);
      ctx.beginPath();
      ctx.moveTo(tipX, tipY);
      ctx.lineTo(sx + Math.cos(remote.rotation + 2.5) * PLAYER_RADIUS, sy + Math.sin(remote.rotation + 2.5) * PLAYER_RADIUS);
      ctx.lineTo(sx + Math.cos(remote.rotation - 2.5) * PLAYER_RADIUS, sy + Math.sin(remote.rotation - 2.5) * PLAYER_RADIUS);
      ctx.closePath();
      ctx.fillStyle = '#fff';
      ctx.fill();

      // Health bar
      const barW = PLAYER_RADIUS * 2;
      const barX = sx - barW / 2;
      const barY = sy - PLAYER_RADIUS - 10;
      ctx.fillStyle = '#333';
      ctx.fillRect(barX, barY, barW, 4);
      ctx.fillStyle = remote.health > 50 ? '#0f0' : remote.health > 20 ? '#ff0' : '#f00';
      ctx.fillRect(barX, barY, barW * (remote.health / 100), 4);

      // Name
      ctx.font = 'bold 10px monospace';
      ctx.fillStyle = '#fff';
      ctx.textAlign = 'left';
      ctx.fillText(remote.username, barX, barY - 3);
    });

    // Local player
    ctx.beginPath();
    ctx.arc(halfW, halfH, PLAYER_RADIUS + 4, 0, Math.PI * 2);
    ctx.strokeStyle = '#00ff88';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(halfW, halfH, PLAYER_RADIUS, 0, Math.PI * 2);
    ctx.fillStyle = myTeam === 'blue' ? '#4d8fff' : '#ff4d4d';
    ctx.shadowColor = myTeam === 'blue' ? '#4d8fff' : '#ff4d4d';
    ctx.shadowBlur = 15;
    ctx.fill();
    ctx.shadowBlur = 0;

    // Direction triangle
    const tipX = halfW + Math.cos(playerRotation.current) * (PLAYER_RADIUS + 6);
    const tipY = halfH + Math.sin(playerRotation.current) * (PLAYER_RADIUS + 6);
    ctx.beginPath();
    ctx.moveTo(tipX, tipY);
    ctx.lineTo(halfW + Math.cos(playerRotation.current + 2.5) * PLAYER_RADIUS, halfH + Math.sin(playerRotation.current + 2.5) * PLAYER_RADIUS);
    ctx.lineTo(halfW + Math.cos(playerRotation.current - 2.5) * PLAYER_RADIUS, halfH + Math.sin(playerRotation.current - 2.5) * PLAYER_RADIUS);
    ctx.closePath();
    ctx.fillStyle = '#fff';
    ctx.fill();

    // Local health bar
    const barW = PLAYER_RADIUS * 2;
    const barX = halfW - barW / 2;
    const barY = halfH - PLAYER_RADIUS - 10;
    ctx.fillStyle = '#333';
    ctx.fillRect(barX, barY, barW, 4);
    ctx.fillStyle = localHealth > 50 ? '#0f0' : localHealth > 20 ? '#ff0' : '#f00';
    ctx.fillRect(barX, barY, barW * (localHealth / 100), 4);

    // Death overlay
    if (isDead) {
      ctx.fillStyle = 'rgba(0,0,0,0.75)';
      ctx.fillRect(0, 0, width, height);
      ctx.font = 'bold 36px monospace';
      ctx.fillStyle = '#ff3b3b';
      ctx.textAlign = 'center';
      ctx.shadowColor = '#ff0000';
      ctx.shadowBlur = 20;
      ctx.fillText('ELIMINATED', width / 2, height / 2 - 20);
      ctx.font = '16px monospace';
      ctx.fillStyle = '#fff';
      ctx.shadowBlur = 0;
      ctx.fillText(`💀 ${kills} قتلى`, width / 2, height / 2 + 20);
    }
  };

  // Touch handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    e.preventDefault();
    if (isDead) return;
    const touch = e.touches[0];
    if (!touch) return;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = touch.clientX - rect.left;

    if (x < rect.width / 2) {
      setJoystickActive(true);
      const pos = { x: touch.clientX - rect.left, y: touch.clientY - rect.top };
      touchStartPos.current = pos;
      joystickBasePos.current = pos;
      joystickVector.current = { x: 0, y: 0 };
    } else {
      setShooting(true);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    e.preventDefault();
    if (isDead || !joystickActive || !touchStartPos.current) return;
    const touch = e.touches[0];
    if (!touch) return;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = touch.clientX - rect.left;
    const y = touch.clientY - rect.top;

    const dx = x - joystickBasePos.current.x;
    const dy = y - joystickBasePos.current.y;
    const distance = Math.hypot(dx, dy);
    const maxDistance = 50;
    if (distance > maxDistance) {
      joystickVector.current = { x: Math.cos(Math.atan2(dy, dx)), y: Math.sin(Math.atan2(dy, dx)) };
    } else {
      joystickVector.current = { x: dx / maxDistance, y: dy / maxDistance };
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    e.preventDefault();
    setJoystickActive(false);
    setShooting(false);
    joystickVector.current = { x: 0, y: 0 };
    touchStartPos.current = null;
  };

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 bg-slate-950 touch-none"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
    >
      {/* Back button */}
      <button
        onClick={() => isDead ? navigate('/') : window.confirm('مغادرة اللعبة؟') && navigate('/')}
        className="absolute top-4 left-4 z-10 bg-slate-900/80 p-2 rounded-full border border-white/10 text-white"
      >
        <ArrowLeft size={20} />
      </button>

      {/* HUD - Top right: Kills */}
      <div className="absolute top-4 right-4 z-10 bg-slate-900/80 px-3 py-1.5 rounded-lg border border-white/10 text-white text-sm font-mono">
        💀 {kills}
      </div>

      {/* HUD - Health & Armor bar */}
      <div className="absolute top-14 left-1/2 -translate-x-1/2 z-10 w-48">
        <div className="bg-slate-900/80 rounded-lg p-2 border border-white/10">
          <div className="flex items-center gap-1 mb-1">
            <span className="text-xs">❤️</span>
            <div className="flex-1 bg-slate-700 rounded-full h-2">
              <div className="bg-green-500 h-2 rounded-full transition-all" style={{ width: `${localHealth}%` }} />
            </div>
            <span className="text-xs text-white font-mono">{Math.round(localHealth)}</span>
          </div>
          {armor > 0 && (
            <div className="flex items-center gap-1">
              <span className="text-xs">🛡️</span>
              <div className="flex-1 bg-slate-700 rounded-full h-2">
                <div className="bg-blue-500 h-2 rounded-full transition-all" style={{ width: `${armor}%` }} />
              </div>
              <span className="text-xs text-white font-mono">{Math.round(armor)}</span>
            </div>
          )}
        </div>
      </div>

      {/* HUD - Weapon info */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10">
        <div className="bg-slate-900/90 rounded-xl px-4 py-2 border border-cyan-500/20 text-center">
          <div className="text-xs text-cyan-400 font-bold mb-1">{weaponDisplay.name}</div>
          <div className="flex items-center gap-2">
            {weaponDisplay.isReloading ? (
              <div className="w-24">
                <div className="bg-slate-700 rounded-full h-2">
                  <div className="bg-yellow-500 h-2 rounded-full transition-all" style={{ width: `${weaponDisplay.reloadProgress * 100}%` }} />
                </div>
                <div className="text-xs text-yellow-400 mt-0.5">إعادة تذخير...</div>
              </div>
            ) : (
              <span className="text-white font-mono text-lg">
                {weaponDisplay.ammoInMag} <span className="text-gray-400 text-sm">/ {weaponDisplay.reserveAmmo}</span>
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Reload button */}
      {!weaponDisplay.isReloading && weaponDisplay.ammoInMag < weaponState.current.currentWeapon.magazineSize && (
        <button
          onClick={startReload}
          className="absolute bottom-20 right-4 z-10 bg-yellow-500/20 text-yellow-400 px-3 py-2 rounded-lg border border-yellow-500/40 text-sm font-bold"
        >
          🔄 تذخير
        </button>
      )}

      <canvas
        ref={canvasRef}
        width={canvasSize.width}
        height={canvasSize.height}
        className="block w-full h-full"
        style={{ touchAction: 'none' }}
      />
    </div>
  );
};

export default GameArena;
