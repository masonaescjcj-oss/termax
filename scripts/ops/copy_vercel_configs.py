import shutil
import os
import subprocess

mobile_dir = r"c:\Users\asiac\OneDrive\Desktop\trade (2)\trade\mobile"
dist_dir = r"c:\Users\asiac\OneDrive\Desktop\trade (2)\trade\mobile\dist"

# Source paths
src_vercel_dir = os.path.join(mobile_dir, ".vercel")
src_vercel_json = os.path.join(mobile_dir, "vercel.json")

# Dest paths
dest_vercel_dir = os.path.join(dist_dir, ".vercel")
dest_vercel_json = os.path.join(dist_dir, "vercel.json")

print("Copying Vercel configuration files to dist folder...")
try:
    # Copy .vercel directory
    if os.path.exists(dest_vercel_dir):
        shutil.rmtree(dest_vercel_dir)
    shutil.copytree(src_vercel_dir, dest_vercel_dir)
    print("Copied .vercel folder.")
    
    # Copy vercel.json
    shutil.copy(src_vercel_json, dest_vercel_json)
    print("Copied vercel.json file.")
    
    print("Configuration copy successful!")
except Exception as e:
    print(f"Error copying config: {e}")
