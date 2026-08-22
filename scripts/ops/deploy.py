import paramiko
from scp import SCPClient
import os

def deploy():
    host = "45.129.126.98"
    username = "root"
    password = "02ZZds9PWYj3"
    
    local_zip = r"C:\t\backend.zip"
    local_env = r"c:\Users\asiac\OneDrive\Desktop\trade (2)\trade\backend\.env"
    
    print("Connecting to VPS over SSH...")
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(host, username=username, password=password, timeout=30)
    
    print("Uploading backend.zip and .env via SCP...")
    with SCPClient(ssh.get_transport()) as scp:
        scp.put(local_zip, "/root/backend.zip")
        scp.put(local_env, "/root/.env")
        
    print("Files uploaded. Beginning server setup and configuration...")
    
    commands = [
        # Disable interactive prompts and update apt
        "export DEBIAN_FRONTEND=noninteractive",
        "apt-get update -y",
        "apt-get install -y unzip curl nginx certbot python3-certbot-nginx ufw",
        
        # Open firewalls
        "ufw disable || true",
        "iptables -F || true",
        
        # Install Node.js v20
        "curl -fsSL https://deb.nodesource.com/setup_20.x | bash -",
        "apt-get install -y nodejs",
        
        # Create folder and extract backend
        "mkdir -p /root/trade-backend",
        "unzip -o /root/backend.zip -d /root/trade-backend/",
        "mv /root/.env /root/trade-backend/.env",
        "rm -f /root/backend.zip",
        
        # Update .env variables on VPS to use the sslip.io HTTPS production URL
        "sed -i 's|CTRADER_REDIRECT_URI=.*|CTRADER_REDIRECT_URI=https://45-129-126-98.sslip.io/api/v1/trade/callback|g' /root/trade-backend/.env",
        
        # Install packages and build
        "cd /root/trade-backend && npm install",
        "cd /root/trade-backend && npm run build",
        
        # Install and configure PM2
        "npm install -g pm2",
        "pm2 delete trade-backend || true",
        "cd /root/trade-backend && pm2 start dist/server.js --name \"trade-backend\"",
        "pm2 save",
        
        # Configure Nginx reverse proxy
        """cat << 'EOF' > /etc/nginx/sites-available/default
server {
    listen 80;
    server_name 45-129-126-98.sslip.io;

    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
EOF
""",
        "nginx -t",
        "systemctl restart nginx",
        
        # Obtain free SSL certificate via Let's Encrypt
        "certbot --nginx -d 45-129-126-98.sslip.io --non-interactive --agree-tos -m asiac.ali.68@gmail.com",
        "systemctl restart nginx"
    ]
    
    for cmd in commands:
        print(f"Executing: {cmd[:80]}...")
        stdin, stdout, stderr = ssh.exec_command(cmd)
        
        # Read output and error to wait for command completion
        exit_status = stdout.channel.recv_exit_status()
        out = stdout.read().decode('utf-8', errors='ignore')
        err = stderr.read().decode('utf-8', errors='ignore')
        
        print(f"Exit status: {exit_status}")
        if out.strip():
            print(f"Stdout:\n{out[:400]}")
        if err.strip():
            print(f"Stderr:\n{err[:400]}")
            
        if exit_status != 0 and "pm2 delete" not in cmd and "ufw" not in cmd:
            print("ERROR: Command failed. Aborting deployment.")
            ssh.close()
            return
            
    print("DEPLOYMENT_SUCCESSFUL")
    ssh.close()

if __name__ == '__main__':
    deploy()
