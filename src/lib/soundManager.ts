// ============================================
// SoundManager - إدارة المؤثرات الصوتية
// ============================================

class SoundManager {
  private sounds: Map<string, HTMLAudioElement> = new Map();
  private enabled: boolean = true;
  private volume: number = 0.5;

  constructor() {
    // Pre-register sound IDs (actual files can be added later)
    this.registerPlaceholders();
  }

  private registerPlaceholders() {
    // We use Web Audio API oscillators as placeholders
    // until real sound files are added to /public/sounds/
    const soundIds = [
      'ar_fire', 'smg_fire', 'sniper_fire', 'shotgun_fire',
      'reload', 'footstep', 'pickup', 'hit', 'death',
      'zone_warning', 'match_start',
    ];
    // Sounds will be loaded when files are available
    soundIds.forEach(id => {
      this.sounds.set(id, new Audio());
    });
  }

  setEnabled(enabled: boolean) {
    this.enabled = enabled;
  }

  setVolume(vol: number) {
    this.volume = Math.max(0, Math.min(1, vol));
  }

  play(soundId: string) {
    if (!this.enabled) return;
    
    // Use Web Audio API for synthetic sounds as placeholder
    try {
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      gain.gain.value = this.volume * 0.1;
      
      // Different frequencies for different sounds
      const freqMap: Record<string, { freq: number; duration: number; type: OscillatorType }> = {
        ar_fire: { freq: 200, duration: 0.05, type: 'square' },
        smg_fire: { freq: 300, duration: 0.03, type: 'square' },
        sniper_fire: { freq: 100, duration: 0.15, type: 'sawtooth' },
        shotgun_fire: { freq: 80, duration: 0.12, type: 'sawtooth' },
        reload: { freq: 500, duration: 0.3, type: 'sine' },
        footstep: { freq: 150, duration: 0.02, type: 'triangle' },
        pickup: { freq: 800, duration: 0.1, type: 'sine' },
        hit: { freq: 250, duration: 0.08, type: 'square' },
        death: { freq: 60, duration: 0.5, type: 'sawtooth' },
      };
      
      const config = freqMap[soundId] || { freq: 440, duration: 0.1, type: 'sine' as OscillatorType };
      osc.frequency.value = config.freq;
      osc.type = config.type;
      
      osc.start();
      osc.stop(ctx.currentTime + config.duration);
      
      setTimeout(() => ctx.close(), config.duration * 1000 + 100);
    } catch {
      // Silently fail if audio context isn't available
    }
  }

  playFootstep() {
    this.play('footstep');
  }

  playGunshot(weaponSoundId: string) {
    this.play(weaponSoundId);
  }

  playReload() {
    this.play('reload');
  }

  playPickup() {
    this.play('pickup');
  }

  playHit() {
    this.play('hit');
  }
}

export const soundManager = new SoundManager();
