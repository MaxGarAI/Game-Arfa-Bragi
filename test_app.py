import sys
import json

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

from app import app
from models import get_db

client = app.test_client()

# 1. Test index page
r_index = client.get('/')
assert r_index.status_code == 200, f'Index failed: {r_index.status_code}'
assert 'АРФА БРАГИ' in r_index.data.decode('utf-8')
print('✓ GET / OK')

# 2. Test game page
r_game = client.get('/game')
assert r_game.status_code == 200, f'Game failed: {r_game.status_code}'
assert 'gameCanvas' in r_game.data.decode('utf-8')
print('✓ GET /game OK')

# 3. Test leaderboard page
r_leaderboard = client.get('/leaderboard')
assert r_leaderboard.status_code == 200, f'Leaderboard failed: {r_leaderboard.status_code}'
assert 'Эгиль Скаллагримссон' in r_leaderboard.data.decode('utf-8')
print('✓ GET /leaderboard OK')

# 4. Test rewards page
r_rewards = client.get('/rewards')
assert r_rewards.status_code == 200, f'Rewards failed: {r_rewards.status_code}'
assert 'BRAGI10' in r_rewards.data.decode('utf-8')
print('✓ GET /rewards OK')

# 5. Test admin promos page
r_admin_unauth = client.get('/admin/promos')
assert r_admin_unauth.status_code == 200
assert 'Пароль Ярла' in r_admin_unauth.data.decode('utf-8')

r_admin_auth = client.get('/admin/promos?key=skald_secret_2026')
assert r_admin_auth.status_code == 200
assert 'ВЫДАННЫЕ ПРОМОКОДЫ' in r_admin_auth.data.decode('utf-8')
print('✓ GET /admin/promos OK')

# 6. Test API: me
uuid = 'test_skald_42'
r_me = client.get(f'/api/me?uuid={uuid}')
assert r_me.status_code == 200
me_data = json.loads(r_me.data)
assert me_data['player']['uuid'] == uuid
print('✓ GET /api/me OK')

# 7. Test API: score
score_payload = {
    'uuid': uuid,
    'score': 3500,
    'combo': 28,
    'runes_hit': 18,
    'accuracy': 95.5,
    'duration_seconds': 45
}
r_score = client.post('/api/score', data=json.dumps(score_payload), content_type='application/json')
assert r_score.status_code == 200
score_res = json.loads(r_score.data)
assert score_res['success'] is True
assert score_res['mead_earned'] > 0
print('✓ POST /api/score OK, earned mead:', score_res['mead_earned'])

# 8. Test API: claim daily
r_daily = client.post('/api/me/claim-daily', data=json.dumps({'uuid': uuid}), content_type='application/json')
assert r_daily.status_code == 200
daily_res = json.loads(r_daily.data)
print('✓ POST /api/me/claim-daily OK, success:', daily_res['success'])

# 9. Test API: buy upgrade
# Give player extra mead first
with get_db() as conn:
    conn.execute('UPDATE players SET mead = 1000 WHERE uuid = ?', (uuid,))
    conn.commit()

r_upg = client.post('/api/me/upgrade', data=json.dumps({'uuid': uuid, 'upgrade_id': 'harp_strings'}), content_type='application/json')
assert r_upg.status_code == 200
upg_res = json.loads(r_upg.data)
assert upg_res['success'] is True
print('✓ POST /api/me/upgrade OK, success:', upg_res['success'])

# 10. Test API: promo code generation
r_promo = client.post('/api/promo', data=json.dumps({'uuid': uuid, 'tier_id': 'BRAGI10'}), content_type='application/json')
assert r_promo.status_code == 200
promo_res = json.loads(r_promo.data)
assert promo_res['success'] is True
assert promo_res['promo_code'].startswith('BRAGI10-')
print('✓ POST /api/promo OK, generated code:', promo_res['promo_code'])

print('\n🎉 ВСЕ ТЕСТЫ УСПЕШНО ПРОЙДЕНЫ!')
