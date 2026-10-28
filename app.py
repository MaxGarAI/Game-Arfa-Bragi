import os
import glob
from pathlib import Path
from flask import Flask, render_template, request, jsonify, session, redirect, url_for, flash
from config import Config
from models import (
    init_db,
    get_or_create_player,
    update_player_name,
    claim_daily_bonus,
    save_game_score,
    buy_upgrade,
    use_odin_blessing,
    exchange_mead_for_promo,
    get_player_promos,
    get_all_promos,
    toggle_promo_status,
    get_leaderboard
)

app = Flask(__name__)
app.config.from_object(Config)

# Ensure database is initialized
with app.app_context():
    init_db()

def discover_logo_assets():
    """
    Dynamically discover logo and emblem assets from static/logo/
    as requested in the branding requirements.
    """
    logo_dir = Path(app.root_path) / 'static' / 'logo'
    extensions = ('*.png', '*.svg', '*.webp', '*.jpg')
    all_files = []
    for ext in extensions:
        all_files.extend(logo_dir.glob(ext))
        
    filenames = [f.name for f in all_files]
    
    # Select main logo: prefer logo.png, logo_gold.png, or any starting with logo
    main_logo = 'logo.png'
    if 'logo_gold.png' in filenames:
        main_logo = 'logo_gold.png'
    elif 'logo.png' in filenames:
        main_logo = 'logo.png'
    elif any(f.startswith('logo') for f in filenames):
        main_logo = next(f for f in filenames if f.startswith('logo'))
    elif filenames:
        main_logo = filenames[0]
        
    # Select emblem: prefer emblem_gold.png, emblem.png, or fallback to main_logo
    emblem = main_logo
    if 'emblem_gold.png' in filenames:
        emblem = 'emblem_gold.png'
    elif 'emblem.png' in filenames:
        emblem = 'emblem.png'
    elif any(f.startswith('emblem') for f in filenames):
        emblem = next(f for f in filenames if f.startswith('emblem'))
        
    # Select favicon
    favicon = emblem
    if 'favicon.png' in filenames:
        favicon = 'favicon.png'
    elif 'favicon.ico' in filenames:
        favicon = 'favicon.ico'
        
    return {
        'main_logo': f'logo/{main_logo}',
        'emblem': f'logo/{emblem}',
        'favicon': f'logo/{favicon}',
        'all_logos': [f'logo/{f}' for f in filenames]
    }

@app.context_processor
def inject_global_context():
    """Provide branding, config and logos to all templates."""
    logos = discover_logo_assets()
    return {
        'config': Config,
        'logos': logos,
        'shop_url': Config.SHOP_URL,
        'brewery_name': Config.BREWERY_NAME,
        'brewery_tagline': Config.BREWERY_TAGLINE,
        'brewery_city': Config.BREWERY_CITY,
        'brewery_phone': Config.BREWERY_PHONE
    }

# ==========================================
# Frontend Page Routes
# ==========================================

@app.route('/')
def index():
    """Main showcase page for craft brewery with entry into the game."""
    return render_template(
        'index.html',
        featured_beers=Config.FEATURED_BEERS,
        promo_tiers=Config.PROMO_TIERS,
        daily_rewards=Config.DAILY_STREAK_REWARDS
    )

@app.route('/game')
def game():
    """Bragi's Harp rhythm clicker game canvas page."""
    return render_template(
        'game.html',
        upgrades=Config.UPGRADES
    )

@app.route('/leaderboard')
def leaderboard():
    """Skald Hall of Fame / Leaderboard."""
    weekly_top = get_leaderboard(timeframe='weekly', limit=15)
    all_time_top = get_leaderboard(timeframe='all_time', limit=15)
    return render_template(
        'leaderboard.html',
        weekly_top=weekly_top,
        all_time_top=all_time_top
    )

@app.route('/rewards')
def rewards():
    """Mead exchange for real brewery promo codes."""
    return render_template(
        'rewards.html',
        promo_tiers=Config.PROMO_TIERS
    )

@app.route('/admin/promos', methods=['GET', 'POST'])
def admin_promos():
    """
    Admin panel to view and manage generated promocodes.
    Protected by password from config.
    """
    # Check if authorized via session or query param
    auth_key = request.args.get('key')
    if auth_key == Config.ADMIN_PASSWORD:
        session['admin_authenticated'] = True
        
    if request.method == 'POST' and 'admin_password' in request.form:
        if request.form.get('admin_password') == Config.ADMIN_PASSWORD:
            session['admin_authenticated'] = True
            flash('Вход в чертог ярла выполнен успешно!', 'success')
            return redirect(url_for('admin_promos'))
        else:
            flash('Неверный пароль ярла!', 'error')
            
    is_admin = session.get('admin_authenticated', False)
    if not is_admin:
        return render_template('admin_login.html')
        
    search = request.args.get('search')
    status = request.args.get('status')
    promos = get_all_promos(search=search, status=status)
    
    total_promos = len(promos)
    used_count = sum(1 for p in promos if p['is_used'])
    active_count = total_promos - used_count
    
    return render_template(
        'admin_promos.html',
        promos=promos,
        total_promos=total_promos,
        used_count=used_count,
        active_count=active_count,
        search=search or '',
        status=status or 'all'
    )

