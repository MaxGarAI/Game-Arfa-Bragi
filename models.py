import sqlite3
import random
import string
from datetime import datetime, date, timedelta
from typing import Optional, Dict, Any, List
from config import Config

ALL_ACHIEVEMENTS = {
    'first_saga': {
        'id': 'first_saga',
        'title': 'Первая сага',
        'desc': 'Сыграть свою первую песнь на арфе Браги',
        'icon': '🎵'
    },
    'apprentice_skald': {
        'id': 'apprentice_skald',
        'title': 'Ученик скальда',
        'desc': 'Набрать 2 000 очков в одной игре',
        'icon': '📜'
    },
    'bragi_favorite': {
        'id': 'bragi_favorite',
        'title': 'Любимец Браги',
        'desc': 'Набрать 5 000 очков за сессию',
        'icon': '👑'
    },
    'yotun_slayer': {
        'id': 'yotun_slayer',
        'title': 'Убийца ётунов',
        'desc': 'Преодолеть грозную планку в 10 000 очков',
        'icon': '⚔️'
    },
    'combo_50': {
        'id': 'combo_50',
        'title': 'Ритм Вальхаллы',
        'desc': 'Выбить серию комбо из 50 рун подряд',
        'icon': '🔥'
    },
    'combo_100': {
        'id': 'combo_100',
        'title': '100 комбо',
        'desc': 'Безупречная симфония — 100 рун без единого промаха',
        'icon': '⚡'
    },
    'mead_brewer': {
        'id': 'mead_brewer',
        'title': 'Медовый хмель',
        'desc': 'Накопить 500 медовухи за всё время',
        'icon': '🍯'
    },
    'harp_virtuoso': {
        'id': 'harp_virtuoso',
        'title': 'Песнь скальда',
        'desc': 'Прокачать струны арфы до максимума',
        'icon': '✨'
    },
    'odin_streak': {
        'id': 'odin_streak',
        'title': 'Щедрость Одина',
        'desc': 'Заходить в чертог 5 дней подряд',
        'icon': '🛡️'
    },
    'patron_of_craft': {
        'id': 'patron_of_craft',
        'title': 'Друг пивоварни',
        'desc': 'Обменять медовуху на свой первый промокод',
        'icon': '🍺'
    }
}

def get_db():
    conn = sqlite3.connect(str(Config.DB_PATH))
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn

def init_db():
    with get_db() as conn:
        conn.executescript('''
        CREATE TABLE IF NOT EXISTS players (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            uuid TEXT UNIQUE NOT NULL,
            name TEXT NOT NULL DEFAULT 'Скальд',
            score INTEGER DEFAULT 0,
            highest_score INTEGER DEFAULT 0,
            mead INTEGER DEFAULT 50,
            total_mead INTEGER DEFAULT 50,
            games_played INTEGER DEFAULT 0,
            max_combo INTEGER DEFAULT 0,
            streak_days INTEGER DEFAULT 1,
            last_daily_claim TEXT,
            harp_strings_lvl INTEGER DEFAULT 0,
            horn_lvl INTEGER DEFAULT 0,
            odin_blessings INTEGER DEFAULT 1,
            brewery_buff_games INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS score_records (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            player_id INTEGER,
            player_name TEXT,
            score INTEGER NOT NULL,
            max_combo INTEGER DEFAULT 0,
            runes_hit INTEGER DEFAULT 0,
            accuracy REAL DEFAULT 0.0,
            mead_earned INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(player_id) REFERENCES players(id) ON DELETE SET NULL
        );

        CREATE TABLE IF NOT EXISTS promo_codes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            code TEXT UNIQUE NOT NULL,
            reward_tier TEXT NOT NULL,
            title TEXT NOT NULL,
            discount_percent INTEGER NOT NULL,
            mead_cost INTEGER NOT NULL,
            player_id INTEGER,
            player_name TEXT,
            is_used INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            used_at TIMESTAMP,
            FOREIGN KEY(player_id) REFERENCES players(id) ON DELETE SET NULL
        );

        CREATE TABLE IF NOT EXISTS achievements (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            player_id INTEGER NOT NULL,
            achievement_key TEXT NOT NULL,
            unlocked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(player_id) REFERENCES players(id) ON DELETE CASCADE,
            UNIQUE(player_id, achievement_key)
        );

        CREATE INDEX IF NOT EXISTS idx_players_uuid ON players(uuid);
        CREATE INDEX IF NOT EXISTS idx_scores_created ON score_records(created_at);
        CREATE INDEX IF NOT EXISTS idx_scores_score ON score_records(score DESC);
        CREATE INDEX IF NOT EXISTS idx_promo_code ON promo_codes(code);
        ''')

