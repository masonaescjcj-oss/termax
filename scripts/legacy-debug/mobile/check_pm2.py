import paramiko

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
try:
    ssh.connect('45.129.126.98', username='root', password='02ZZds9PWYj3')
    stdin, stdout, stderr = ssh.exec_command("pm2 list")
    out = stdout.read().decode('utf-8', errors='ignore')
    print("PM2 List Output:\n", out.encode('ascii', 'ignore').decode('ascii'))
except Exception as e:
    print("Error:", str(e))
finally:
    ssh.close()
