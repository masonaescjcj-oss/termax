import paramiko
from scp import SCPClient
import os
import sys

if sys.version_info >= (3, 7):
    sys.stdout.reconfigure(encoding='utf-8')

def upload_to_vps():
    host = "45.129.126.98"
    username = "root"
    password = "02ZZds9PWYj3"
    
    local_file = r"c:\Users\asiac\OneDrive\Desktop\trade (2)\ترمکس.apk"
    remote_dir = "/root/trade-backend/public/uploads"
    remote_file = f"{remote_dir}/ترمکس.apk"
    
    if not os.path.exists(local_file):
        print(f"ERROR: File not found at {local_file}")
        return
        
    print(f"Connecting to VPS {host} via SSH...")
    try:
        ssh = paramiko.SSHClient()
        ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        ssh.connect(host, username=username, password=password, timeout=30)
        
        # Ensure uploads folder exists
        print(f"Ensuring remote folder {remote_dir} exists...")
        ssh.exec_command(f"mkdir -p {remote_dir}")
        
        print("Starting direct SFTP upload to VPS uploads folder...")
        # Uploading using SCP
        with SCPClient(ssh.get_transport()) as scp:
            scp.put(local_file, remote_file)
            
        print("Upload completed successfully!")
        print(f"VPS_DOWNLOAD_LINK: https://45-129-126-98.sslip.io/uploads/ترمکس.apk")
        
        # Double check if file exists and print size on remote
        stdin, stdout, stderr = ssh.exec_command(f"ls -lh {remote_file}")
        print("Remote file status:")
        print(stdout.read().decode('utf-8'))
        
        ssh.close()
    except Exception as e:
        print(f"Error during VPS upload: {e}")

if __name__ == '__main__':
    upload_to_vps()
