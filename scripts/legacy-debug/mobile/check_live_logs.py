import paramiko
import sys

sys.stdout.reconfigure(encoding='utf-8')

host = "45.129.126.98"
username = "root"
password = "02ZZds9PWYj3"

try:
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(host, username=username, password=password, timeout=15)
    
    stdin, stdout, stderr = ssh.exec_command("tail -n 25 ~/.pm2/logs/trade-backend-out.log")
    print("=== BACKEND LOGS ===")
    print(stdout.read().decode('utf-8', errors='ignore'))
    
    stdin, stdout, stderr = ssh.exec_command("tail -n 20 ~/.pm2/logs/trade-backend-error.log")
    print("=== BACKEND ERRORS ===")
    print(stdout.read().decode('utf-8', errors='ignore'))
    
    ssh.close()
except Exception as e:
    print(f"Error: {e}")
