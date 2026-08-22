import subprocess

try:
    # Use wmic to get commandline of the process
    output = subprocess.check_output('wmic process where processid=16952 get commandline', shell=True).decode('utf-8')
    print("Process command line:")
    print(output)
except Exception as e:
    print("Error getting command line:", e)
