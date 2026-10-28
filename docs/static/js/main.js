/**
 * Main application script:
 * Player UUID management, sync, daily streak claims, upgrade purchases, audio mute toggle.
 */

class BragiApp {
  constructor() {
    this.uuid = this.initPlayerUuid();
    this.player = null;
    this.init();
  }

  initPlayerUuid() {
    let uuid = localStorage.getItem('bragi_player_uuid');
    if (!uuid) {
      uuid = 'skald_' + Math.random().toString(36).substring(2, 11) + '_' + Date.now();
      localStorage.setItem('bragi_player_uuid', uuid);
    }
    return uuid;
  }

  async init() {
    this.bindGlobalEvents();
    await this.fetchPlayerProfile();
    this.updateAudioButtonState();
  }

  async fetchPlayerProfile() {
    try {
      const res = await fetch(`/api/me?uuid=${this.uuid}`);
      if (res.ok) {
        const data = await res.json();
        if (data && data.player) {
          this.player = data.player;
          this.renderPlayerUI();
          return;
        }
      }
    } catch (e) {
      // Backend not reachable, fall back to offline / GitHub Pages mode
    }

    // Offline / GitHub Pages fallback simulation
    this.initLocalPlayerProfile();
    this.renderPlayerUI();
  }

  initLocalPlayerProfile() {
    let localData = localStorage.getItem('bragi_local_player');
    if (localData) {
      try {
        this.player = JSON.parse(localData);
      } catch (e) {
        this.player = null;
      }
    }

    if (!this.player) {
      this.player = {
        uuid: this.uuid,
        name: localStorage.getItem('bragi_player_name') || 'Скальд',
        score: 0,
        highest_score: 0,
        mead: 150,
        total_mead: 150,
        games_played: 0,
        max_combo: 0,
        streak_days: 1,
        can_claim_daily: true,
        next_daily_reward: 30,
        harp_strings_lvl: 0,
        horn_lvl: 0,
        odin_blessings: 2,
        brewery_buff_games: 0,
        claimed_promos: []
      };
    }

    // Default upgrades catalog for offline / static hosting
    this.player.upgrades_catalog = {
      harp_strings: {
        id: 'harp_strings',
        name: 'Струны Браги',
        desc: '+20% очков за каждое попадание по руне',
        icon: '🎻',
        cost: 120,
        max_level: 5
      },
      drinking_horn: {
        id: 'drinking_horn',
        name: 'Рог Эгира',
        desc: '+25% медовухи за каждую игровую сессию',
        icon: '📯',
        cost: 150,
        max_level: 5
      },
      odin_blessing: {
        id: 'odin_blessing',
        name: 'Благословение Одина',
        desc: 'Замедление времени на 5 сек (расходуемый свиток)',
        icon: '⚡',
        cost: 80,
        max_level: 10,
        is_consumable: true
      },
      brewery_beer: {
        id: 'brewery_beer',
        name: 'Свежий крафт с пивоварни',
        desc: '+20% ко всем очкам и медовухе на 3 игры',
        icon: '🍺',
        cost: 100,
        charges: 3
      }
    };

    this.saveLocalPlayerProfile();
  }

  saveLocalPlayerProfile() {
    if (this.player) {
      localStorage.setItem('bragi_local_player', JSON.stringify(this.player));
    }
  }

  renderPlayerUI() {
    if (!this.player) return;

    // Save name locally
    localStorage.setItem('bragi_player_name', this.player.name);

    // Header mead counter
    const meadEl = document.getElementById('headerMeadCount');
    if (meadEl) meadEl.textContent = this.player.mead;

    // Player name in header/profile
    const nameEls = document.querySelectorAll('.player-name-display');
    nameEls.forEach(el => el.textContent = this.player.name);

    // Daily streak widget
    this.renderStreakWidget();

    // In-game upgrades drawer if open
    this.renderUpgradesDrawer();
  }

