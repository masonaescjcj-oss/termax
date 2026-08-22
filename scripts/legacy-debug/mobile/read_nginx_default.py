import paramiko

host = "45.129.126.98"
username = "root"
password = "02ZZds9PWYj3"

try:
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(host, username=username, password=password, timeout=15)
    
    stdin, stdout, stderr = ssh.exec_command("cat /etc/nginx/sites-available/default")
    print("=== /etc/nginx/sites-available/default ===")
    print(stdout.read().decode('utf-8', errors='ignore'))
    
    ssh.close()
except Exception as e:
    print(f"Error: {e}")
