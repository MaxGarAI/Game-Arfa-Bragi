/**
 * Bragi's Harp (Арфа Браги) - Web Audio API Procedural Sound Engine
 * Synthesizes acoustic Celtic harp plucks, ambient Nordic drones, and game SFX.
 */

class BragiAudioEngine {
  constructor() {
    this.ctx = null;
    this.isMuted = localStorage.getItem('bragi_audio_muted') === 'true';
    this.masterGain = null;
    this.droneGain = null;
    this.droneOsc1 = null;
    this.droneOsc2 = null;
    this.droneFilter = null;
    this.isDronePlaying = false;
    
    // Background Viking war music track (war drums, bukkehorn, and drone)
    this.bgMusic = null;
    this.initBgMusic();

    // Celtic / Nordic pentatonic harp frequencies for strings 1..5
    this.harpFrequencies = [
      146.83, // String 1: D3 (Deep Root)
      174.61, // String 2: F3 (Minor Third)
      220.00, // String 3: A3 (Fifth)
      261.63, // String 4: C4 (Seventh)
      293.66  // String 5: D4 (High Octave / Golden Cask)
    ];
  }

  initBgMusic() {
    try {
      const basePath = window.location.pathname.startsWith('/Game-Arfa-Bragi') ? '/Game-Arfa-Bragi/' : '/';
      this.bgMusic = new Audio(`${basePath}static/audio/viking_battle.mp3`);
      this.bgMusic.loop = true;
      this.bgMusic.volume = 0.55;
      this.bgMusic.muted = this.isMuted;
    } catch (e) {
      console.warn('Background music init error:', e);
    }
  }

  startBattleMusic() {
    if (this.isMuted) return;
    this.ensureContext();
    this.stopAmbientDrone();
    if (this.bgMusic) {
      try {
        if (this.bgMusic.readyState >= 1) {
          this.bgMusic.currentTime = 0;
        }
      } catch (e) {}
      this.bgMusic.muted = this.isMuted;
      this.bgMusic.volume = 0.55;
      const playPromise = this.bgMusic.play();
      if (playPromise !== undefined) {
        playPromise.catch(() => {
          // Fallback to ambient procedural drone if browser blocks unprompted audio
          this.startAmbientDrone();
        });
      }
    } else {
      this.startAmbientDrone();
    }
  }

  stopBattleMusic() {
    if (this.bgMusic) {
      try {
        this.bgMusic.pause();
        if (this.bgMusic.readyState >= 1) {
          this.bgMusic.currentTime = 0;
        }
      } catch (e) {}
    }
    this.stopAmbientDrone();
  }

