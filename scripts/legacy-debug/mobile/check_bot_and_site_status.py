import paramiko
import urllib.request
import ssl
import json
import sys
import os

sys.stdout.reconfigure(encoding='utf-8')

host = "45.129.126.98"
username = "root"
password = "02ZZds9PWYj3"

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

print("1. Testing Vercel Website URL...")
vercel_url = "https://dist-5adzq15u3-isaacs-projects-dad539ec.vercel.app"
try:
    req = urllib.request.Request(vercel_url, headers={'User-Agent': 'Mozilla/5.0'})
    with urllib.request.urlopen(req, context=ctx, timeout=10) as resp:
        print("Vercel HTTP Status:", resp.status)
        content = resp.read().decode('utf-8', errors='ignore')
        print("Vercel Content Length:", len(content))
except Exception as e:
    print("Vercel Error:", e)

print("\n2. Testing Backend Server Health & PM2...")
try:
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(host, username=username, password=password, timeout=15)
    
    cmds = {
        "PM2 List": "pm2 list",
        "Backend PM2 Logs (Last 50 lines)": "tail -n 50 ~/.pm2/logs/trade-backend-out.log",
        "Backend Error Logs (Last 50 lines)": "tail -n 50 ~/.pm2/logs/trade-backend-error.log",
        "Backend Health Check": "curl -s http://localhost:5000/api/health"
    }
    
    for name, cmd in cmds.items():
        print(f"\n--- {name} ({cmd}) ---")
        stdin, stdout, stderr = ssh.exec_command(cmd)
        out = stdout.read().decode('utf-8', errors='ignore')
        err = stderr.read().decode('utf-8', errors='ignore')
        if out: print("STDOUT:\n" + out.strip())
        if err: print("STDERR:\n" + err.strip())
        
    ssh.close()
except Exception as e:
    print("VPS Connection Error:", e)

print("\n3. Testing Telegram Bot API getMe...")
bot_token = os.environ['TELEGRAM_BOT_TOKEN']
bot_api_url = f"https://api.telegram.org/bot{bot_token}/getMe"
try:
    req = urllib.request.Request(bot_api_url, headers={'User-Agent': 'Mozilla/5.0'})
    with urllib.request.urlopen(req, context=ctx, timeout=10) as resp:
        data = json.loads(resp.read().decode('utf-8'))
        print("Telegram Bot getMe Response:", data)
except Exception as e:
    print("Telegram Bot API Error:", e)
