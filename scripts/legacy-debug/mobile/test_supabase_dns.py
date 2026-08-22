import urllib.request
import socket

url = "https://jasgepmskcsyvqoesocc.supabase.co"
print("Testing DNS resolution for:", url)

try:
    ip = socket.gethostbyname("jasgepmskcsyvqoesocc.supabase.co")
    print("Resolved IP:", ip)
except Exception as e:
    print("DNS Resolution Failed:", e)
