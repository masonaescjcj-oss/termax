import paramiko
import os

host = "45.129.126.98"
username = "root"
password = "02ZZds9PWYj3"
output_file = r"c:\Users\asiac\OneDrive\Desktop\trade (2)\trade\mobile\health_check_result.txt"

with open(output_file, "w", encoding="utf-8") as f:
    try:
        ssh = paramiko.SSHClient()
        ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        ssh.connect(host, username=username, password=password, timeout=15)
        
        cmds = {
            "Localhost Health": "curl -s http://127.0.0.1:5000/api/health",
            "Public HTTPS Health": "curl -s -k https://45-129-126-98.sslip.io/api/health",
            "PM2 Status": "pm2 status",
            "Recent Backend Output Logs": "tail -n 25 ~/.pm2/logs/trade-backend-out.log"
        }
        
        for name, cmd in cmds.items():
            f.write(f"\n=== {name} ({cmd}) ===\n")
            stdin, stdout, stderr = ssh.exec_command(cmd)
            f.write("STDOUT:\n" + stdout.read().decode('utf-8', errors='ignore') + "\n")
            f.write("STDERR:\n" + stderr.read().decode('utf-8', errors='ignore') + "\n")
            
        ssh.close()
        f.write("\nDONE!\n")
    except Exception as e:
        f.write(f"Error: {e}\n")
