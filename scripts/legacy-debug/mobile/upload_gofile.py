import urllib.request
import json
import os
import sys
import mimetypes

if sys.version_info >= (3, 7):
    sys.stdout.reconfigure(encoding='utf-8')

def upload_to_gofile(file_path):
    if not os.path.exists(file_path):
        print(f"ERROR: File not found at {file_path}")
        return
        
    print("Step 1: Getting best Gofile server...")
    try:
        req = urllib.request.Request("https://api.gofile.io/servers", headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=30) as response:
            res_data = json.loads(response.read().decode('utf-8'))
            if res_data.get("status") == "ok":
                server = res_data["data"]["servers"][0]["name"]
                print(f"Using server: {server}")
            else:
                print("Failed to get server list from Gofile.")
                return
    except Exception as e:
        print(f"Error getting server: {e}")
        return

    print(f"Step 2: Uploading {file_path} to server {server}...")
    url = f"https://{server}.gofile.io/contents/uploadfile"
    
    boundary = "----WebKitFormBoundaryGofileUpload"
    with open(file_path, "rb") as f:
        file_content = f.read()
        
    filename = os.path.basename(file_path)
    mime_type = mimetypes.guess_type(file_path)[0] or "application/octet-stream"
    
    body = bytearray()
    body.extend(f"--{boundary}\r\n".encode('utf-8'))
    body.extend(f'Content-Disposition: form-data; name="file"; filename="{filename}"\r\n'.encode('utf-8'))
    body.extend(f"Content-Type: {mime_type}\r\n\r\n".encode('utf-8'))
    body.extend(file_content)
    body.extend(f"\r\n--{boundary}--\r\n".encode('utf-8'))
    
    headers = {
        "Content-Type": f"multipart/form-data; boundary={boundary}",
        "Content-Length": str(len(body)),
        "User-Agent": "Mozilla/5.0"
    }
    
    try:
        req = urllib.request.Request(url, data=body, headers=headers)
        with urllib.request.urlopen(req, timeout=300) as response:
            res_data = json.loads(response.read().decode('utf-8'))
            if res_data.get("status") == "ok":
                download_page = res_data["data"]["downloadPage"]
                print(f"UPLOAD_SUCCESSFUL: {download_page}")
            else:
                print(f"UPLOAD_FAILED: {res_data}")
    except Exception as e:
        print(f"Error during upload: {e}")

if __name__ == '__main__':
    apk_path = r'c:\Users\asiac\OneDrive\Desktop\trade (2)\trade\mobile\android\app\build\outputs\apk\release\app-release.apk'
    upload_to_gofile(apk_path)
