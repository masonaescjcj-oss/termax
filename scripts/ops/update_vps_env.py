import paramiko
import re

host = "45.129.126.98"
username = "root"
password = "02ZZds9PWYj3"

try:
    print(f"Connecting to VPS {host}...")
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(host, username=username, password=password, timeout=30)
    
    # 1. Read current .env
    print("Reading remote .env file...")
    stdin, stdout, stderr = ssh.exec_command("cat /root/trade-backend/.env")
    env_content = stdout.read().decode('utf-8', errors='ignore')
    
    # 2. Modify TELEGRAM_WEB_APP_URL
    new_url = "https://mobile-mauve-one.vercel.app"
    if "TELEGRAM_WEB_APP_URL=" in env_content:
        # Replace the existing line
        updated_content = re.sub(
            r"TELEGRAM_WEB_APP_URL=.*",
            f"TELEGRAM_WEB_APP_URL={new_url}",
            env_content
        )
    else:
        # Append it if not present
        updated_content = env_content + f"\nTELEGRAM_WEB_APP_URL={new_url}\n"
        
    # Write the updated content back to the VPS
    print("Writing updated .env file back to VPS...")
    # Escape quotes and content properly to pass via echo, or use SFTP
    sftp = ssh.open_sftp()
    with sftp.file('/root/trade-backend/.env', 'w') as remote_file:
        remote_file.write(updated_content)
    sftp.close()
    
    # 3. Restart PM2 process
    print("Restarting trade-backend PM2 process...")
    stdin, stdout, stderr = ssh.exec_command("pm2 restart trade-backend")
    restart_output = stdout.read().decode('utf-8', errors='ignore')
    print("PM2 Restart Output:")
    print(restart_output)
    
    # 4. Check PM2 status
    stdin, stdout, stderr = ssh.exec_command("pm2 status")
    pm2_status = stdout.read().decode('utf-8', errors='ignore')
    print("PM2 Status:")
    print(pm2_status)
    
    ssh.close()
    print("VPS update completed successfully!")
except Exception as e:
    print(f"Error: {e}")
