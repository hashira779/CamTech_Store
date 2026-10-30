import urllib.request
import json

req = urllib.request.Request(
    'http://127.0.0.1:4000/api/v1/auth/login',
    data=json.dumps({'email': 'admin@demo.test', 'password': 'Admin123!'}).encode('utf-8'),
    headers={'Content-Type': 'application/json'}
)
with urllib.request.urlopen(req) as resp:
    data = json.loads(resp.read().decode('utf-8'))
    token = data['data']['accessToken']
    print('Login success! Token acquired.')

headers = {'Authorization': f'Bearer {token}'}

for path in ['/api/v1/developers/keys', '/api/v1/developers/webhooks', '/api/v1/developers/apps']:
    req = urllib.request.Request(f'http://127.0.0.1:4000{path}', headers=headers)
    with urllib.request.urlopen(req) as resp:
        body = json.loads(resp.read().decode('utf-8'))
        print(f'{path} -> HTTP {resp.status} - success: {body.get("success")} - count: {len(body.get("data", []))}')