  renderStreakWidget() {
    const claimBtn = document.getElementById('btnClaimDaily');
    const streakDaysEl = document.getElementById('streakDaysCount');
    const nextRewardEl = document.getElementById('streakNextReward');

    if (streakDaysEl) streakDaysEl.textContent = this.player.streak_days;
    if (nextRewardEl) nextRewardEl.textContent = `+${this.player.next_daily_reward} 🍯`;

    if (claimBtn) {
      if (this.player.can_claim_daily) {
        claimBtn.disabled = false;
        claimBtn.textContent = `Забрать награду (+${this.player.next_daily_reward} 🍯)`;
        claimBtn.classList.remove('btn-outline');
        claimBtn.classList.add('btn-gold');
      } else {
        claimBtn.disabled = true;
        claimBtn.textContent = 'Награда получена сегодня ✓';
        claimBtn.classList.remove('btn-gold');
        claimBtn.classList.add('btn-outline');
      }
    }

    // Highlight streak step in daily steps grid
    const steps = document.querySelectorAll('.streak-step');
    steps.forEach((step, idx) => {
      const dayNum = idx + 1;
      if (dayNum <= this.player.streak_days) {
        step.classList.add('active');
      } else {
        step.classList.remove('active');
      }
    });
  }

  renderUpgradesDrawer() {
    const list = document.getElementById('upgradesDrawerList');
    if (!list || !this.player || !this.player.upgrades_catalog) return;

    const catalog = this.player.upgrades_catalog;
    let html = '';

    for (const [key, item] of Object.entries(catalog)) {
      let currentLevel = 0;
      let isMaxed = false;

      if (key === 'harp_strings') {
        currentLevel = this.player.harp_strings_lvl;
        isMaxed = currentLevel >= item.max_level;
      } else if (key === 'drinking_horn') {
        currentLevel = this.player.horn_lvl;
        isMaxed = currentLevel >= item.max_level;
      } else if (key === 'odin_blessing') {
        currentLevel = this.player.odin_blessings;
        isMaxed = currentLevel >= item.max_level;
      } else if (key === 'brewery_beer') {
        currentLevel = this.player.brewery_buff_games;
      }

      html += `
        <div class="upgrade-item">
          <div class="upgrade-info">
            <span class="upgrade-icon">${item.icon}</span>
            <div>
              <div class="upgrade-title">
                ${item.name}
                <span class="upgrade-level-badge">${item.is_consumable ? `x${currentLevel}` : (key === 'brewery_beer' ? `(осталось ${currentLevel} игр)` : `Ур. ${currentLevel}/${item.max_level}`)}</span>
              </div>
              <div class="upgrade-desc">${item.desc}</div>
            </div>
          </div>
          <button class="btn btn-sm ${isMaxed ? 'btn-outline' : 'btn-gold'} btn-buy-upgrade" 
                  data-upgrade-id="${key}" 
                  ${isMaxed || this.player.mead < item.cost ? 'disabled' : ''}>
            ${isMaxed ? 'МАКС' : `${item.cost} 🍯`}
          </button>
        </div>
      `;
    }

    list.innerHTML = html;

    // Attach buy events
    list.querySelectorAll('.btn-buy-upgrade').forEach(btn => {
      btn.addEventListener('click', () => {
        const upId = btn.getAttribute('data-upgrade-id');
        this.purchaseUpgrade(upId);
      });
    });
  }

  async purchaseUpgrade(upgradeId) {
    try {
      const res = await fetch('/api/me/upgrade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uuid: this.uuid, upgrade_id: upgradeId })
      });
      if (res.ok) {
        const data = await res.json();
        if (data && data.success) {
          this.showToast(`✨ ${data.message}`);
          this.player = data.player;
          this.saveLocalPlayerProfile();
          this.renderPlayerUI();
          if (window.bragiGame) {
            window.bragiGame.loadPlayerProfile();
          }
          return;
        } else if (data && data.message) {
          this.showToast(`⚠️ ${data.message}`);
          return;
        }
      }
    } catch (e) {
      // Fall through to local simulation
    }

    // Local upgrade purchase
    const catalog = this.player.upgrades_catalog || {};
    const item = catalog[upgradeId];
    if (!item) return;

