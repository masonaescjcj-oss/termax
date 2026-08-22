import paramiko
import os

host = "45.129.126.98"
username = "root"
password = "02ZZds9PWYj3"
output_path = r"C:\Users\asiac\.gemini\antigravity\brain\3d5f45d3-07a7-4ff6-b197-6d35b0fd137d\scratch\vps_env.txt"

# Ensure parent directory exists
os.makedirs(os.path.dirname(output_path), exist_ok=True)

try:
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(host, username=username, password=password, timeout=30)
    
    # Read the .env file
    stdin, stdout, stderr = ssh.exec_command("cat /root/trade-backend/.env")
    env_content = stdout.read().decode('utf-8', errors='ignore')
    
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(env_content)
        
    print(f"Server .env successfully written to {output_path}")
    ssh.close()
except Exception as e:
    print(f"Error: {e}")
