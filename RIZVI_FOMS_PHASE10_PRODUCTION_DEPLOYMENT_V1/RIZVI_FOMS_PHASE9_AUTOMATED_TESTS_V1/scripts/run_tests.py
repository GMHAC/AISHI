import subprocess,sys
result=subprocess.run([sys.executable,'-m','pytest','tests'],check=False)
raise SystemExit(result.returncode)