def get_or_create_player(player_uuid: str, default_name: str = "Скальд") -> Dict[str, Any]:
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM players WHERE uuid = ?", (player_uuid,))
        row = cursor.fetchone()
        
        if row:
            player = dict(row)
        else:
            # New player bonus: 50 starting mead + 1 Odin blessing scroll
            cursor.execute('''
                INSERT INTO players (uuid, name, mead, total_mead, odin_blessings)
                VALUES (?, ?, 50, 50, 1)
            ''', (player_uuid, default_name))
            conn.commit()
            cursor.execute("SELECT * FROM players WHERE uuid = ?", (player_uuid,))
            player = dict(cursor.fetchone())
            
        # Also attach achievements
        cursor.execute("SELECT achievement_key, unlocked_at FROM achievements WHERE player_id = ?", (player['id'],))
        ach_rows = cursor.fetchall()
        unlocked_keys = {r['achievement_key']: r['unlocked_at'] for r in ach_rows}
        
        player['achievements'] = []
        for key, data in ALL_ACHIEVEMENTS.items():
            player['achievements'].append({
                **data,
                'unlocked': key in unlocked_keys,
                'unlocked_at': unlocked_keys.get(key)
            })
            
        # Daily claim availability
        today_str = date.today().isoformat()
        player['can_claim_daily'] = player['last_daily_claim'] != today_str
        
        # Calculate next daily bonus amount
        streak_idx = min(player['streak_days'] - 1, len(Config.DAILY_STREAK_REWARDS) - 1)
        player['next_daily_reward'] = Config.DAILY_STREAK_REWARDS[max(0, streak_idx)]
        
        return player

def update_player_name(player_uuid: str, new_name: str) -> bool:
    clean_name = (new_name or '').strip()
    if not clean_name or len(clean_name) > 30:
        return False
    with get_db() as conn:
        conn.execute("UPDATE players SET name = ?, updated_at = CURRENT_TIMESTAMP WHERE uuid = ?", (clean_name, player_uuid))
        conn.commit()
        return True

def claim_daily_bonus(player_uuid: str) -> Dict[str, Any]:
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM players WHERE uuid = ?", (player_uuid,))
        row = cursor.fetchone()
        if not row:
            return {'success': False, 'message': 'Игрок не найден'}
        
        player = dict(row)
        today = date.today()
        today_str = today.isoformat()
        
        if player['last_daily_claim'] == today_str:
            return {'success': False, 'message': 'Ежедневная награда уже получена сегодня. Возвращайся завтра!'}
            
        # Calculate streak logic
        streak = player['streak_days'] or 1
        if player['last_daily_claim']:
            last_date = date.fromisoformat(player['last_daily_claim'])
            if today - last_date == timedelta(days=1):
                streak += 1
            else:
                streak = 1
        else:
            streak = 1
            
        reward_idx = min(streak - 1, len(Config.DAILY_STREAK_REWARDS) - 1)
        reward_amount = Config.DAILY_STREAK_REWARDS[reward_idx]
        
        new_mead = player['mead'] + reward_amount
        new_total_mead = player['total_mead'] + reward_amount
        
        cursor.execute('''
            UPDATE players
            SET mead = ?, total_mead = ?, streak_days = ?, last_daily_claim = ?, updated_at = CURRENT_TIMESTAMP
            WHERE uuid = ?
        ''', (new_mead, new_total_mead, streak, today_str, player_uuid))
        conn.commit()
        
        # Check streak achievement
        new_achievements = []
        if streak >= 5:
            if unlock_achievement(player['id'], 'odin_streak', conn):
                new_achievements.append(ALL_ACHIEVEMENTS['odin_streak'])
                
        return {
            'success': True,
            'reward_amount': reward_amount,
            'streak_days': streak,
            'new_mead_balance': new_mead,
            'new_achievements': new_achievements
        }

