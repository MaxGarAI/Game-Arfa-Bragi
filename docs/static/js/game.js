/**
 * Bragi's Harp (Арфа Браги) - Canvas Rhythm Engine
 * High-performance mobile-first rhythm game with Odin slow-motion,
 * dynamic string vibrations, particle physics, and share card generator.
 */

class BragiHarpGame {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    if (!this.canvas) return;
    this.ctx = this.canvas.getContext('2d');

    // Player state
    this.playerUuid = localStorage.getItem('bragi_player_uuid');
    this.playerName = localStorage.getItem('bragi_player_name') || 'Скальд';
    this.harpLevel = 0;
    this.hornLevel = 0;
    this.odinBlessings = 0;
    this.breweryBuffGames = 0;

    // Game loop & timing
    this.isRunning = false;
    this.isPaused = false;
    this.gameDuration = 45; // seconds
    this.timeRemaining = this.gameDuration;
    this.lastFrameTime = 0;

    // Rhythm lanes (4 harp strings)
    this.lanesCount = 4;
    this.laneKeys = ['D', 'F', 'J', 'K'];
    this.laneKeyCodes = ['KeyD', 'KeyF', 'KeyJ', 'KeyK'];
    this.laneNumCodes = ['Digit1', 'Digit2', 'Digit3', 'Digit4'];

    // Runes configuration
    this.elderFuthark = ['ᚠ', 'ᚢ', 'ᚦ', 'ᚨ', 'ᚱ', 'ᚲ', 'ᚷ', 'ᚹ', 'ᚺ', 'ᛗ', 'ᛋ', 'ᛏ', 'ᛒ'];
    this.activeRunes = [];
    this.particles = [];
    this.floatingTexts = [];
    this.stringVibrations = [0, 0, 0, 0]; // amplitude for each string

    // Score & stats
    this.score = 0;
    this.combo = 0;
    this.maxCombo = 0;
    this.runesHit = 0;
    this.runesMissed = 0;
    this.meadEarned = 0;

    // Speed & difficulty progression
    this.baseSpeed = 320; // pixels per second
    this.currentSpeed = this.baseSpeed;
    this.spawnTimer = 0;
    this.spawnInterval = 0.65; // seconds

    // Odin's Blessing (slowdown)
    this.isOdinActive = false;
    this.odinDuration = 5.0;
    this.odinTimer = 0;

    // Screen shake
    this.shakeIntensity = 0;

    // Visual assets (using relative path for GitHub Pages compatibility)
    this.emblemImg = new Image();
    this.emblemImg.src = 'static/logo/emblem_gold.png';
    this.logoImg = new Image();
    this.logoImg.src = 'static/logo/logo_gold.png';

    // Target line (where runes should be hit)
    this.hitLineY = 0;
    this.laneWidth = 0;

