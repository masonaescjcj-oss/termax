import subprocess

def list_processes():
    try:
        output = subprocess.check_output('tasklist', shell=True).decode('utf-8', errors='ignore')
        print("Active Processes:")
        for line in output.splitlines():
            if any(name in line.lower() for name in ['node', 'cloudflared', 'caddy', 'expo', 'react', 'tunnel']):
                print(line)
    except Exception as e:
        print("Error listing processes:", e)

list_processes()
