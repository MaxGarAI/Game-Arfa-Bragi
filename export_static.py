"""
Export static HTML version to docs/ directory for GitHub Pages hosting.
Allows the game to be played directly on any smartphone with zero server requirements.
"""

import os
import sys
import shutil
from pathlib import Path

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

from app import app

BASE_DIR = Path(__file__).resolve().parent
DOCS_DIR = BASE_DIR / 'docs'

def export_site():
    print("🚀 Генерация статической версии для GitHub Pages в папку docs/...")
    
    # 1. Clean or create docs directory
    if DOCS_DIR.exists():
        shutil.rmtree(DOCS_DIR)
    DOCS_DIR.mkdir(parents=True, exist_ok=True)

    # 2. Copy entire static directory
    shutil.copytree(BASE_DIR / 'static', DOCS_DIR / 'static')
    print("📁 Папка static/ скопирована в docs/static/")

    # 3. Render HTML templates via Flask test client
    client = app.test_client()

    pages = {
        '/': 'index.html',
        '/game': 'game.html',
        '/rewards': 'rewards.html',
        '/leaderboard': 'leaderboard.html'
    }

    replacements = [
        ('href="/"', 'href="index.html"'),
        ('href="/game"', 'href="game.html"'),
        ('href="/rewards"', 'href="rewards.html"'),
        ('href="/leaderboard"', 'href="leaderboard.html"'),
        ('action="/admin/promos"', 'action="#"'),
        ('/static/', 'static/'),
    ]

    for route, filename in pages.items():
        res = client.get(route)
        if res.status_code == 200:
            content = res.data.decode('utf-8')
            for target, rep in replacements:
                content = content.replace(target, rep)
            
            target_file = DOCS_DIR / filename
            with open(target_file, 'w', encoding='utf-8') as f:
                f.write(content)
            print(f"📄 Сгенерирована страница docs/{filename}")
        else:
            print(f"❌ Ошибка рендера {route}: {res.status_code}")

    # Add .nojekyll so GitHub Pages doesn't ignore static files or underscores
    with open(DOCS_DIR / '.nojekyll', 'w', encoding='utf-8') as f:
        f.write('')

    print("\n✨ Статическая сборка успешно создана в docs/!")
    print("В репозитории GitHub: Settings -> Pages -> Branch: main, Folder: /docs -> Save.")

if __name__ == '__main__':
    export_site()
