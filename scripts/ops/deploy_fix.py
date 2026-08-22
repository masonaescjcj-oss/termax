import sys
import paramiko
from scp import SCPClient

if sys.version_info >= (3, 7):
    sys.stdout.reconfigure(encoding='utf-8')

def deploy_fix():
    host = "45.129.126.98"
    username = "root"
    password = "02ZZds9PWYj3"
    
    local_zip = r"C:\t\backend.zip"
    
    print("Connecting to VPS over SSH...")
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(host, username=username, password=password, timeout=30)
    
    print("Uploading updated backend.zip via SCP...")
    with SCPClient(ssh.get_transport()) as scp:
        scp.put(local_zip, "/root/backend.zip")
        
    commands = [
        "unzip -o /root/backend.zip -d /root/trade-backend/",
        "rm -f /root/backend.zip",
        "cd /root/trade-backend && npm run build",
        "pm2 restart trade-backend"
    ]
    
    for cmd in commands:
        print(f"Executing on VPS: {cmd}...")
        stdin, stdout, stderr = ssh.exec_command(cmd)
        exit_status = stdout.channel.recv_exit_status()
        out = stdout.read().decode('utf-8', errors='ignore')
        err = stderr.read().decode('utf-8', errors='ignore')
        
        print(f"Exit status: {exit_status}")
        if out.strip():
            print(f"Stdout:\n{out[:400]}")
        if err.strip():
            print(f"Stderr:\n{err[:400]}")
            
        if exit_status != 0:
            print("ERROR: Command failed. Aborting.")
            ssh.close()
            return
            
    print("DEPLOYMENT_FIX_SUCCESSFUL")
    ssh.close()

if __name__ == '__main__':
    deploy_fix()