    if (this.player.mead < item.cost) {
      this.showToast(`⚠️ Недостаточно медовухи (нужно ${item.cost} 🍯)`);
      return;
    }

    this.player.mead -= item.cost;
    if (upgradeId === 'harp_strings') {
      this.player.harp_strings_lvl = Math.min(item.max_level, (this.player.harp_strings_lvl || 0) + 1);
    } else if (upgradeId === 'drinking_horn') {
      this.player.horn_lvl = Math.min(item.max_level, (this.player.horn_lvl || 0) + 1);
    } else if (upgradeId === 'odin_blessing') {
      this.player.odin_blessings = Math.min(item.max_level, (this.player.odin_blessings || 0) + 1);
    } else if (upgradeId === 'brewery_beer') {
      this.player.brewery_buff_games = (this.player.brewery_buff_games || 0) + (item.charges || 3);
    }

    this.saveLocalPlayerProfile();
    this.renderPlayerUI();
    if (window.bragiGame) {
      window.bragiGame.loadPlayerProfile();
    }
    this.showToast(`✨ Улучшение «${item.name}» получено!`);
  }

  async claimDaily() {
    try {
      const res = await fetch('/api/me/claim-daily', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uuid: this.uuid })
      });
      if (res.ok) {
        const data = await res.json();
        if (data && data.success) {
          this.showToast(`🍯 Получено +${data.reward_amount} медовухи за ежедневный визит!`);
          this.player.mead = data.new_mead_balance;
          this.player.streak_days = data.streak_days;
          this.player.can_claim_daily = false;
          this.saveLocalPlayerProfile();
          this.renderPlayerUI();
          return;
        }
      }
    } catch (e) {
      // Fall through
    }

    // Local claim daily
    const rewards = [30, 50, 75, 100, 150, 200, 300];
    const reward = rewards[Math.min(this.player.streak_days - 1, rewards.length - 1)] || 30;
    this.player.mead = (this.player.mead || 0) + reward;
    this.player.streak_days = (this.player.streak_days || 1) + 1;
    this.player.can_claim_daily = false;
    this.saveLocalPlayerProfile();
    this.renderPlayerUI();
    this.showToast(`🍯 Получено +${reward} медовухи за ежедневный визит!`);
  }

  async exchangePromo(tierId) {
    try {
      const res = await fetch('/api/promo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uuid: this.uuid, tier_id: tierId })
      });
      if (res.ok) {
        const data = await res.json();
        if (data && data.success) {
          this.player.mead = data.new_mead_balance;
          this.saveLocalPlayerProfile();
          this.renderPlayerUI();
          this.showPromoSuccessModal(data);
          return;
        } else if (data && data.message) {
          this.showToast(`⚠️ ${data.message}`);
          return;
        }
      }
    } catch (e) {
      // Fall through to local simulation
    }

    // Local promo generation
    const tiers = {
      'BRAGI5': { title: 'Скидка 5% на крафтовое пиво', cost: 150, prefix: 'BRAGI5' },
      'BRAGI10': { title: 'Скидка 10% на весь чек', cost: 300, prefix: 'BRAGI10' },
      'SKALD15': { title: 'Скидка 15% на крафтовый набор', cost: 500, prefix: 'SKALD15' },
      'ODIN20': { title: 'Скидка 20% — Дар Всеотца', cost: 1000, prefix: 'ODIN20' },
      'CRAYFISH_GIFT': { title: 'Подарочные раки к пиву', cost: 750, prefix: 'RAKI-GIFT' }
    };

    const tier = tiers[tierId];
    if (!tier) return;

    if (this.player.mead < tier.cost) {
      this.showToast(`⚠️ Недостаточно медовухи (нужно ${tier.cost} 🍯)`);
      return;
    }

    this.player.mead -= tier.cost;
    const randomSuffix = Math.random().toString(36).substring(2, 7).toUpperCase();
    const code = `${tier.prefix}-${randomSuffix}`;

    if (!this.player.claimed_promos) this.player.claimed_promos = [];
    this.player.claimed_promos.unshift({
      code: code,
      title: tier.title,
      is_used: 0,
      created_at: new Date().toISOString()
    });

    this.saveLocalPlayerProfile();
    this.renderPlayerUI();
    this.showPromoSuccessModal({
      promo_code: code,
      title: tier.title,
      shop_url: 'https://arfabragi.ru'
    });
  }

  showPromoSuccessModal(data) {
    const modal = document.getElementById('promoSuccessModal');
    if (!modal) return;

    document.getElementById('promoModalCode').textContent = data.promo_code;
    document.getElementById('promoModalTitle').textContent = data.title;
    const shopLink = document.getElementById('promoModalShopBtn');
    if (shopLink) shopLink.href = data.shop_url;

    modal.classList.add('active');
  }

  bindGlobalEvents() {
    // Mobile navigation burger toggle
    const burger = document.getElementById('burgerBtn');
    const menu = document.getElementById('navMenu');
    if (burger && menu) {
      burger.addEventListener('click', () => {
        menu.classList.toggle('open');
      });
    }

    // Audio mute toggle button
    const audioBtn = document.getElementById('btnToggleAudio');
    if (audioBtn) {
      audioBtn.addEventListener('click', () => {
        const isMuted = window.bragiAudio.toggleMute();
        this.updateAudioButtonState(isMuted);
      });
    }

    // Daily claim button
    const claimBtn = document.getElementById('btnClaimDaily');
    if (claimBtn) {
      claimBtn.addEventListener('click', () => this.claimDaily());
    }

    // Upgrades modal trigger
    const openUpgradesBtn = document.getElementById('btnOpenUpgrades');
    const upgradesModal = document.getElementById('upgradesModal');
    if (openUpgradesBtn && upgradesModal) {
      openUpgradesBtn.addEventListener('click', () => {
        this.renderUpgradesDrawer();
        upgradesModal.classList.add('active');
      });
    }

    // Generic modal close buttons
    document.querySelectorAll('.modal-close-trigger').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('active'));
      });
    });

    // Skald name edit prompt
    const editNameBtn = document.getElementById('btnEditName');
    if (editNameBtn) {
      editNameBtn.addEventListener('click', () => {
        const curName = this.player ? this.player.name : 'Скальд';
        const newName = prompt('Назови своё скальдское имя:', curName);
        if (newName && newName.trim() && newName.trim() !== curName) {
          this.updateName(newName.trim());
        }
      });
    }

    // Copy promo code buttons
    document.addEventListener('click', (e) => {
      if (e.target && e.target.classList.contains('btn-copy-code')) {
        const code = e.target.getAttribute('data-code');
        if (code) {
          navigator.clipboard.writeText(code).then(() => {
            this.showToast(`📋 Промокод ${code} скопирован!`);
          });
        }
      }
    });
  }

  async updateName(newName) {
    try {
      const res = await fetch('/api/me/update-name', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uuid: this.uuid, name: newName })
      });
      const data = await res.json();
      if (data && data.success) {
        if (this.player) this.player.name = data.name;
        this.renderPlayerUI();
        if (window.bragiGame) {
          window.bragiGame.playerName = data.name;
        }
        this.showToast(`⚔️ Да пребудет с тобой Браги, ${data.name}!`);
      }
    } catch (e) {
      this.showToast('Ошибка смены имени');
    }
  }

  updateAudioButtonState(isMuted = null) {
    if (isMuted === null) {
      isMuted = window.bragiAudio.isMuted;
    }
    const icon = document.getElementById('audioBtnIcon');
    if (icon) {
      icon.textContent = isMuted ? '🔇' : '🔊';
    }
  }

  showToast(message) {
    let container = document.getElementById('toastContainer');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toastContainer';
      container.className = 'toast-container';
      document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      setTimeout(() => toast.remove(), 300);
    }, 3200);
  }
}

// Global instance
document.addEventListener('DOMContentLoaded', () => {
  window.bragiApp = new BragiApp();
});
