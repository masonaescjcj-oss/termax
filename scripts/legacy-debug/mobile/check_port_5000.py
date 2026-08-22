import subprocess

try:
    netstat_output = subprocess.check_output("netstat -ano", shell=True).decode('utf-8')
    pids = []
    for line in netstat_output.splitlines():
        if ":5000" in line and "LISTENING" in line:
            parts = line.strip().split()
            if len(parts) >= 5:
                pid = parts[-1]
                pids.append(pid)
                print(f"Netstat: {line.strip()}")

    # Find the process info for each PID
    for pid in set(pids):
        tasklist_output = subprocess.check_output(f"tasklist /FI \"PID eq {pid}\"", shell=True).decode('utf-8')
        print(f"Tasklist for PID {pid}:\n{tasklist_output.strip()}\n")
except Exception as e:
    print(f"Error checking process: {e}")
