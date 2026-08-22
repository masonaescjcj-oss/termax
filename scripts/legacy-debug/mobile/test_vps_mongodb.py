import paramiko
import sys

sys.stdout.reconfigure(encoding='utf-8')

host = "45.129.126.98"
username = "root"
password = "02ZZds9PWYj3"

try:
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(host, username=username, password=password, timeout=15)
    
    cmd = """cd /root/trade-backend && node -e "
const mongoose = require('mongoose');
require('dotenv').config();

console.log('Testing MongoDB connection...');
mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 5000 }).then(() => {
    console.log('✅ MongoDB connected successfully!');
    process.exit(0);
}).catch(err => {
    console.log('❌ MongoDB connection error:', err.message);
    process.exit(1);
});
" """
    
    stdin, stdout, stderr = ssh.exec_command(cmd)
    print("STDOUT:\n" + stdout.read().decode('utf-8', errors='ignore'))
    print("STDERR:\n" + stderr.read().decode('utf-8', errors='ignore'))
    
    ssh.close()
except Exception as e:
    print("Error:", e)
