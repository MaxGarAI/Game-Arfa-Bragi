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
    
    // Celtic / Nordic pentatonic harp frequencies for strings 1..5
    this.harpFrequencies = [
      146.83, // String 1: D3 (Deep Root)
      174.61, // String 2: F3 (Minor Third)
      220.00, // String 3: A3 (Fifth)
      261.63, // String 4: C4 (Seventh)
      293.66  // String 5: D4 (High Octave / Golden Cask)
    ];
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
      this.ctx.resume();
    }
  }

  toggleMute() {
    this.isMuted = !this.isMuted;
    localStorage.setItem('bragi_audio_muted', this.isMuted);
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : 0.7, this.ctx.currentTime);
    }
    return this.isMuted;
  }

  /**
   * Synthesize an acoustic Celtic harp pluck with wooden resonance
   */
  playHarpPluck(stringIndex = 0, isBonus = false) {
    if (this.isMuted) return;
    this.ensureContext();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const freq = this.harpFrequencies[stringIndex % this.harpFrequencies.length] * (isBonus ? 1.5 : 1.0);

    // Primary plucked string oscillator (triangle with rich fundamental)
    const osc1 = this.ctx.createOscillator();
    osc1.type = 'triangle';
    osc1.frequency.setValueAtTime(freq, now);

    // Secondary harmonic oscillator (sine slightly detuned for organic wooden beating)
    const osc2 = this.ctx.createOscillator();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(freq * 2.01, now);

    // Initial sharp pluck transient impulse (simulates nail or plectrum hitting bronze string)
    const pluckNoise = this.ctx.createOscillator();
    pluckNoise.type = 'sawtooth';
    pluckNoise.frequency.setValueAtTime(freq * 3.5, now);

    // Dynamic lowpass filter (opens on pluck, decays rapidly mimicking string damping)
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(isBonus ? 4200 : 2800, now);
    filter.frequency.exponentialRampToValueAtTime(320, now + 1.2);

    // String envelope (exponential decay)
    const stringGain = this.ctx.createGain();
    stringGain.gain.setValueAtTime(0.0001, now);
    stringGain.gain.linearRampToValueAtTime(isBonus ? 0.9 : 0.65, now + 0.006); // ultra fast attack
    stringGain.gain.exponentialRampToValueAtTime(0.0001, now + (isBonus ? 2.2 : 1.6));

    // Transient pluck gain
    const pluckGain = this.ctx.createGain();
    pluckGain.gain.setValueAtTime(0.4, now);
    pluckGain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);

    // Routing
    osc1.connect(filter);
    osc2.connect(filter);
    pluckNoise.connect(pluckGain);
    pluckGain.connect(filter);

    filter.connect(stringGain);
    stringGain.connect(this.masterGain);

    // Start & auto-stop oscillators
    osc1.start(now);
    osc2.start(now);
    pluckNoise.start(now);

    const stopTime = now + (isBonus ? 2.3 : 1.7);
    osc1.stop(stopTime);
    osc2.stop(stopTime);
    pluckNoise.stop(now + 0.05);
  }

  /**
   * Sound for hitting the special golden beer cask rune (fanfare + harp sparkle)
   */
  playBeerCaskBurst() {
    if (this.isMuted) return;
    this.ensureContext();
    if (!this.ctx) return;

    // Pluck 3 rapid celestial harp notes in an arpeggio
    const chord = [293.66, 369.99, 440.00, 587.33]; // D major chord
    chord.forEach((freq, idx) => {
      setTimeout(() => {
        if (!this.ctx || this.isMuted) return;
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now);
        
        gain.gain.setValueAtTime(0.01, now);
        gain.gain.linearRampToValueAtTime(0.4, now + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.4);
        
        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start(now);
        osc.stop(now + 1.5);
      }, idx * 60);
    });
  }

  /**
   * Sound effect for missing a rune (muted dull wooden tap)
   */
  playMissSound() {
    if (this.isMuted) return;
    this.ensureContext();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(85, now);
    osc.frequency.exponentialRampToValueAtTime(40, now + 0.12);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(220, now);

    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    osc.start(now);
    osc.stop(now + 0.18);
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
    const filter = this.ctx.createBiquadFilter();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(320, now);
    osc.frequency.exponentialRampToValueAtTime(55, now + 1.2);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1400, now);
    filter.frequency.exponentialRampToValueAtTime(180, now + 1.2);

    gain.gain.setValueAtTime(0.01, now);
    gain.gain.linearRampToValueAtTime(0.5, now + 0.1);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 1.8);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    osc.start(now);
    osc.stop(now + 2.0);
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
