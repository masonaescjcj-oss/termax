import os
import zipfile
import sys

sys.stdout.reconfigure(encoding='utf-8')

# Root directory to package
source_dir = r"c:\Users\asiac\OneDrive\Desktop\trade (2)"
output_zip = r"c:\Users\asiac\OneDrive\Desktop\termax_trade_clean_source.zip"

# Exclude directories
EXCLUDED_DIRS = {
    'node_modules',
    '.expo',
    '.git',
    'dist',
    'build',
    '.gradle',
    '.idea',
    '__pycache__',
    '.system_generated',
    '.turbo',
    '.cache',
    'inspect-archive',
    'android/app/build',
    'android/.gradle',
    'ios/build',
    'ios/Pods',
    'scratch'
}

# Exclude large binary extensions or temporary files
EXCLUDED_EXTENSIONS = {
    '.apk',
    '.aab',
    '.msi',
    '.exe',
    '.log',
    '.zip'
}

# Exclude specific temporary / debug files
EXCLUDED_FILES = {
    'cloudflared.exe',
    'node.msi',
    'termax.apk',
    'app-debug.apk',
    'app-release.apk',
    'app-release.aab',
    'application-5b63007f-5df6-4a82-ace6-498b84832fc2.aab',
    'bundle_test.js',
    'backend.zip'
}

def should_exclude(dirpath, filename=None):
    rel_path = os.path.relpath(dirpath, source_dir).replace('\\', '/')
    parts = rel_path.split('/')
    for part in parts:
        if part in EXCLUDED_DIRS:
            return True
        for ex in EXCLUDED_DIRS:
            if ex in rel_path:
                return True
                
    if filename:
        if filename in EXCLUDED_FILES:
            return True
        # Exclude old logcat/debug dump text files
        if filename.startswith('logcat') or filename.startswith('cloudflare') or filename.startswith('crash_') or filename.startswith('real_crash') or filename.startswith('is_dark_search'):
            return True
        ext = os.path.splitext(filename)[1].lower()
        if ext in EXCLUDED_EXTENSIONS:
            return True
            
    return False

print("Starting clean zip archiving...")
file_count = 0
total_uncompressed_bytes = 0

with zipfile.ZipFile(output_zip, 'w', compression=zipfile.ZIP_DEFLATED, compresslevel=9) as zipf:
    for root, dirs, files in os.walk(source_dir):
        dirs[:] = [d for d in dirs if not should_exclude(os.path.join(root, d))]
        
        if should_exclude(root):
            continue
            
        for file in files:
            if should_exclude(root, file):
                continue
                
            full_path = os.path.join(root, file)
            rel_path = os.path.relpath(full_path, source_dir)
            
            if os.path.abspath(full_path) == os.path.abspath(output_zip):
                continue
                
            file_size = os.path.getsize(full_path)
            total_uncompressed_bytes += file_size
            file_count += 1
            
            zipf.write(full_path, arcname=rel_path)

zip_size_mb = os.path.getsize(output_zip) / (1024 * 1024)
uncompressed_mb = total_uncompressed_bytes / (1024 * 1024)

print(f"\n✅ Clean Source Zip Archive Created Successfully!")
print(f"📁 File Location: {output_zip}")
print(f"📄 Included Files Count: {file_count}")
print(f"📊 Raw Source Code Size: {uncompressed_mb:.2f} MB")
print(f"📦 Final Compact ZIP Size: {zip_size_mb:.2f} MB")
