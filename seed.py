"""
Seed script for «Арфа Браги» (Bragi's Harp).
Populates the database with legendary Norse skalds, demo scores, and sample promo codes.
"""

import sys
import random
from datetime import datetime, timedelta

# Ensure UTF-8 output on Windows consoles
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

from config import Config
from models import init_db, get_db, generate_random_promo_code

LEGENDARY_SKALDS = [
    {"name": "Эгиль Скаллагримссон", "score": 18450, "combo": 112, "mead": 980},
    {"name": "Браги Краснобородый", "score": 16200, "combo": 98, "mead": 840},
    {"name": "Рагнар Лодброк", "score": 14750, "combo": 89, "mead": 760},
    {"name": "Лагерта Щитоносец", "score": 13900, "combo": 84, "mead": 720},
    {"name": "Бьорн Железнобокий", "score": 12400, "combo": 76, "mead": 650},
    {"name": "Снорри Стурлусон", "score": 11100, "combo": 68, "mead": 590},
    {"name": "Фрейдис Эриксдоттир", "score": 9850, "combo": 61, "mead": 510},
    {"name": "Торфинн Карлсефни", "score": 8700, "combo": 55, "mead": 440},
    {"name": "Харальд Прекрасноволосый", "score": 7950, "combo": 48, "mead": 390},
    {"name": "Ивар Бескостный", "score": 6800, "combo": 42, "mead": 320},
    {"name": "Сигурд Змееглазый", "score": 5900, "combo": 38, "mead": 280},
    {"name": "Эрик Рыжий", "score": 4650, "combo": 31, "mead": 230},
    {"name": "Хельги Мудрый", "score": 3400, "combo": 24, "mead": 170},
    {"name": "Астрид Светлоокая", "score": 2600, "combo": 19, "mead": 130},
    {"name": "Гудрун Певунья", "score": 1950, "combo": 14, "mead": 90}
]

def seed_database():
    print("⚔️ Инициализация базы данных Чертога Браги...")
    init_db()

    with get_db() as conn:
        cursor = conn.cursor()

        # Clear existing demo data to prevent duplication
        cursor.execute("DELETE FROM score_records")
        cursor.execute("DELETE FROM promo_codes")
        cursor.execute("DELETE FROM achievements")
        cursor.execute("DELETE FROM players")
        conn.commit()

        print("📜 Заселение легендарных скальдов и результатов игр...")
        now = datetime.utcnow()

        for idx, skald in enumerate(LEGENDARY_SKALDS, 1):
            uuid = f"skald_legend_{idx}"
            games_played = random.randint(3, 18)
            streak = random.randint(1, 7)
            strings_lvl = random.randint(1, 4)
            horn_lvl = random.randint(1, 3)

            # Insert player
            cursor.execute('''
                INSERT INTO players (
                    uuid, name, score, highest_score, mead, total_mead,
                    games_played, max_combo, streak_days, harp_strings_lvl, horn_lvl, odin_blessings
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                uuid, skald['name'], skald['score'], skald['score'], skald['mead'],
                skald['mead'] + random.randint(100, 400), games_played, skald['combo'],
                streak, strings_lvl, horn_lvl, random.randint(1, 3)
            ))
            player_id = cursor.lastrowid

            # Insert score record for weekly leaderboard (spread over last 6 days)
            days_ago = random.uniform(0.1, 5.8)
            record_time = (now - timedelta(days=days_ago)).isoformat()
            runes_hit = int(skald['score'] / random.uniform(120, 160))
            accuracy = round(random.uniform(91.5, 99.4), 1)
            mead_earned = int(skald['score'] / 100)

            cursor.execute('''
                INSERT INTO score_records (
                    player_id, player_name, score, max_combo, runes_hit, accuracy, mead_earned, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                player_id, skald['name'], skald['score'], skald['combo'], runes_hit, accuracy, mead_earned, record_time
            ))

            # Insert sample achievements
            cursor.execute("INSERT INTO achievements (player_id, achievement_key) VALUES (?, 'first_saga')", (player_id,))
            if skald['score'] >= 5000:
                cursor.execute("INSERT INTO achievements (player_id, achievement_key) VALUES (?, 'bragi_favorite')", (player_id,))
            if skald['combo'] >= 50:
                cursor.execute("INSERT INTO achievements (player_id, achievement_key) VALUES (?, 'combo_50')", (player_id,))

        print("🍺 Генерация демонстрационных промокодов...")
        demo_promo_tiers = ['BRAGI5', 'BRAGI10', 'SKALD15', 'ODIN20', 'CRAYFISH_GIFT']

        for i in range(12):
            tier_key = random.choice(demo_promo_tiers)
            tier_info = Config.PROMO_TIERS[tier_key]
            code = generate_random_promo_code(tier_info['prefix'])
            is_used = 1 if i in (1, 4, 7) else 0
            used_at = (now - timedelta(hours=random.randint(1, 48))).isoformat() if is_used else None
            random_skald = random.choice(LEGENDARY_SKALDS)

            cursor.execute('''
                INSERT INTO promo_codes (
                    code, reward_tier, title, discount_percent, mead_cost,
                    player_name, is_used, created_at, used_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                code, tier_key, tier_info['title'], tier_info['discount_percent'],
                tier_info['mead_cost'], random_skald['name'], is_used,
                (now - timedelta(days=random.uniform(0.2, 4.0))).isoformat(), used_at
            ))

        conn.commit()

    print("✨ База данных успешно наполнена!")
    print(f"👑 Топ скальд недели: {LEGENDARY_SKALDS[0]['name']} ({LEGENDARY_SKALDS[0]['score']} очков)")
    print(f"🔑 Пароль от админки промокодов: {Config.ADMIN_PASSWORD}")

if __name__ == '__main__':
    seed_database()
