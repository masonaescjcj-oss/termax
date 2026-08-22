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
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

console.log('SUPABASE_URL:', process.env.SUPABASE_URL);
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function test() {
    console.log('Testing Supabase query...');
    const start = Date.now();
    try {
        const { data, error } = await supabase.from('users').select('id').limit(1);
        console.log('QueryResult time:', Date.now() - start, 'ms', 'error:', error, 'data count:', data ? data.length : 0);
    } catch (e) {
        console.log('Catch error:', e.message);
    }
}
test();
" """
    
    stdin, stdout, stderr = ssh.exec_command(cmd)
    print("STDOUT:\n" + stdout.read().decode('utf-8', errors='ignore'))
    print("STDERR:\n" + stderr.read().decode('utf-8', errors='ignore'))
    
    ssh.close()
except Exception as e:
    print("Error:", e)
