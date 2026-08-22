import subprocess
import re

def clean_vercel():
    active_deployment = "dist-5adzq15u3-isaacs-projects-dad539ec.vercel.app"
    cwd = r"c:\Users\asiac\OneDrive\Desktop\trade (2)\trade\mobile\dist"
    
    print("Listing Vercel deployments...")
    result = subprocess.run(["vercel", "ls"], cwd=cwd, capture_output=True, text=True, shell=True)
    
    # Extract URLs ending in vercel.app
    urls = re.findall(r'https://(dist-[a-zA-Z0-9\-]+\.vercel\.app)', result.stdout)
    
    # De-duplicate URLs
    unique_urls = list(set(urls))
    print(f"Found {len(unique_urls)} deployments in list.")
    
    # Delete older ones
    deleted_count = 0
    for url in unique_urls:
        if active_deployment in url:
            print(f"Keeping active production deployment: {url}")
            continue
            
        print(f"Deleting older deployment: {url} ...")
        del_result = subprocess.run(["vercel", "rm", url, "--yes"], cwd=cwd, capture_output=True, text=True, shell=True)
        if del_result.returncode == 0:
            print(f"Successfully deleted {url}")
            deleted_count += 1
        else:
            print(f"Failed to delete {url}: {del_result.stderr.strip()}")
            
    print(f"Cleanup finished. Deleted {deleted_count} older deployments.")

if __name__ == '__main__':
    clean_vercel()
