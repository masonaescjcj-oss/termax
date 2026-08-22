import paramiko
import os

local_file = r"c:\Users\asiac\OneDrive\Desktop\trade (2)\trade\backend\src\controllers\aiController.ts"
remote_file = "/root/trade-backend/src/controllers/aiController.ts"

print("Connecting to VPS via SSH...")
ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
try:
    ssh.connect('45.129.126.98', username='root', password='02ZZds9PWYj3')
    print("Connected successfully!")
    
    # SFTP Upload
    print("Uploading aiController.ts...")
    sftp = ssh.open_sftp()
    sftp.put(local_file, remote_file)
    sftp.close()
    print("Upload completed successfully!")
    
    # Build Backend
    print("Building backend on remote server...")
    stdin, stdout, stderr = ssh.exec_command("cd /root/trade-backend && npm run build")
    build_out = stdout.read().decode('utf-8', errors='ignore')
    build_err = stderr.read().decode('utf-8', errors='ignore')
    print("Build Output:\n", build_out)
    if build_err:
        print("Build Errors:\n", build_err)
        
    # Restart server via PM2
    print("Restarting trade-backend PM2 process...")
    stdin, stdout, stderr = ssh.exec_command("pm2 restart trade-backend")
    restart_out = stdout.read().decode('utf-8', errors='ignore')
    restart_err = stderr.read().decode('utf-8', errors='ignore')
    print("PM2 Output:\n", restart_out)
    if restart_err:
        print("PM2 Errors:\n", restart_err)
        
except Exception as e:
    print("An error occurred during deployment:", str(e))
finally:
    ssh.close()
    print("SSH connection closed.")
