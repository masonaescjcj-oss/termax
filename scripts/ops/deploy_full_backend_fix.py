import paramiko
import os
import sys

sys.stdout.reconfigure(encoding='utf-8')

files_to_upload = [
    (r"c:\Users\asiac\OneDrive\Desktop\trade (2)\trade\backend\src\server.ts", "/root/trade-backend/src/server.ts"),
    (r"c:\Users\asiac\OneDrive\Desktop\trade (2)\trade\backend\src\config\supabase.ts", "/root/trade-backend/src/config/supabase.ts"),
    (r"c:\Users\asiac\OneDrive\Desktop\trade (2)\trade\backend\src\controllers\authController.ts", "/root/trade-backend/src/controllers/authController.ts"),
    (r"c:\Users\asiac\OneDrive\Desktop\trade (2)\trade\backend\src\controllers\marketController.ts", "/root/trade-backend/src/controllers/marketController.ts"),
    (r"c:\Users\asiac\OneDrive\Desktop\trade (2)\trade\backend\src\middleware\auth.ts", "/root/trade-backend/src/middleware/auth.ts")
]

print("Connecting to VPS via SSH...")
ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())

try:
    ssh.connect('45.129.126.98', username='root', password='02ZZds9PWYj3', timeout=15)
    print("Connected successfully!")
    
    sftp = ssh.open_sftp()
    for local_p, remote_p in files_to_upload:
        print(f"Uploading {os.path.basename(local_p)} -> {remote_p}...")
        sftp.put(local_p, remote_p)
    sftp.close()
    print("All files uploaded successfully!")
    
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
