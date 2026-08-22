import sys
import paramiko

if sys.version_info >= (3, 7):
    sys.stdout.reconfigure(encoding='utf-8')

def deploy_resume():
    host = "45.129.126.98"
    username = "root"
    password = "02ZZds9PWYj3"
    
    print("Connecting to VPS over SSH...")
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(host, username=username, password=password, timeout=30)
    
    commands = [
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
            
        if exit_status != 0:
            print("ERROR: Command failed. Aborting.")
            ssh.close()
            return
            
    print("RESUME_DEPLOYMENT_SUCCESSFUL")
    ssh.close()

if __name__ == '__main__':
    deploy_resume()
