import subprocess
import json
import os
import sys

if sys.version_info >= (3, 7):
    sys.stdout.reconfigure(encoding='utf-8')

def upload_via_file_io():
    apk_path = r'c:\Users\asiac\OneDrive\Desktop\trade (2)\ترمکس.apk'
    if not os.path.exists(apk_path):
        print(f"ERROR: File not found at {apk_path}")
        return

    print("Uploading file to file.io via curl.exe...")
    url = "https://file.io"
    
    # Run curl command to upload
    cmd = [
        "curl", 
        "-L",
        "-F", f"file=@{apk_path}", 
        url
    ]
    
    print(f"Running command: {' '.join(cmd)}")
    try:
        # Timeout set to 15 minutes (900 seconds)
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=900)
        print("Upload finished.")
        if result.returncode == 0:
            print("Response from file.io:")
            print(result.stdout)
            try:
                data = json.loads(result.stdout)
                if data.get("success"):
                    link = data.get("link")
                    print(f"FILE_IO_LINK: {link}")
                else:
                    print("file.io returned success = False.")
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
    upload_via_file_io()
