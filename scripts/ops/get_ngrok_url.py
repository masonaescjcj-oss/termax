import urllib.request
import json
import time

time.sleep(2) # Give ngrok a brief moment to connect

try:
    with urllib.request.urlopen('http://127.0.0.1:4040/api/tunnels') as response:
        data = json.loads(response.read().decode('utf-8'))
        tunnels = data.get('tunnels', [])
        for t in tunnels:
            if t.get('proto') == 'https':
                print("FOUND NGROK HTTPS URL:", t.get('public_url'))
                exit(0)
        print("Tunnels found but no HTTPS tunnel:", tunnels)
except Exception as e:
    print("Error querying ngrok API:", e)
