import paramiko
import os

host = "45.129.126.98"
username = "root"
password = "02ZZds9PWYj3"
output_path = r"C:\Users\asiac\.gemini\antigravity\brain\3d5f45d3-07a7-4ff6-b197-6d35b0fd137d\scratch\vps_logs.txt"

# Ensure parent directory exists
os.makedirs(os.path.dirname(output_path), exist_ok=True)

try:
    print(f"Connecting to VPS {host}...")
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(host, username=username, password=password, timeout=30)
    
    print("Executing tail commands for PM2 logs...")
    # Find PM2 log files by listing ~/.pm2/logs/
    stdin, stdout, stderr = ssh.exec_command("ls -la ~/.pm2/logs/")
    files_list = stdout.read().decode('utf-8', errors='ignore')
    print("Available log files:\n" + files_list)
    
    # We will grab the last 100 lines of error and out logs
    stdin, stdout, stderr = ssh.exec_command("tail -n 150 ~/.pm2/logs/trade-backend-error.log")
    err_content = stdout.read().decode('utf-8', errors='ignore')
    
    stdin, stdout, stderr = ssh.exec_command("tail -n 150 ~/.pm2/logs/trade-backend-out.log")
    out_content = stdout.read().decode('utf-8', errors='ignore')
    
    stdin, stdout, stderr = ssh.exec_command("pm2 status")
    pm2_status = stdout.read().decode('utf-8', errors='ignore')
    
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write("=== PM2 STATUS ===\n")
        f.write(pm2_status)
        f.write("\n=== PM2 ERRORS ===\n")
        f.write(err_content)
        f.write("\n=== PM2 OUTPUT ===\n")
        f.write(out_content)
        
    print(f"Logs successfully written to {output_path}")
    ssh.close()
except Exception as e:
    print(f"Error: {e}")