def save_game_score(player_uuid: str, score: int, max_combo: int, runes_hit: int, accuracy: float, duration_seconds: int) -> Dict[str, Any]:
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM players WHERE uuid = ?", (player_uuid,))
        row = cursor.fetchone()
        if not row:
            return {'success': False, 'message': 'Игрок не найден'}
            
        player = dict(row)
        
        # Anti-cheat verification
        if duration_seconds < Config.MIN_GAME_DURATION_SEC:
            return {'success': False, 'message': 'Игра завершилась слишком быстро'}
            
        max_allowed_score = min(Config.MAX_POSSIBLE_SCORE, int(duration_seconds * Config.MAX_SCORE_PER_SECOND * 2))
        if score > max_allowed_score:
            score = max_allowed_score
            
        # Calculate bonus mead multipliers
        horn_lvl = player.get('horn_lvl', 0)
        horn_mult = 1.0 + (horn_lvl * Config.UPGRADES['drinking_horn']['multiplier_per_level'])
        
        buff_active = player.get('brewery_buff_games', 0) > 0
        buff_mult = 1.20 if buff_active else 1.0
        
        base_mead = max(1, int(score / Config.POINTS_PER_MEAD))
        total_mead_earned = int(base_mead * horn_mult * buff_mult)
        
        # Decrement brewery craft beer buff if active
        new_buff_games = max(0, player['brewery_buff_games'] - 1) if buff_active else 0
        
        new_highest = max(player['highest_score'], score)
        new_max_combo = max(player['max_combo'], max_combo)
        new_games_played = player['games_played'] + 1
        new_mead = player['mead'] + total_mead_earned
        new_total_mead = player['total_mead'] + total_mead_earned
        
        # Update player record
        cursor.execute('''
            UPDATE players
            SET score = ?, highest_score = ?, mead = ?, total_mead = ?,
                games_played = ?, max_combo = ?, brewery_buff_games = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        ''', (score, new_highest, new_mead, new_total_mead, new_games_played, new_max_combo, new_buff_games, player['id']))
        
        # Record into score log
        cursor.execute('''
            INSERT INTO score_records (player_id, player_name, score, max_combo, runes_hit, accuracy, mead_earned)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        ''', (player['id'], player['name'], score, max_combo, runes_hit, accuracy, total_mead_earned))
        
        conn.commit()
        
        # Check and award achievements
        new_achievements = []
        if new_games_played >= 1 and unlock_achievement(player['id'], 'first_saga', conn):
            new_achievements.append(ALL_ACHIEVEMENTS['first_saga'])
        if score >= 2000 and unlock_achievement(player['id'], 'apprentice_skald', conn):
            new_achievements.append(ALL_ACHIEVEMENTS['apprentice_skald'])
        if score >= 5000 and unlock_achievement(player['id'], 'bragi_favorite', conn):
            new_achievements.append(ALL_ACHIEVEMENTS['bragi_favorite'])
        if score >= 10000 and unlock_achievement(player['id'], 'yotun_slayer', conn):
            new_achievements.append(ALL_ACHIEVEMENTS['yotun_slayer'])
        if max_combo >= 50 and unlock_achievement(player['id'], 'combo_50', conn):
            new_achievements.append(ALL_ACHIEVEMENTS['combo_50'])
        if max_combo >= 100 and unlock_achievement(player['id'], 'combo_100', conn):
            new_achievements.append(ALL_ACHIEVEMENTS['combo_100'])
        if new_total_mead >= 500 and unlock_achievement(player['id'], 'mead_brewer', conn):
            new_achievements.append(ALL_ACHIEVEMENTS['mead_brewer'])
            
        return {
            'success': True,
            'score': score,
            'is_new_record': score > player['highest_score'],
            'highest_score': new_highest,
            'mead_earned': total_mead_earned,
            'total_mead': new_mead,
            'brewery_buff_remaining': new_buff_games,
            'new_achievements': new_achievements
        }

def unlock_achievement(player_id: int, key: str, conn: sqlite3.Connection) -> bool:
    try:
        cursor = conn.cursor()
        cursor.execute("INSERT INTO achievements (player_id, achievement_key) VALUES (?, ?)", (player_id, key))
        conn.commit()
        return True
    except sqlite3.IntegrityError:
        return False

