import paramiko
import os
import sys
import time

host = "45.129.126.98"
username = "root"
password = "02ZZds9PWYj3"
output_file = r"c:\Users\asiac\OneDrive\Desktop\trade (2)\trade\mobile\start_backend_result.txt"

with open(output_file, "w", encoding="utf-8") as f:
    try:
        f.write(f"Connecting to VPS {host}...\n")
        ssh = paramiko.SSHClient()
        ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        ssh.connect(host, username=username, password=password, timeout=15)
        
        # 1. Start trade-backend in PM2 without disturbing process 0 (prediction-arena-backend)
        f.write("\n=== Starting trade-backend with PM2 ===\n")
        stdin, stdout, stderr = ssh.exec_command("cd /root/trade-backend && pm2 start dist/server.js --name trade-backend && pm2 save")
        f.write("STDOUT:\n" + stdout.read().decode('utf-8', errors='ignore'))
        f.write("STDERR:\n" + stderr.read().decode('utf-8', errors='ignore'))
        
        time.sleep(3)
        
        # 2. Check PM2 list
        f.write("\n=== Updated PM2 List ===\n")
        stdin, stdout, stderr = ssh.exec_command("pm2 list")
        f.write("STDOUT:\n" + stdout.read().decode('utf-8', errors='ignore'))
        
        # 3. Test HTTP health endpoint on port 5000
        f.write("\n=== Testing HTTP Health Endpoint (curl http://localhost:5000/api/health) ===\n")
        stdin, stdout, stderr = ssh.exec_command("curl -s http://localhost:5000/api/health")
        f.write("STDOUT:\n" + stdout.read().decode('utf-8', errors='ignore'))
        f.write("\nSTDERR:\n" + stderr.read().decode('utf-8', errors='ignore'))
        
        # 4. Check PM2 logs for trade-backend
        f.write("\n=== Trade Backend Logs (tail -n 30 ~/.pm2/logs/trade-backend-out.log) ===\n")
        stdin, stdout, stderr = ssh.exec_command("tail -n 30 ~/.pm2/logs/trade-backend-out.log")
        f.write("STDOUT:\n" + stdout.read().decode('utf-8', errors='ignore'))
        
        f.write("\n=== Trade Backend Errors (tail -n 30 ~/.pm2/logs/trade-backend-error.log) ===\n")
        stdin, stdout, stderr = ssh.exec_command("tail -n 30 ~/.pm2/logs/trade-backend-error.log")
        f.write("STDOUT:\n" + stdout.read().decode('utf-8', errors='ignore'))

        ssh.close()
        f.write("\nDONE!\n")
    except Exception as e:
        f.write(f"Error: {e}\n")