@app.route('/admin/logout')
def admin_logout():
    session.pop('admin_authenticated', None)
    flash('Вы вышли из админ-панели', 'info')
    return redirect(url_for('admin_promos'))

@app.route('/admin/promos/toggle/<int:promo_id>', methods=['POST'])
def admin_toggle_promo(promo_id):
    if not session.get('admin_authenticated', False):
        return jsonify({'success': False, 'message': 'Unauthorized'}), 401
    success = toggle_promo_status(promo_id)
    return jsonify({'success': success})

# ==========================================
# REST API Endpoints
# ==========================================

@app.route('/api/me', methods=['GET'])
def api_me():
    """Retrieve player profile, stats, streak, upgrades, and achievements."""
    player_uuid = request.args.get('uuid') or request.headers.get('X-Player-UUID')
    if not player_uuid:
        return jsonify({'error': 'Missing player uuid'}), 400
        
    player = get_or_create_player(player_uuid)
    promos = get_player_promos(player['id'])
    player['claimed_promos'] = promos
    player['upgrades_catalog'] = Config.UPGRADES
    return jsonify({'player': player})

@app.route('/api/me/update-name', methods=['POST'])
def api_update_name():
    """Update player's skald name."""
    data = request.get_json() or {}
    player_uuid = data.get('uuid')
    name = data.get('name')
    if not player_uuid or not name:
        return jsonify({'success': False, 'message': 'Не указано имя'}), 400
        
    success = update_player_name(player_uuid, name)
    if success:
        return jsonify({'success': True, 'name': name.strip()})
    return jsonify({'success': False, 'message': 'Недопустимое имя'}), 400

@app.route('/api/me/claim-daily', methods=['POST'])
def api_claim_daily():
    """Claim daily login bonus mead."""
    data = request.get_json() or {}
    player_uuid = data.get('uuid')
    if not player_uuid:
        return jsonify({'success': False, 'message': 'Missing uuid'}), 400
    res = claim_daily_bonus(player_uuid)
    return jsonify(res)

@app.route('/api/me/upgrade', methods=['POST'])
def api_buy_upgrade():
    """Purchase an in-game skald upgrade using mead."""
    data = request.get_json() or {}
    player_uuid = data.get('uuid')
    upgrade_id = data.get('upgrade_id')
    if not player_uuid or not upgrade_id:
        return jsonify({'success': False, 'message': 'Invalid request'}), 400
    res = buy_upgrade(player_uuid, upgrade_id)
    return jsonify(res)

@app.route('/api/me/use-blessing', methods=['POST'])
def api_use_blessing():
    """Consume an Odin's Blessing scroll during gameplay."""
    data = request.get_json() or {}
    player_uuid = data.get('uuid')
    if not player_uuid:
        return jsonify({'success': False, 'message': 'Missing uuid'}), 400
    res = use_odin_blessing(player_uuid)
    return jsonify(res)

@app.route('/api/score', methods=['POST'])
def api_save_score():
    """
    Save game score after a session.
    Includes anti-cheat verification and calculates mead.
    """
    data = request.get_json() or {}
    player_uuid = data.get('uuid')
    score = int(data.get('score', 0))
    combo = int(data.get('combo', 0))
    runes_hit = int(data.get('runes_hit', 0))
    accuracy = float(data.get('accuracy', 0.0))
    duration = int(data.get('duration_seconds', 0))
    
    if not player_uuid:
        return jsonify({'success': False, 'message': 'Missing player uuid'}), 400
        
    result = save_game_score(
        player_uuid=player_uuid,
        score=score,
        max_combo=combo,
        runes_hit=runes_hit,
        accuracy=accuracy,
        duration_seconds=duration
    )
    return jsonify(result)

@app.route('/api/promo', methods=['POST'])
def api_exchange_promo():
    """Exchange mead for a server-generated unique promo code."""
    data = request.get_json() or {}
    player_uuid = data.get('uuid')
    tier_id = data.get('tier_id')
    
    if not player_uuid or not tier_id:
        return jsonify({'success': False, 'message': 'Неверные параметры запроса'}), 400
        
    result = exchange_mead_for_promo(player_uuid, tier_id)
    return jsonify(result)

@app.route('/api/leaderboard', methods=['GET'])
def api_leaderboard():
    """Get weekly or all-time leaderboard in JSON format."""
    timeframe = request.args.get('timeframe', 'weekly')
    limit = min(int(request.args.get('limit', 10)), 50)
    data = get_leaderboard(timeframe=timeframe, limit=limit)
    return jsonify({'leaderboard': data})

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=True)