def buy_upgrade(player_uuid: str, upgrade_id: str) -> Dict[str, Any]:
    if upgrade_id not in Config.UPGRADES:
        return {'success': False, 'message': 'Неизвестное улучшение'}
        
    cfg = Config.UPGRADES[upgrade_id]
    cost = cfg['cost']
    
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM players WHERE uuid = ?", (player_uuid,))
        row = cursor.fetchone()
        if not row:
            return {'success': False, 'message': 'Игрок не найден'}
            
        player = dict(row)
        if player['mead'] < cost:
            return {'success': False, 'message': f'Недостаточно медовухи 🍯 (нужно {cost}, у вас {player["mead"]})'}
            
        new_achievements = []
        
        if upgrade_id == 'harp_strings':
            cur_lvl = player['harp_strings_lvl']
            if cur_lvl >= cfg['max_level']:
                return {'success': False, 'message': 'Струны уже улучшены до максимума'}
            new_lvl = cur_lvl + 1
            new_mead = player['mead'] - cost
            cursor.execute("UPDATE players SET mead = ?, harp_strings_lvl = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
                           (new_mead, new_lvl, player['id']))
            if new_lvl >= cfg['max_level'] and unlock_achievement(player['id'], 'harp_virtuoso', conn):
                new_achievements.append(ALL_ACHIEVEMENTS['harp_virtuoso'])
                
        elif upgrade_id == 'drinking_horn':
            cur_lvl = player['horn_lvl']
            if cur_lvl >= cfg['max_level']:
                return {'success': False, 'message': 'Рог уже улучшен до предела'}
            new_lvl = cur_lvl + 1
            new_mead = player['mead'] - cost
            cursor.execute("UPDATE players SET mead = ?, horn_lvl = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
                           (new_mead, new_lvl, player['id']))
            
        elif upgrade_id == 'odin_blessing':
            cur_count = player['odin_blessings']
            if cur_count >= cfg['max_level']:
                return {'success': False, 'message': 'Слишком много свитков замедления (макс 10)'}
            new_count = cur_count + 1
            new_mead = player['mead'] - cost
            cursor.execute("UPDATE players SET mead = ?, odin_blessings = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
                           (new_mead, new_count, player['id']))
            
        elif upgrade_id == 'brewery_beer':
            new_charges = player['brewery_buff_games'] + cfg['charges']
            new_mead = player['mead'] - cost
            cursor.execute("UPDATE players SET mead = ?, brewery_buff_games = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
                           (new_mead, new_charges, player['id']))
                           
        conn.commit()
        
        # Fetch updated player
        cursor.execute("SELECT * FROM players WHERE id = ?", (player['id'],))
        updated_player = dict(cursor.fetchone())
        
        return {
            'success': True,
            'message': f'Улучшение «{cfg["name"]}» успешно получено!',
            'player': updated_player,
            'new_achievements': new_achievements
        }

def use_odin_blessing(player_uuid: str) -> Dict[str, Any]:
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM players WHERE uuid = ?", (player_uuid,))
        row = cursor.fetchone()
        if not row:
            return {'success': False, 'message': 'Игрок не найден'}
        player = dict(row)
        if player['odin_blessings'] <= 0:
            return {'success': False, 'message': 'Нет доступных свитков замедления'}
        new_count = player['odin_blessings'] - 1
        cursor.execute("UPDATE players SET odin_blessings = ? WHERE id = ?", (new_count, player['id']))
        conn.commit()
        return {'success': True, 'remaining_blessings': new_count}

def generate_random_promo_code(prefix: str) -> str:
    chars = string.ascii_uppercase + string.digits
    # remove ambiguous chars
    chars = chars.replace('O', '').replace('0', '').replace('I', '').replace('1', '')
    suffix = ''.join(random.choice(chars) for _ in range(5))
    return f"{prefix}-{suffix}"

