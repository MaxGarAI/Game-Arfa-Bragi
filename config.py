import os
from pathlib import Path

# Base directory
BASE_DIR = Path(__file__).resolve().parent

class Config:
    # Flask Secret Key
    SECRET_KEY = os.environ.get('SECRET_KEY', 'bragi-harp-viking-secret-key-2026-nordic-brewery')
    
    # SQLite Database
    DB_NAME = 'bragi_brewery.db'
    DB_PATH = BASE_DIR / DB_NAME
    
    # Shop integration URL (craft brewery store link)
    SHOP_URL = os.environ.get('SHOP_URL', 'https://arfabragi.ru')
    
    # Admin Panel credentials
    ADMIN_PASSWORD = os.environ.get('ADMIN_PASSWORD', 'skald_secret_2026')
    
    # Brewery details
    BREWERY_NAME = 'АРФА БРАГИ'
    BREWERY_TAGLINE = 'Крафтовая пивоварня & Чертог Раков'
    BREWERY_CITY = 'г. Майкоп, ул. Победа, 171'
    BREWERY_PHONE = '+7 (902) 406-90-09'
    
    # Anti-cheat thresholds
    MAX_GAME_DURATION_SEC = 90
    MIN_GAME_DURATION_SEC = 15
    MAX_SCORE_PER_SECOND = 400
    MAX_POSSIBLE_SCORE = 30000
    
    # Currency conversion (Points -> Mead)
    POINTS_PER_MEAD = 100
    
    # Daily streak mead rewards (Day 1 through Day 7+)
    DAILY_STREAK_REWARDS = [30, 50, 75, 100, 150, 200, 300]
    
    # In-game Upgrades
    UPGRADES = {
        'harp_strings': {
            'id': 'harp_strings',
            'name': 'Струны Браги',
            'desc': '+20% очков за каждое попадание по руне',
            'icon': '🎻',
            'cost': 120,
            'max_level': 5,
            'multiplier_per_level': 0.20
        },
        'drinking_horn': {
            'id': 'drinking_horn',
            'name': 'Рог Эгира',
            'desc': '+25% медовухи за каждую игровую сессию',
            'icon': '📯',
            'cost': 150,
            'max_level': 5,
            'multiplier_per_level': 0.25
        },
        'odin_blessing': {
            'id': 'odin_blessing',
            'name': 'Благословение Одина',
            'desc': 'Замедление времени на 5 сек (расходуемый свиток)',
            'icon': '⚡',
            'cost': 80,
            'max_level': 10,
            'is_consumable': True
        },
        'brewery_beer': {
            'id': 'brewery_beer',
            'name': 'Свежий крафт с пивоварни',
            'desc': '+20% ко всем очкам и медовухе на следующие 3 игры',
            'icon': '🍺',
            'cost': 100,
            'charges': 3,
            'bonus_ratio': 0.20
        }
    }
    
    # Promo codes exchange tiers
    PROMO_TIERS = {
        'BRAGI5': {
            'id': 'BRAGI5',
            'title': 'Скидка 5% на крафтовое пиво',
            'desc': 'Идеально для дегустации любого авторского сорта',
            'mead_cost': 150,
            'discount_percent': 5,
            'prefix': 'BRAGI5',
            'badge': 'Новичок'
        },
        'BRAGI10': {
            'id': 'BRAGI10',
            'title': 'Скидка 10% на весь чек',
            'desc': 'Хитовый промокод скальда на все сорта и напитки',
            'mead_cost': 300,
            'discount_percent': 10,
            'prefix': 'BRAGI10',
            'badge': 'Популярный'
        },
        'SKALD15': {
            'id': 'SKALD15',
            'title': 'Скидка 15% на крафтовый набор',
            'desc': 'Достойно истинного певца чертогов Браги',
            'mead_cost': 500,
            'discount_percent': 15,
            'prefix': 'SKALD15',
            'badge': 'Мастер'
        },
        'ODIN20': {
            'id': 'ODIN20',
            'title': 'Скидка 20% — Дар Всеотца',
            'desc': 'Максимальная скидка в магазине на всю корзину',
            'mead_cost': 1000,
            'discount_percent': 20,
            'prefix': 'ODIN20',
            'badge': 'Легенда'
        },
        'CRAYFISH_GIFT': {
            'id': 'CRAYFISH_GIFT',
            'title': 'Подарочные раки к пиву',
            'desc': 'Бесплатная порция фирменных варёных раков к заказу пива',
            'mead_cost': 750,
            'discount_percent': 100,
            'prefix': 'RAKI-GIFT',
            'badge': 'Деликатес'
        }
    }

    # Beers for showcase
    FEATURED_BEERS = [
        {
            'id': 1,
            'name': 'СОЛНЦЕ ДОМОВ',
            'style': 'Светлый лагер • Классика',
            'desc': 'Золотистый, кристально чистый лагер с мягким зерновым телом и благородным цветочным шлейфом хмеля. Освежает, как утренний бриз фьордов.',
            'abv': '4.5%',
            'density': '11%',
            'ibu': '18 IBU',
            'price': '145 ₽',
            'image': 'beers/beer_solnce.jpg',
            'pairing': 'Идеально к классическим варёным ракам с укропом'
        },
        {
            'id': 2,
            'name': 'БЕРЕГ МЕЧЕЙ',
            'style': 'Нефильтрованное • Weizen',
            'desc': 'Плотное туманное пшеничное пиво с бархатистой кремовой шапкой. В букете раскрываются ноты банана, гвоздики и свежеиспеченного хлеба.',
            'abv': '4.8%',
            'density': '12%',
            'ibu': '14 IBU',
            'price': '155 ₽',
            'image': 'beers/beer_bereg.jpg',
            'pairing': 'Прекрасно к сочным крупным ракам и сырным снекам'
        },
        {
            'id': 3,
            'name': 'ВОЛШЕБНЫЙ ТРУТ',
            'style': 'Полутёмный эль • Caramel Amber',
            'desc': 'Глубокий медно-янтарный цвет. Насыщенный вкус с карамельной сладостью жженого солода, теплыми бисквитными тонами и пряным послевкусием.',
            'abv': '5.2%',
            'density': '13%',
            'ibu': '22 IBU',
            'price': '167 ₽',
            'image': 'beers/beer_trut.jpg',
            'pairing': 'Изумительно гармонирует с раками фирменной варки в пиве'
        },
        {
            'id': 4,
            'name': 'МОЛОТ ТОРА',
            'style': 'Двойной IPA • Сила Асгарда',
            'desc': 'Мощный охмеленный крафт с цитрусово-хвойным взрывом аромата, плотной солодовой базой и бескомпромиссной северной горечью.',
            'abv': '7.2%',
            'density': '17%',
            'ibu': '55 IBU',
            'price': '195 ₽',
            'image': 'brewery_tanks.png',
            'pairing': 'Создан для сытных мясных закусок и острых соусов'
        }
    ]
