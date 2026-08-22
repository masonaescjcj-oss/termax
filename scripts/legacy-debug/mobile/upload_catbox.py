import urllib.request
import urllib.parse
import mimetypes
import os
import sys

if sys.version_info >= (3, 7):
    sys.stdout.reconfigure(encoding='utf-8')

def upload_to_catbox(file_path):
    url = "https://catbox.moe/user/api.php"
    if not os.path.exists(file_path):
        print(f"ERROR: File not found at {file_path}")
        return
        
    print(f"Uploading {file_path} to Catbox.moe (size: {os.path.getsize(file_path)/(1024*1024):.2f} MB)...")
    
    # Generate multipart/form-data boundary
    boundary = "----WebKitFormBoundary7MA4YWxkTrZu0gW"
    
    # Read file content
    with open(file_path, "rb") as f:
        file_content = f.read()
        
    filename = os.path.basename(file_path)
    mime_type = mimetypes.guess_type(file_path)[0] or "application/octet-stream"
    
    # Construct multipart body
    parts = []
    
    # reqtype field
    parts.append(f"--{boundary}\r\n")
    parts.append('Content-Disposition: form-data; name="reqtype"\r\n\r\n')
    parts.append("fileupload\r\n")
    
    # file field
    parts.append(f"--{boundary}\r\n")
    parts.append(f'Content-Disposition: form-data; name="fileToUpload"; filename="{filename}"\r\n')
    parts.append(f"Content-Type: {mime_type}\r\n\r\n")
    
    body = bytearray()
    for part in parts:
        body.extend(part.encode('utf-8'))
    body.extend(file_content)
    body.extend(f"\r\n--{boundary}--\r\n".encode('utf-8'))
    
    headers = {
        "Content-Type": f"multipart/form-data; boundary={boundary}",
        "Content-Length": str(len(body)),
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
    }
    
    try:
        req = urllib.request.Request(url, data=body, headers=headers)
        with urllib.request.urlopen(req, timeout=300) as response:
            result = response.read().decode('utf-8').strip()
            if result.startswith("https://"):
                print(f"UPLOAD_SUCCESSFUL: {result}")
            else:
                print(f"UPLOAD_FAILED: {result}")
    except Exception as e:
        print(f"Error during upload: {e}")

if __name__ == '__main__':
    apk_path = r'c:\Users\asiac\OneDrive\Desktop\trade (2)\trade\mobile\android\app\build\outputs\apk\release\app-release.apk'
    upload_to_catbox(apk_path)
