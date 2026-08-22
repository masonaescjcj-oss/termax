try:
    import paramiko
    print("PARAMIKO_OK")
except ImportError:
    print("PARAMIKO_MISSING")
