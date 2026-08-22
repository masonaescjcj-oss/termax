import paramiko

host = "45.129.126.98"
username = "root"
password = "02ZZds9PWYj3"

try:
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(host, username=username, password=password, timeout=15)
    
    cmds = {
        "Caddyfile Locations": "ls -la /etc/caddy/ /etc/caddy/Caddyfile /etc/nginx/",
        "Caddyfile Content": "cat /etc/caddy/Caddyfile 2>/dev/null",
        "Nginx Configs": "cat /etc/nginx/sites-enabled/* 2>/dev/null",
        "Running Web Server Process": "ps aux | grep -E 'caddy|nginx|apache|haproxy'"
    }
    
    for name, cmd in cmds.items():
        print(f"\n=== {name} ({cmd}) ===")
        stdin, stdout, stderr = ssh.exec_command(cmd)
        out = stdout.read().decode('utf-8', errors='ignore')
        err = stderr.read().decode('utf-8', errors='ignore')
        print("STDOUT:\n" + out)
        if err:
            print("STDERR:\n" + err)
            
    ssh.close()
except Exception as e:
    print(f"Error: {e}")
