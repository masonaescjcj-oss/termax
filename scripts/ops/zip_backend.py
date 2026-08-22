import os
import zipfile

def zip_backend():
    source_dir = r'c:\Users\asiac\OneDrive\Desktop\trade (2)\trade\backend'
    output_zip = r'C:\t\backend.zip'
    
    exclude_dirs = {'node_modules', 'dist', '.git', '.github', 'tmp'}
    exclude_files = {'.env', 'backend.zip', 'check_members.ts'}
    
    with zipfile.ZipFile(output_zip, 'w', zipfile.ZIP_DEFLATED) as zipf:
        for root, dirs, files in os.walk(source_dir):
            # Modify dirs in-place to skip excluded directories
            dirs[:] = [d for d in dirs if d not in exclude_dirs]
            
            for file in files:
                if file in exclude_files:
                    continue
                file_path = os.path.join(root, file)
                arcname = os.path.relpath(file_path, source_dir)
                zipf.write(file_path, arcname)
                
    print("ZIP_COMPLETED_SUCCESSFULLY")

if __name__ == '__main__':
    zip_backend()
