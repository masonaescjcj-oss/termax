import paramiko
from scp import SCPClient
import os
import sys

if sys.version_info >= (3, 7):
    sys.stdout.reconfigure(encoding='utf-8')

def deploy_backend_fix():
    host = "45.129.126.98"
    username = "root"
    password = "02ZZds9PWYj3"
    
    local_file = r"c:\Users\asiac\OneDrive\Desktop\trade (2)\trade\backend\src\controllers\authController.ts"
    remote_file = "/root/trade-backend/src/controllers/authController.ts"
    
    if not os.path.exists(local_file):
        print(f"ERROR: Local file not found at {local_file}")
        return
        
    print(f"Connecting to VPS {host} via SSH...")
    try:
        ssh = paramiko.SSHClient()
        ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        ssh.connect(host, username=username, password=password, timeout=30)
        
        print("Uploading updated authController.ts over SFTP/SCP...")
        with SCPClient(ssh.get_transport()) as scp:
            scp.put(local_file, remote_file)
            
        print("Compiling TypeScript on VPS server...")
        stdin, stdout, stderr = ssh.exec_command("cd /root/trade-backend && npm run build")
        
        # Wait for compilation to finish and print output
        comp_out = stdout.read().decode('utf-8')
        comp_err = stderr.read().decode('utf-8')
        print("Build output:")
        print(comp_out)
        if comp_err:
            print("Build errors:")
            print(comp_err)
            
        print("Restarting PM2 backend services...")
        stdin, stdout, stderr = ssh.exec_command("pm2 restart all && pm2 status")
        print("PM2 restart output:")
        print(stdout.read().decode('utf-8'))
        
        ssh.close()
        print("Deployment successful!")
    except Exception as e:
        print(f"Error during deployment: {e}")

if __name__ == '__main__':
    deploy_backend_fix()
