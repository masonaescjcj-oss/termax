import urllib.request
import json
import ssl
import os

def get_bot_info():
    token = os.environ['TELEGRAM_BOT_TOKEN']
    url = f"https://api.telegram.org/bot{token}/getMe"
    
    ctx = ssl.create_default_context()
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, context=ctx) as response:
            data = json.loads(response.read().decode('utf-8'))
            if data.get("ok"):
                bot = data["result"]
                print(f"BOT_USERNAME: {bot.get('username')}")
                print(f"BOT_NAME: {bot.get('first_name')}")
            else:
                print(f"ERROR: {data}")
    except Exception as e:
        print(f"Error fetching bot info: {e}")

if __name__ == '__main__':
    get_bot_info()