    this.initCanvasSize();
    this.bindEvents();
    this.loadPlayerProfile();
  }

  initCanvasSize() {
    const box = document.getElementById('pureCanvasBox') || this.canvas.parentElement;
    if (!box) return;
    const rect = box.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    this.width = Math.round(rect.width) || window.innerWidth;
    this.height = Math.round(rect.height) || 480;

    this.canvas.width = Math.round(this.width * dpr);
    this.canvas.height = Math.round(this.height * dpr);
    this.canvas.style.width = `${this.width}px`;
    this.canvas.style.height = `${this.height}px`;

    if (this.ctx.resetTransform) {
      this.ctx.resetTransform();
    }
    this.ctx.scale(dpr, dpr);
    this.laneWidth = this.width / this.lanesCount;
    this.hitLineY = this.height * 0.80;
  }

  openGameModal() {
    const modal = document.getElementById('pureGameModal');
    if (!modal) return;
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
    window.bragiAudio.ensureContext();
    this.initCanvasSize();
    setTimeout(() => this.initCanvasSize(), 60);
    setTimeout(() => this.initCanvasSize(), 220);
  }

  closeGameModal() {
    const modal = document.getElementById('pureGameModal');
    if (!modal) return;
    modal.classList.remove('active');
    document.body.style.overflow = '';
    if (this.isRunning) {
      this.isRunning = false;
      window.bragiAudio.stopAmbientDrone();
    }
    if (window.location.pathname.endsWith('/game') || window.location.pathname.endsWith('game.html')) {
      window.location.href = window.location.pathname.includes('.html') ? 'index.html' : '/';
    }
  }

  async loadPlayerProfile() {
    if (!this.playerUuid) {
      this.playerUuid = 'skald_' + Math.random().toString(36).substring(2, 11) + '_' + Date.now();
      localStorage.setItem('bragi_player_uuid', this.playerUuid);
    }

    try {
      const res = await fetch(`/api/me?uuid=${this.playerUuid}`);
      const data = await res.json();
      if (data && data.player) {
        const p = data.player;
        this.playerName = p.name;
        this.harpLevel = p.harp_strings_lvl || 0;
        this.hornLevel = p.horn_lvl || 0;
        this.odinBlessings = p.odin_blessings || 0;
        this.breweryBuffGames = p.brewery_buff_games || 0;
        this.updateHeaderMead(p.mead);
        this.updateOdinButtonUI();
      }
    } catch (e) {
      console.warn('Profile fetch fallback:', e);
    }
  }

  updateHeaderMead(amount) {
    ['headerMeadCount', 'gameHudMead', 'pureHudMead'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.textContent = amount;
    });
  }

  updateOdinButtonUI() {
    const btn = document.getElementById('btnOdinSkill');
    const badge = document.getElementById('odinSkillCount');
    if (badge) badge.textContent = this.odinBlessings;
    if (btn) btn.disabled = this.odinBlessings <= 0 || this.isOdinActive;
  }

  updatePureAudioBtn(isMuted) {
    const btn = document.getElementById('btnPureAudioToggle');
    if (btn) btn.textContent = isMuted ? '🔇' : '🔊';
  }

  bindEvents() {
    window.addEventListener('resize', () => this.initCanvasSize());

    // Triggers for opening/closing the pure game modal window
    document.querySelectorAll('.btn-open-game-window').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        this.openGameModal();
      });
    });

    const closeBtn = document.getElementById('btnCloseGameModal');
    if (closeBtn) closeBtn.addEventListener('click', () => this.closeGameModal());

    const pureAudioBtn = document.getElementById('btnPureAudioToggle');
    if (pureAudioBtn) {
      pureAudioBtn.addEventListener('click', () => {
        const isMuted = window.bragiAudio.toggleMute();
        this.updatePureAudioBtn(isMuted);
      });
    }

    // Upgrades modal triggers inside game
    const openUpgSplash = document.getElementById('btnOpenUpgradesSplash');
    const openUpgPure = document.getElementById('btnOpenUpgradesPure');
    const upgradesModal = document.getElementById('upgradesModal');
    [openUpgSplash, openUpgPure].forEach(btn => {
      if (btn && upgradesModal) {
        btn.addEventListener('click', () => {
          if (window.bragiApp) window.bragiApp.renderUpgradesDrawer();
          upgradesModal.classList.add('active');
        });
      }
    });

    // Mouse / Touch tap handling
    const handleTap = (clientX, clientY) => {
      if (!this.isRunning || this.isPaused) return;
      window.bragiAudio.ensureContext();
      const rect = this.canvas.getBoundingClientRect();
      const x = clientX - rect.x;
      const y = clientY - rect.y;

      const laneIndex = Math.min(this.lanesCount - 1, Math.max(0, Math.floor(x / this.laneWidth)));
      this.triggerHit(laneIndex, y);
    };

    this.canvas.addEventListener('mousedown', (e) => handleTap(e.clientX, e.clientY));
    this.canvas.addEventListener('touchstart', (e) => {
      e.preventDefault();
      for (let i = 0; i < e.changedTouches.length; i++) {
        const t = e.changedTouches[i];
        handleTap(t.clientX, t.clientY);
      }
    }, { passive: false });

    // Keyboard support (D, F, J, K or 1, 2, 3, 4)
    window.addEventListener('keydown', (e) => {
      if (!this.isRunning || this.isPaused) return;

      const code = e.code;
      let lane = -1;
      const keyIdx = this.laneKeyCodes.indexOf(code);
      if (keyIdx !== -1) lane = keyIdx;
      const numIdx = this.laneNumCodes.indexOf(code);
      if (numIdx !== -1) lane = numIdx;

      if (lane !== -1) {
        e.preventDefault();
        window.bragiAudio.ensureContext();
        this.triggerHit(lane, this.hitLineY);
      } else if (code === 'Space') {
        e.preventDefault();
        this.activateOdinBlessing();
      }
    });

    // Start / Restart button
    const startBtn = document.getElementById('btnStartGame');
    if (startBtn) startBtn.addEventListener('click', () => this.startGame());

    const restartBtn = document.getElementById('btnRestartGame');
    if (restartBtn) restartBtn.addEventListener('click', () => this.startGame());

    // Odin blessing button
    const odinBtn = document.getElementById('btnOdinSkill');
    if (odinBtn) odinBtn.addEventListener('click', () => this.activateOdinBlessing());
  }

  startGame() {
    this.resetGameState();
    this.isRunning = true;
    this.isPaused = false;
    this.lastFrameTime = performance.now();

    // Hide splash & result modals
    const splash = document.getElementById('gameSplashOverlay');
    if (splash) splash.classList.remove('active');
    const resultModal = document.getElementById('gameResultModal');
    if (resultModal) resultModal.classList.remove('active');

    window.bragiAudio.ensureContext();
    window.bragiAudio.startAmbientDrone();

    requestAnimationFrame((t) => this.gameLoop(t));
  }

  resetGameState() {
    this.timeRemaining = this.gameDuration;
    this.score = 0;
    this.combo = 0;
    this.maxCombo = 0;
    this.runesHit = 0;
    this.runesMissed = 0;
    this.activeRunes = [];
    this.particles = [];
    this.floatingTexts = [];
    this.stringVibrations = [0, 0, 0, 0];
    this.isOdinActive = false;
    this.odinTimer = 0;
    this.currentSpeed = this.baseSpeed;
    this.updateHUD();
  }

  activateOdinBlessing() {
    if (this.odinBlessings <= 0 || this.isOdinActive || !this.isRunning) return;

    this.isOdinActive = true;
    this.odinTimer = this.odinDuration;
    this.odinBlessings--;
    this.updateOdinButtonUI();

    window.bragiAudio.playOdinSlowdown();
    this.addFloatingText(this.width / 2, this.height * 0.45, '⚡ БЛАГОСЛОВЕНИЕ ОДИНА! ⚡', '#70a1ff', 24);

    // Sync consumable usage to server
    fetch('/api/me/use-blessing', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ uuid: this.playerUuid })
    }).catch(console.warn);
  }

  spawnRune() {
    const lane = Math.floor(Math.random() * this.lanesCount);
    const isSpecialCask = Math.random() < 0.12; // 12% chance for golden brewery cask

    const runeChar = isSpecialCask ? '🍺' : this.elderFuthark[Math.floor(Math.random() * this.elderFuthark.length)];
    const x = lane * this.laneWidth + this.laneWidth / 2;

    this.activeRunes.push({
      lane: lane,
      char: runeChar,
      x: x,
      y: -30,
      isCask: isSpecialCask,
      radius: isSpecialCask ? 28 : 24,
      rotation: (Math.random() - 0.5) * 0.2,
      hit: false
    });
  }

  triggerHit(laneIndex, tapY) {
    this.stringVibrations[laneIndex] = 18; // String pluck animation amplitude

    // Find best candidate rune in this lane near hit line
    let bestRune = null;
    let minDistance = 9999;
    const hitZoneY = this.hitLineY;

    for (const r of this.activeRunes) {
      if (r.lane === laneIndex && !r.hit) {
        const dist = Math.abs(r.y - hitZoneY);
        if (dist < minDistance && dist < 110) {
          minDistance = dist;
          bestRune = r;
        }
      }
    }

    if (bestRune) {
      bestRune.hit = true;
      this.runesHit++;
      this.combo++;
      if (this.combo > this.maxCombo) this.maxCombo = this.combo;

      // Calculate rating
      let ratingText = 'ХОРОШО!';
      let basePoints = 100;
      let color = '#7bed9f';

      if (minDistance < 26) {
        ratingText = 'ИДЕАЛЬНО!';
        basePoints = 300;
        color = '#ffd32a';
      } else if (minDistance < 55) {
        ratingText = 'ОТЛИЧНО!';
        basePoints = 200;
        color = '#ff9f1a';
      }

      // Combo multiplier: 1x, 2x, 3x, 4x, 5x, 10x
      let comboMultiplier = 1;
      if (this.combo >= 100) comboMultiplier = 10;
      else if (this.combo >= 75) comboMultiplier = 5;
      else if (this.combo >= 50) comboMultiplier = 4;
      else if (this.combo >= 25) comboMultiplier = 3;
      else if (this.combo >= 10) comboMultiplier = 2;

      // Harp string upgrade bonus
      const harpBonus = 1.0 + (this.harpLevel * 0.20);
      // Brewery buff bonus (+20%)
      const buffBonus = this.breweryBuffGames > 0 ? 1.20 : 1.0;
      // Golden cask bonus (x2)
      const caskMultiplier = bestRune.isCask ? 2.0 : 1.0;

      const ptsEarned = Math.round(basePoints * comboMultiplier * harpBonus * buffBonus * caskMultiplier);
      this.score += ptsEarned;

      // Sound
      if (bestRune.isCask) {
        window.bragiAudio.playBeerCaskBurst();
        this.addFloatingText(bestRune.x, bestRune.y - 20, 'ХМЕЛЬНОЙ ВЗРЫВ x2! 🍺', '#ffd700', 20);
        this.emitParticles(bestRune.x, bestRune.y, '#ffd700', 35);
      } else {
        window.bragiAudio.playHarpPluck(laneIndex, comboMultiplier >= 4);
        this.addFloatingText(bestRune.x, bestRune.y - 10, `${ratingText} +${ptsEarned}`, color, 16);
        this.emitParticles(bestRune.x, bestRune.y, color, 18);
      }

      this.updateHUD();
    } else {
      // Empty tap miss
      this.handleMiss(laneIndex);
    }
  }

  handleMiss(laneIndex = -1) {
    if (this.combo > 5) {
      this.addFloatingText(this.width / 2, this.hitLineY - 30, 'КОМБО ПРЕРВАНО!', '#ff4757', 18);
    }
    this.combo = 0;
    this.runesMissed++;
    this.shakeIntensity = 8;
    window.bragiAudio.playMissSound();
    this.updateHUD();
  }

  emitParticles(x, y, color, count = 16) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 220 + 40;
      this.particles.push({
        x: x,
        y: y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1.0,
        decay: Math.random() * 1.5 + 1.2,
        size: Math.random() * 4 + 2,
        color: color
      });
    }
  }

  addFloatingText(x, y, text, color, fontSize = 16) {
    this.floatingTexts.push({
      x: x,
      y: y,
      text: text,
      color: color,
      fontSize: fontSize,
      life: 1.0,
      decay: 1.2,
      vy: -60
    });
  }

  gameLoop(timestamp) {
    if (!this.isRunning) return;

    const dt = Math.min((timestamp - this.lastFrameTime) / 1000, 0.1);
    this.lastFrameTime = timestamp;

    if (!this.isPaused) {
      this.update(dt);
    }

    this.render();

    if (this.isRunning) {
      requestAnimationFrame((t) => this.gameLoop(t));
    }
  }

  update(dt) {
    // Timer countdown
    this.timeRemaining -= dt;
    if (this.timeRemaining <= 0) {
      this.timeRemaining = 0;
      this.endGame();
      return;
    }

    // Odin's slow motion timer
    let speedModifier = 1.0;
    if (this.isOdinActive) {
      this.odinTimer -= dt;
      speedModifier = 0.35; // 65% slow down
      if (this.odinTimer <= 0) {
        this.isOdinActive = false;
        this.updateOdinButtonUI();
      }
    }

    // Dynamic speed escalation based on time passed
    const timeProgress = 1.0 - (this.timeRemaining / this.gameDuration);
    this.currentSpeed = (this.baseSpeed + timeProgress * 140) * speedModifier;

    // Spawning runes
    this.spawnTimer += dt;
    const currentInterval = (this.spawnInterval - timeProgress * 0.25) / speedModifier;
    if (this.spawnTimer >= currentInterval) {
      this.spawnTimer = 0;
      this.spawnRune();
    }

    // Update active runes
    for (let i = this.activeRunes.length - 1; i >= 0; i--) {
      const r = this.activeRunes[i];
      r.y += this.currentSpeed * dt;

      // Miss if fallen well past the hit zone
      if (r.y > this.height + 40) {
        if (!r.hit) {
          this.handleMiss(r.lane);
        }
        this.activeRunes.splice(i, 1);
      }
    }

    // Update particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= p.decay * dt;
      if (p.life <= 0) this.particles.splice(i, 1);
    }

    // Update floating texts
    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const ft = this.floatingTexts[i];
      ft.y += ft.vy * dt;
      ft.life -= ft.decay * dt;
      if (ft.life <= 0) this.floatingTexts.splice(i, 1);
    }

    // Damped string vibration oscillation
    for (let i = 0; i < this.stringVibrations.length; i++) {
      if (this.stringVibrations[i] > 0.05) {
        this.stringVibrations[i] *= Math.pow(0.04, dt);
      } else {
        this.stringVibrations[i] = 0;
      }
    }

    // Screen shake damping
    if (this.shakeIntensity > 0.1) {
      this.shakeIntensity *= Math.pow(0.05, dt);
    } else {
      this.shakeIntensity = 0;
    }
  }

  render() {
    this.ctx.save();

    // Screen shake offset
    if (this.shakeIntensity > 0) {
      const ox = (Math.random() - 0.5) * this.shakeIntensity * 2;
      const oy = (Math.random() - 0.5) * this.shakeIntensity * 2;
      this.ctx.translate(ox, oy);
    }

    // Background clearing
    this.ctx.fillStyle = '#0a0d12';
    this.ctx.fillRect(0, 0, this.width, this.height);

    // Odin slow-mo mystical aura overlay
    if (this.isOdinActive) {
      const grad = this.ctx.createRadialGradient(
        this.width / 2, this.height / 2, 50,
        this.width / 2, this.height / 2, this.width * 0.8
      );
      grad.addColorStop(0, 'rgba(74, 144, 226, 0.12)');
      grad.addColorStop(1, 'rgba(10, 15, 30, 0.45)');
      this.ctx.fillStyle = grad;
      this.ctx.fillRect(0, 0, this.width, this.height);
    }

    // Draw 4 Harp Strings & Frets
    this.drawHarpStrings();

    // Draw Hit Line at bottom
    this.drawHitLine();

    // Draw Runes
    this.drawRunes();

    // Draw Particles
    this.drawParticles();

    // Draw Floating Texts
    this.drawFloatingTexts();

    // Top Progress Bar
    this.drawProgressBar();

    this.ctx.restore();
  }

  drawHarpStrings() {
    for (let i = 0; i < this.lanesCount; i++) {
      const laneX = i * this.laneWidth;
      const centerX = laneX + this.laneWidth / 2;

      // Subtle lane divider
      this.ctx.strokeStyle = 'rgba(229, 169, 60, 0.08)';
      this.ctx.lineWidth = 1;
      this.ctx.beginPath();
      this.ctx.moveTo(laneX, 0);
      this.ctx.lineTo(laneX, this.height);
      this.ctx.stroke();

      // Golden acoustic harp string
      const vib = Math.sin(Date.now() * 0.04) * this.stringVibrations[i];
      this.ctx.beginPath();
      this.ctx.moveTo(centerX, 0);
      this.ctx.quadraticCurveTo(centerX + vib, this.height / 2, centerX, this.height);
      this.ctx.strokeStyle = this.stringVibrations[i] > 1 ? '#ffc453' : 'rgba(229, 169, 60, 0.35)';
      this.ctx.lineWidth = this.stringVibrations[i] > 1 ? 3 : 1.5;
      this.ctx.stroke();

      // Key binding indicator label at bottom
      this.ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
      this.ctx.font = '600 12px Montserrat, sans-serif';
      this.ctx.textAlign = 'center';
      this.ctx.fillText(this.laneKeys[i], centerX, this.height - 12);
    }
  }

  drawHitLine() {
    const y = this.hitLineY;

    // Glowing target baseline
    this.ctx.save();
    this.ctx.strokeStyle = 'rgba(229, 169, 60, 0.65)';
    this.ctx.lineWidth = 3;
    this.ctx.shadowColor = '#e5a93c';
    this.ctx.shadowBlur = 12;

    this.ctx.beginPath();
    this.ctx.moveTo(0, y);
    this.ctx.lineTo(this.width, y);
    this.ctx.stroke();

    // Decorative runic resonators on each lane
    for (let i = 0; i < this.lanesCount; i++) {
      const cx = i * this.laneWidth + this.laneWidth / 2;
      this.ctx.beginPath();
      this.ctx.arc(cx, y, 22, 0, Math.PI * 2);
      this.ctx.strokeStyle = 'rgba(229, 169, 60, 0.4)';
      this.ctx.lineWidth = 2;
      this.ctx.stroke();
    }
    this.ctx.restore();
  }

  drawRunes() {
    for (const r of this.activeRunes) {
      if (r.hit) continue;

      this.ctx.save();
      this.ctx.translate(r.x, r.y);
      this.ctx.rotate(r.rotation);

      if (r.isCask) {
        // Golden Beer Barrel Easter Egg Rune
        this.ctx.beginPath();
        this.ctx.arc(0, 0, r.radius, 0, Math.PI * 2);
        this.ctx.fillStyle = '#b87a1d';
        this.ctx.fill();
        this.ctx.strokeStyle = '#ffd87d';
        this.ctx.lineWidth = 3;
        this.ctx.shadowColor = '#ffd87d';
        this.ctx.shadowBlur = 15;
        this.ctx.stroke();

        // Draw beer emoji or brewery symbol
        this.ctx.font = '24px "Segoe UI Emoji", sans-serif';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText('🍺', 0, 1);
      } else {
        // Ancient Elder Futhark Stone Rune
        this.ctx.beginPath();
        this.ctx.arc(0, 0, r.radius, 0, Math.PI * 2);
        this.ctx.fillStyle = '#181d26';
        this.ctx.fill();
        this.ctx.strokeStyle = 'rgba(229, 169, 60, 0.7)';
        this.ctx.lineWidth = 2;
        this.ctx.shadowColor = 'rgba(229, 169, 60, 0.35)';
        this.ctx.shadowBlur = 8;
        this.ctx.stroke();

        // Glowing Rune Glyph
        this.ctx.fillStyle = '#ffc453';
        this.ctx.font = '700 22px "Cinzel Decorative", serif';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText(r.char, 0, 0);
      }

      this.ctx.restore();
    }
  }

  drawParticles() {
    for (const p of this.particles) {
      this.ctx.save();
      this.ctx.globalAlpha = Math.max(0, p.life);
      this.ctx.fillStyle = p.color;
      this.ctx.shadowColor = p.color;
      this.ctx.shadowBlur = 8;
      this.ctx.beginPath();
      this.ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.restore();
    }
  }

  drawFloatingTexts() {
    for (const ft of this.floatingTexts) {
      this.ctx.save();
      this.ctx.globalAlpha = Math.max(0, ft.life);
      this.ctx.fillStyle = ft.color;
      this.ctx.font = `800 ${ft.fontSize}px Unbounded, sans-serif`;
      this.ctx.textAlign = 'center';
      this.ctx.shadowColor = ft.color;
      this.ctx.shadowBlur = 10;
      this.ctx.fillText(ft.text, ft.x, ft.y);
      this.ctx.restore();
    }
  }

  drawProgressBar() {
    const progress = this.timeRemaining / this.gameDuration;
    this.ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
    this.ctx.fillRect(0, 0, this.width, 4);

    this.ctx.fillStyle = progress < 0.2 ? '#ff4757' : '#e5a93c';
    this.ctx.shadowColor = this.ctx.fillStyle;
    this.ctx.shadowBlur = 6;
    this.ctx.fillRect(0, 0, this.width * progress, 4);
  }

  updateHUD() {
    const scoreStr = this.score.toLocaleString('ru-RU');
    const comboStr = `${this.combo}x`;
    const timeStr = `${Math.ceil(this.timeRemaining)}с`;

    ['pureHudScore', 'gameHudScore'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.textContent = scoreStr;
    });
    ['pureHudCombo', 'gameHudCombo'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.textContent = comboStr;
    });
    ['pureHudTime', 'gameHudTime'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.textContent = timeStr;
    });
  }

  async endGame() {
    this.isRunning = false;
    window.bragiAudio.stopAmbientDrone();

    // Accuracy
    const totalTaps = this.runesHit + this.runesMissed;
    const accuracy = totalTaps > 0 ? (this.runesHit / totalTaps) * 100 : 0;

    // Send score to backend with anti-cheat validation
    try {
      const res = await fetch('/api/score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uuid: this.playerUuid,
          score: this.score,
          combo: this.maxCombo,
          runes_hit: this.runesHit,
          accuracy: accuracy.toFixed(1),
          duration_seconds: this.gameDuration
        })
      });
      if (res.ok) {
        const data = await res.json();
        if (data && data.success) {
          this.meadEarned = data.mead_earned;
          this.updateHeaderMead(data.total_mead);
          this.showVictoryModal(data);
          return;
        }
      }
    } catch (e) {
      console.warn('Score submission fallback to local mode:', e);
    }

    // Local calculation for offline / GitHub Pages
    const hornMult = 1.0 + (this.hornLevel * 0.25);
    const buffMult = this.breweryBuffGames > 0 ? 1.20 : 1.0;
    const baseMead = Math.max(1, Math.floor(this.score / 100));
    const earnedMead = Math.floor(baseMead * hornMult * buffMult);
    this.meadEarned = earnedMead;

    if (window.bragiApp && window.bragiApp.player) {
      window.bragiApp.player.mead = (window.bragiApp.player.mead || 0) + earnedMead;
      window.bragiApp.player.highest_score = Math.max(window.bragiApp.player.highest_score || 0, this.score);
      window.bragiApp.player.max_combo = Math.max(window.bragiApp.player.max_combo || 0, this.maxCombo);
      window.bragiApp.player.games_played = (window.bragiApp.player.games_played || 0) + 1;
      if (this.breweryBuffGames > 0) {
        window.bragiApp.player.brewery_buff_games = Math.max(0, this.breweryBuffGames - 1);
        this.breweryBuffGames = window.bragiApp.player.brewery_buff_games;
      }
      window.bragiApp.saveLocalPlayerProfile();
      window.bragiApp.renderPlayerUI();
      this.updateHeaderMead(window.bragiApp.player.mead);
    }

    this.showVictoryModal({ score: this.score, mead_earned: earnedMead });
  }

  getSkaldTitle(score) {
    if (score >= 14000) return 'Глас Всеотца Одина';
    if (score >= 8000) return 'Певец Вальхаллы';
    if (score >= 4000) return 'Любимец Браги';
    if (score >= 1500) return 'Скальд ярла';
    return 'Странствующий менестрель';
  }

  showVictoryModal(data) {
    const modal = document.getElementById('gameResultModal');
    if (!modal) return;

    document.getElementById('resScore').textContent = this.score.toLocaleString('ru-RU');
    document.getElementById('resMaxCombo').textContent = `${this.maxCombo}x`;
    document.getElementById('resRunesHit').textContent = this.runesHit;
    document.getElementById('resMeadEarned').textContent = `+${data.mead_earned || 0} 🍯`;
    document.getElementById('resSkaldTitle').textContent = this.getSkaldTitle(this.score);

    modal.classList.add('active');

    // Bind share card generation button
    const shareBtn = document.getElementById('btnShareScore');
    if (shareBtn) {
      shareBtn.onclick = () => this.generateShareCard();
    }
  }

  /**
   * Generates a high-resolution 1080x1080 canvas card with brewery emblem,
   * score, combo, runes, and downloads as PNG / shares.
   */
  generateShareCard() {
    const shareCanvas = document.createElement('canvas');
    shareCanvas.width = 1080;
    shareCanvas.height = 1080;
    const sctx = shareCanvas.getContext('2d');

    // 1. Dark charcoal background with subtle noise & radial amber glow
    sctx.fillStyle = '#080a0e';
    sctx.fillRect(0, 0, 1080, 1080);

    const rad = sctx.createRadialGradient(540, 320, 80, 540, 480, 600);
    rad.addColorStop(0, 'rgba(229, 169, 60, 0.18)');
    rad.addColorStop(1, 'rgba(0, 0, 0, 0.85)');
    sctx.fillStyle = rad;
    sctx.fillRect(0, 0, 1080, 1080);

    // 2. Decorative Double Runic Gold Borders
    sctx.strokeStyle = '#e5a93c';
    sctx.lineWidth = 6;
    sctx.strokeRect(40, 40, 1000, 1000);

    sctx.strokeStyle = 'rgba(229, 169, 60, 0.4)';
    sctx.lineWidth = 2;
    sctx.strokeRect(55, 55, 970, 970);

    // Corner Runes
    sctx.fillStyle = '#ffc453';
    sctx.font = '700 36px "Cinzel Decorative", serif';
    sctx.fillText('ᚠ', 75, 95);
    sctx.fillText('ᚲ', 975, 95);
    sctx.fillText('ᛗ', 75, 995);
    sctx.fillText('ᛋ', 975, 995);

    // 3. Draw Brewery Emblem
    if (this.emblemImg.complete && this.emblemImg.naturalWidth > 0) {
      sctx.drawImage(this.emblemImg, 540 - 75, 100, 150, 150);
    }

    // 4. Brewery Title & Tagline
    sctx.textAlign = 'center';
    sctx.fillStyle = '#ffc453';
    sctx.font = '900 38px "Cinzel Decorative", serif';
    sctx.fillText('АРФА БРАГИ', 540, 300);

    sctx.fillStyle = '#8e98a8';
    sctx.font = '600 20px Montserrat, sans-serif';
    sctx.fillText('КРАФТОВАЯ ПИВОВАРНЯ & ЧЕРТОГ РАКОВ', 540, 335);

    // 5. Divider
    sctx.strokeStyle = 'rgba(229, 169, 60, 0.5)';
    sctx.lineWidth = 2;
    sctx.beginPath();
    sctx.moveTo(340, 370);
    sctx.lineTo(740, 370);
    sctx.stroke();

    // 6. Skald Name & Title
    sctx.fillStyle = '#ffffff';
    sctx.font = '700 32px Unbounded, sans-serif';
    sctx.fillText(`САГА СКАЛЬДА: ${this.playerName}`, 540, 430);

    sctx.fillStyle = '#ffd32a';
    sctx.font = '600 24px Montserrat, sans-serif';
    sctx.fillText(`«${this.getSkaldTitle(this.score)}»`, 540, 475);

    // 7. Huge Glowing Score Box
    sctx.fillStyle = 'rgba(19, 22, 28, 0.85)';
    sctx.fillRect(240, 520, 600, 180);
    sctx.strokeStyle = '#e5a93c';
    sctx.lineWidth = 3;
    sctx.strokeRect(240, 520, 600, 180);

    sctx.fillStyle = '#8e98a8';
    sctx.font = '700 20px Unbounded, sans-serif';
    sctx.fillText('ОЧКИ САГИ', 540, 565);

    sctx.fillStyle = '#ffc453';
    sctx.font = '900 68px Unbounded, sans-serif';
    sctx.fillText(this.score.toLocaleString('ru-RU'), 540, 650);

    // 8. Stats Row: Combo & Mead
    sctx.fillStyle = '#ffffff';
    sctx.font = '700 26px Montserrat, sans-serif';
    sctx.fillText(`Макс. комбо: ${this.maxCombo}x   •   Добыто медовухи: +${this.meadEarned} 🍯`, 540, 760);

    // 9. CTA & Store Info
    sctx.fillStyle = '#e5a93c';
    sctx.font = '700 22px Unbounded, sans-serif';
    sctx.fillText('СЫГРАЙ И ПОЛУЧИ СКИДКУ НА КРАФТОВОЕ ПИВО!', 540, 860);

    sctx.fillStyle = '#8e98a8';
    sctx.font = '500 18px Montserrat, sans-serif';
    sctx.fillText('📍 г. Майкоп, ул. Победа, 171   •   arfabragi.ru', 540, 905);

    // Convert to PNG and download / share
    shareCanvas.toBlob((blob) => {
      if (!blob) return;
      const file = new File([blob], 'arfa_bragi_saga.png', { type: 'image/png' });

      // Try native mobile Web Share API first
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        navigator.share({
          files: [file],
          title: 'Моя сага в Арфа Браги',
          text: `Я набрал ${this.score} очков в «Арфа Браги» и получил медовуху на скидку!`,
          url: window.location.origin
        }).catch(() => {});
      } else {
        // Fallback: trigger direct PNG download
        const a = document.createElement('a');
        a.download = `arfa_bragi_${this.score}_score.png`;
        a.href = URL.createObjectURL(blob);
        a.click();
        URL.revokeObjectURL(a.href);
      }
    }, 'image/png');
  }
}

// Global initialization
document.addEventListener('DOMContentLoaded', () => {
  window.bragiGame = new BragiHarpGame('gameCanvas');
});
