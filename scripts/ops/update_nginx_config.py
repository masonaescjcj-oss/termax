import paramiko

host = "45.129.126.98"
username = "root"
password = "02ZZds9PWYj3"

new_nginx_config = """server {
    server_name 45-129-126-98.sslip.io;

    # Trade App WebSockets
    location /socket.io/ {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Trade App API Endpoints
    location /api/ {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Trade App Uploads
    location /uploads/ {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Other App (prediction-arena-backend) Root Proxy
    location / {
        proxy_pass http://localhost:8787;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    listen 443 ssl; # managed by Certbot
    ssl_certificate /etc/letsencrypt/live/45-129-126-98.sslip.io/fullchain.pem; # managed by Certbot
    ssl_certificate_key /etc/letsencrypt/live/45-129-126-98.sslip.io/privkey.pem; # managed by Certbot
    include /etc/letsencrypt/options-ssl-nginx.conf; # managed by Certbot
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem; # managed by Certbot
}

server {
    if ($host = 45-129-126-98.sslip.io) {
        return 301 https://$host$request_uri;
    } # managed by Certbot

    listen 80;
    server_name 45-129-126-98.sslip.io;
    return 404; # managed by Certbot
}
"""

try:
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(host, username=username, password=password, timeout=15)
    
    # Backup current default config
    stdin, stdout, stderr = ssh.exec_command("cp /etc/nginx/sites-available/default /etc/nginx/sites-available/default.bak_trade_fix")
    
    # Write new config using sftp
    sftp = ssh.open_sftp()
    with sftp.file('/etc/nginx/sites-available/default', 'w') as f:
        f.write(new_nginx_config)
    sftp.close()
    
    # Test nginx configuration syntax
    stdin, stdout, stderr = ssh.exec_command("nginx -t")
    t_out = stdout.read().decode('utf-8', errors='ignore')
    t_err = stderr.read().decode('utf-8', errors='ignore')
    print("=== NGINX TEST ===")
    print(t_out)
    print(t_err)
    
    if "successful" in t_err or "successful" in t_out:
        # Reload nginx safely
        stdin, stdout, stderr = ssh.exec_command("systemctl reload nginx")
        print("=== NGINX RELOADED SUCCESSFULLY ===")
    else:
        print("❌ Nginx test failed! Rolling back...")
        ssh.exec_command("cp /etc/nginx/sites-available/default.bak_trade_fix /etc/nginx/sites-available/default && systemctl reload nginx")

    ssh.close()
except Exception as e:
    print(f"Error: {e}")
