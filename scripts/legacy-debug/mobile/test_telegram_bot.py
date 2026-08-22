import urllib.request
import json
import os

token = os.environ['TELEGRAM_BOT_TOKEN']

def test_telegram():
    try:
        req = urllib.request.Request(f'https://api.telegram.org/bot{token}/getMe')
        with urllib.request.urlopen(req) as res:
            data = json.loads(res.read().decode('utf-8'))
            print("Telegram getMe result:")
            print(json.dumps(data, indent=2))
    except Exception as e:
        print("Error getMe:", e)
        if hasattr(e, 'read'):
            print("Response:", e.read().decode('utf-8'))
            
    try:
        req = urllib.request.Request(f'https://api.telegram.org/bot{token}/getWebhookInfo')
        with urllib.request.urlopen(req) as res:
            data = json.loads(res.read().decode('utf-8'))
            print("Telegram getWebhookInfo result:")
            print(json.dumps(data, indent=2))
    except Exception as e:
        print("Error getWebhookInfo:", e)
        if hasattr(e, 'read'):
            print("Response:", e.read().decode('utf-8'))

test_telegram()
