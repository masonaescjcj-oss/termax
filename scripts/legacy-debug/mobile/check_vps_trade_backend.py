import paramiko
import os
import sys

host = "45.129.126.98"
username = "root"
password = "02ZZds9PWYj3"
output_file = r"c:\Users\asiac\OneDrive\Desktop\trade (2)\trade\mobile\trade_backend_check.txt"

with open(output_file, "w", encoding="utf-8") as f:
    try:
        f.write(f"Connecting to VPS {host}...\n")
        ssh = paramiko.SSHClient()
        ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        ssh.connect(host, username=username, password=password, timeout=15)
        
        cmds = {
            "Directory Listing": "ls -la /root/trade-backend",
            "Dist Directory": "ls -la /root/trade-backend/dist 2>/dev/null",
            "Node Modules Telegram Bot": "ls -la /root/trade-backend/node_modules/node-telegram-bot-api 2>/dev/null",
            "PM2 List": "pm2 list",
            "Test Node Execution": "cd /root/trade-backend && node -e \"console.log('Node works:', process.version)\""
        }
        
        for name, cmd in cmds.items():
            f.write(f"\n=== {name} ({cmd}) ===\n")
            stdin, stdout, stderr = ssh.exec_command(cmd)
            f.write("STDOUT:\n" + stdout.read().decode('utf-8', errors='ignore'))
            f.write("STDERR:\n" + stderr.read().decode('utf-8', errors='ignore'))
            
        ssh.close()
        f.write("\nDONE!\n")
    except Exception as e:
        f.write(f"Error: {e}\n")
