import urllib.request
import json
import subprocess
import os
import sys

if sys.version_info >= (3, 7):
    sys.stdout.reconfigure(encoding='utf-8')

def upload_via_curl():
    apk_path = r'c:\Users\asiac\OneDrive\Desktop\trade (2)\ترمکس.apk'
    if not os.path.exists(apk_path):
        print(f"ERROR: File not found at {apk_path}")
        return

    print("Fetching server from Gofile API...")
    try:
        req = urllib.request.Request("https://api.gofile.io/servers", headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=60) as response:
            res_data = json.loads(response.read().decode('utf-8'))
            if res_data.get("status") == "ok":
                server = res_data["data"]["servers"][0]["name"]
                print(f"Server allocated: {server}")
            else:
                print("Failed to allocate server.")
                return
    except Exception as e:
        print(f"Error getting server: {e}")
        return

    print(f"Uploading file via curl.exe to Gofile (Server: {server})...")
    upload_url = f"https://{server}.gofile.io/contents/uploadfile"
    
    # Run curl command to upload
    cmd = [
        "curl", 
        "-F", f"file=@{apk_path}", 
        upload_url
    ]
    
    print(f"Running command: {' '.join(cmd)}")
    try:
        # Increase execution timeout to 15 minutes (900 seconds)
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=900)
        print("Curl finished execution.")
        if result.returncode == 0:
            print("Response from Gofile:")
            print(result.stdout)
            # Parse downloadPage from response
            try:
                data = json.loads(result.stdout)
                if data.get("status") == "ok":
                    print(f"GOFILE_LINK: {data['data']['downloadPage']}")
                else:
                    print("Gofile returned an error status in JSON.")
            except Exception as pe:
                print(f"Failed to parse JSON response: {pe}")
        else:
            print(f"Curl failed with return code {result.returncode}")
            print(f"Stderr: {result.stderr}")
    except subprocess.TimeoutExpired:
        print("Upload timed out after 15 minutes.")
    except Exception as e:
        print(f"Error executing curl: {e}")

if __name__ == '__main__':
    upload_via_curl()