def exchange_mead_for_promo(player_uuid: str, tier_id: str) -> Dict[str, Any]:
    if tier_id not in Config.PROMO_TIERS:
        return {'success': False, 'message': 'Недействительный тип промокода'}
        
    tier = Config.PROMO_TIERS[tier_id]
    cost = tier['mead_cost']
    
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM players WHERE uuid = ?", (player_uuid,))
        row = cursor.fetchone()
        if not row:
            return {'success': False, 'message': 'Игрок не найден'}
            
        player = dict(row)
        if player['mead'] < cost:
            return {'success': False, 'message': f'Недостаточно медовухи 🍯 (нужно {cost}, у вас {player["mead"]})'}
            
        new_mead = player['mead'] - cost
        
        # Generate unique code
        while True:
            code = generate_random_promo_code(tier['prefix'])
            cursor.execute("SELECT id FROM promo_codes WHERE code = ?", (code,))
            if not cursor.fetchone():
                break
                
        cursor.execute('''
            INSERT INTO promo_codes (code, reward_tier, title, discount_percent, mead_cost, player_id, player_name)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        ''', (code, tier_id, tier['title'], tier['discount_percent'], cost, player['id'], player['name']))
        
        cursor.execute("UPDATE players SET mead = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", (new_mead, player['id']))
        conn.commit()
        
        # Check achievement
        new_achievements = []
        if unlock_achievement(player['id'], 'patron_of_craft', conn):
            new_achievements.append(ALL_ACHIEVEMENTS['patron_of_craft'])
            
        return {
            'success': True,
            'promo_code': code,
            'title': tier['title'],
            'discount_percent': tier['discount_percent'],
            'mead_cost': cost,
            'new_mead_balance': new_mead,
            'new_achievements': new_achievements,
            'shop_url': Config.SHOP_URL
        }

def get_player_promos(player_id: int) -> List[Dict[str, Any]]:
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute('''
            SELECT * FROM promo_codes
            WHERE player_id = ?
            ORDER BY created_at DESC
        ''', (player_id,))
        return [dict(r) for r in cursor.fetchall()]

def get_all_promos(search: Optional[str] = None, status: Optional[str] = None) -> List[Dict[str, Any]]:
    with get_db() as conn:
        cursor = conn.cursor()
        query = "SELECT * FROM promo_codes WHERE 1=1"
        params = []
        
        if search:
            query += " AND (code LIKE ? OR player_name LIKE ? OR title LIKE ?)"
            term = f"%{search.strip()}%"
            params.extend([term, term, term])
            
        if status == 'active':
            query += " AND is_used = 0"
        elif status == 'used':
            query += " AND is_used = 1"
            
        query += " ORDER BY created_at DESC"
        cursor.execute(query, params)
        return [dict(r) for r in cursor.fetchall()]

def toggle_promo_status(promo_id: int) -> bool:
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT is_used FROM promo_codes WHERE id = ?", (promo_id,))
        row = cursor.fetchone()
        if not row:
            return False
            
        new_status = 0 if row['is_used'] else 1
        used_at = datetime.utcnow().isoformat() if new_status else None
        
        cursor.execute('''
            UPDATE promo_codes
            SET is_used = ?, used_at = ?
            WHERE id = ?
        ''', (new_status, used_at, promo_id))
        conn.commit()
        return True

def get_leaderboard(timeframe: str = 'weekly', limit: int = 10) -> List[Dict[str, Any]]:
    with get_db() as conn:
        cursor = conn.cursor()
        if timeframe == 'weekly':
            one_week_ago = (datetime.utcnow() - timedelta(days=7)).isoformat()
            cursor.execute('''
                SELECT sr.player_name as name, MAX(sr.score) as top_score, MAX(sr.max_combo) as best_combo,
                       COUNT(sr.id) as sessions_count, MAX(sr.created_at) as achieved_at
                FROM score_records sr
                WHERE sr.created_at >= ?
                GROUP BY sr.player_name
                ORDER BY top_score DESC
                LIMIT ?
            ''', (one_week_ago, limit))
        else:
            cursor.execute('''
                SELECT p.name as name, p.highest_score as top_score, p.max_combo as best_combo,
                       p.games_played as sessions_count, p.updated_at as achieved_at
                FROM players p
                WHERE p.highest_score > 0
                ORDER BY p.highest_score DESC
                LIMIT ?
            ''', (limit,))
            
        rows = cursor.fetchall()
        result = []
        for rank, r in enumerate(rows, 1):
            d = dict(r)
            d['rank'] = rank
            result.append(d)
        return result