  init() {
    if (this.ctx) return;
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;

    this.ctx = new AudioContextClass();
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : 0.7, this.ctx.currentTime);
    this.masterGain.connect(this.ctx.destination);
  }

  ensureContext() {
    if (!this.ctx) this.init();
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  toggleMute() {
    this.isMuted = !this.isMuted;
    localStorage.setItem('bragi_audio_muted', this.isMuted);
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : 0.7, this.ctx.currentTime);
    }
    if (this.bgMusic) {
      this.bgMusic.muted = this.isMuted;
      if (this.isMuted) {
        try { this.bgMusic.pause(); } catch (e) {}
      }
    }
    return this.isMuted;
  }

  /**
   * Synthesize an acoustic Celtic harp pluck with wooden resonance
   * Ultra-lightweight 1-oscillator design with instant GC cleanup
   */
  playHarpPluck(stringIndex = 0, isBonus = false) {
    if (this.isMuted) return;
    this.ensureContext();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const freq = this.harpFrequencies[stringIndex % this.harpFrequencies.length] * (isBonus ? 1.5 : 1.0);

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = isBonus ? 'sine' : 'triangle';
    osc.frequency.setValueAtTime(freq, now);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(isBonus ? 0.75 : 0.6, now + 0.006);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + (isBonus ? 1.1 : 0.7));

    osc.connect(gain);
    gain.connect(this.masterGain);

    const stopTime = now + (isBonus ? 1.15 : 0.75);
    osc.start(now);
    osc.stop(stopTime);

    // Instant garbage collection on sound completion
    osc.onended = () => {
      try {
        osc.disconnect();
        gain.disconnect();
      } catch (e) {}
    };
  }

  /**
   * Special triumphant fanfare when the player spells out "ARFA BRAGI" (АРФА БРАГИ)
   */
  playSagaBonusFanfare() {
    if (this.isMuted) return;
    this.ensureContext();
    if (!this.ctx) return;

    const notes = [146.83, 220.00, 293.66, 369.99, 440.00];
    notes.forEach((freq, idx) => {
      if (!this.ctx) return;
      const now = this.ctx.currentTime + (idx * 0.1);
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now);

      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(0.5, now + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.2);

      osc.connect(gain);
      gain.connect(this.masterGain);

      osc.start(now);
      osc.stop(now + 1.25);
      osc.onended = () => {
        try { osc.disconnect(); gain.disconnect(); } catch (e) {}
      };
    });
  }

  /**
   * Sound for hitting the special golden beer cask rune
   */
  playBeerCaskBurst() {
    if (this.isMuted) return;
    this.ensureContext();
    if (!this.ctx) return;

    const chord = [293.66, 369.99, 440.00, 587.33];
    chord.forEach((freq, idx) => {
      if (!this.ctx) return;
      const now = this.ctx.currentTime + (idx * 0.05);
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now);

      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.35, now + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.9);

      osc.connect(gain);
      gain.connect(this.masterGain);

      osc.start(now);
      osc.stop(now + 0.95);
      osc.onended = () => {
        try { osc.disconnect(); gain.disconnect(); } catch (e) {}
      };
    });
  }

  /**
   * Sound effect for missing a rune
   */
  playMissSound() {
    if (this.isMuted) return;
    this.ensureContext();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(80, now);
    osc.frequency.exponentialRampToValueAtTime(35, now + 0.1);

    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(now);
    osc.stop(now + 0.14);
    osc.onended = () => {
      try { osc.disconnect(); gain.disconnect(); } catch (e) {}
    };
  }

  /**
   * Sound effect for Odin's Blessing (Time Slowdown matrix warp)
   */
  playOdinSlowdown() {
    if (this.isMuted) return;
    this.ensureContext();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(260, now);
    osc.frequency.exponentialRampToValueAtTime(50, now + 1.0);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.4, now + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.2);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(now);
    osc.stop(now + 1.25);
    osc.onended = () => {
      try { osc.disconnect(); gain.disconnect(); } catch (e) {}
    };
  }

  /**
   * Subtle ambient Norse drone (Nordic bowed lyre atmospheric background)
   */
  startAmbientDrone() {
    if (this.isDronePlaying || !this.ctx || this.isMuted) return;

    try {
      const now = this.ctx.currentTime;
      this.droneOsc1 = this.ctx.createOscillator();
      this.droneOsc2 = this.ctx.createOscillator();
      this.droneGain = this.ctx.createGain();
      this.droneFilter = this.ctx.createBiquadFilter();

      this.droneOsc1.type = 'sawtooth';
      this.droneOsc1.frequency.setValueAtTime(73.42, now); // D2

      this.droneOsc2.type = 'sine';
      this.droneOsc2.frequency.setValueAtTime(110.00, now); // A2 fifth

      this.droneFilter.type = 'lowpass';
      this.droneFilter.frequency.setValueAtTime(280, now);

      this.droneGain.gain.setValueAtTime(0.001, now);
      this.droneGain.gain.linearRampToValueAtTime(0.08, now + 3.0);

      this.droneOsc1.connect(this.droneFilter);
      this.droneOsc2.connect(this.droneFilter);
      this.droneFilter.connect(this.droneGain);
      this.droneGain.connect(this.masterGain);

      this.droneOsc1.start(now);
      this.droneOsc2.start(now);
      this.isDronePlaying = true;
    } catch (e) {
      console.warn('Drone start deferred:', e);
    }
  }

  stopAmbientDrone() {
    if (!this.isDronePlaying) return;
    try {
      if (this.droneGain && this.ctx) {
        const now = this.ctx.currentTime;
        this.droneGain.gain.linearRampToValueAtTime(0.0001, now + 1.0);
        setTimeout(() => {
          if (this.droneOsc1) { this.droneOsc1.stop(); this.droneOsc1.disconnect(); }
          if (this.droneOsc2) { this.droneOsc2.stop(); this.droneOsc2.disconnect(); }
          this.isDronePlaying = false;
        }, 1100);
      }
    } catch (e) {
      this.isDronePlaying = false;
    }
  }
}

// Global instance
window.bragiAudio = new BragiAudioEngine();
