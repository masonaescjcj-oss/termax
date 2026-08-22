import paramiko
import sys

sys.stdout.reconfigure(encoding='utf-8')

host = "45.129.126.98"
username = "root"
password = "02ZZds9PWYj3"

output_file = r"c:\Users\asiac\OneDrive\Desktop\trade (2)\trade\mobile\supabase_fix_result.txt"

with open(output_file, "w", encoding="utf-8") as f:
    try:
        ssh = paramiko.SSHClient()
        ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        ssh.connect(host, username=username, password=password, timeout=15)
        
        cmd = """cd /root/trade-backend && node -e "
const ws = require('ws');
if (typeof global.WebSocket === 'undefined') {
    global.WebSocket = ws;
}
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY, {
    auth: { persistSession: false },
    realtime: { transport: ws }
});

async function test() {
    console.log('Testing Supabase query with polyfilled WebSocket...');
    const start = Date.now();
    try {
        const { data, error } = await supabase.from('users').select('id, username').limit(2);
        console.log('QueryResult time:', Date.now() - start, 'ms');
        console.log('Error:', error);
        console.log('Data:', data);
    } catch (e) {
        console.log('Catch error:', e.message);
    }
}
test();
" """
        
        stdin, stdout, stderr = ssh.exec_command(cmd)
        out = stdout.read().decode('utf-8', errors='ignore')
        err = stderr.read().decode('utf-8', errors='ignore')
        f.write("STDOUT:\n" + out + "\nSTDERR:\n" + err + "\n")
        
        ssh.close()
    except Exception as e:
        f.write("Error: " + str(e) + "\n")
