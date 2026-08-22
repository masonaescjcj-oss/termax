import paramiko
import os
import sys

sys.stdout.reconfigure(encoding='utf-8')

host = "45.129.126.98"
username = "root"
password = "02ZZds9PWYj3"

try:
    print(f"Connecting to VPS {host}...")
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(host, username=username, password=password, timeout=30)
    
    commands = {
        "PM2 Status": "pm2 status",
        "Running Node Processes": "ps aux | grep node",
        "Listening Ports": "ss -tuln",
        "Caddyfile": "cat /etc/caddy/Caddyfile 2>/dev/null || cat /etc/caddy/caddyfile 2>/dev/null",
        "Trade Backend Directory": "ls -la /root/trade-backend 2>/dev/null",
        "Trade Backend Logs": "tail -n 40 /root/trade-backend/backend_log.txt 2>/dev/null || tail -n 40 ~/.pm2/logs/trade-backend-out.log 2>/dev/null"
    }
    
    for title, cmd in commands.items():
        print(f"\n--- {title} ({cmd}) ---")
        stdin, stdout, stderr = ssh.exec_command(cmd)
        out = stdout.read().decode('utf-8', errors='ignore')
        err = stderr.read().decode('utf-8', errors='ignore')
        if out:
            print(out.strip())
        if err:
            print("ERR:", err.strip())
            
    ssh.close()
except Exception as e:
    print(f"Error: {e}")
