import paramiko
import os

host = "45.129.126.98"
username = "root"
password = "02ZZds9PWYj3"
output_path = r"C:\Users\asiac\.gemini\antigravity\brain\3d5f45d3-07a7-4ff6-b197-6d35b0fd137d\scratch\vps_check_status.txt"

# Ensure parent directory exists
os.makedirs(os.path.dirname(output_path), exist_ok=True)

try:
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(host, username=username, password=password, timeout=30)
    
    # 1. Cat .env
    stdin, stdout, stderr = ssh.exec_command("cat /root/trade-backend/.env")
    env_content = stdout.read().decode('utf-8', errors='ignore')
    
    # 2. Run pm2 status
    stdin, stdout, stderr = ssh.exec_command("pm2 status")
    pm2_status = stdout.read().decode('utf-8', errors='ignore')
    
    # 3. Check logs (last 50 lines of err and out)
    stdin, stdout, stderr = ssh.exec_command("tail -n 50 ~/.pm2/logs/trade-backend-error.log")
    err_content = stdout.read().decode('utf-8', errors='ignore')
    
    stdin, stdout, stderr = ssh.exec_command("tail -n 50 ~/.pm2/logs/trade-backend-out.log")
    out_content = stdout.read().decode('utf-8', errors='ignore')
    
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write("=== SERVER .ENV ===\n")
        f.write(env_content)
        f.write("\n=== PM2 STATUS ===\n")
        f.write(pm2_status)
        f.write("\n=== PM2 ERRORS ===\n")
        f.write(err_content)
        f.write("\n=== PM2 OUTPUT ===\n")
        f.write(out_content)
        
    print(f"Status check written to {output_path}")
    ssh.close()
except Exception as e:
    print(f"Error: {e}")
