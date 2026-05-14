import psutil
import time
import csv
import sys
import os
from datetime import datetime

# Usage: python collect-system-metrics.py <output-file>
# Run in a separate terminal while k6 is running
# Ctrl+C to stop when k6 finishes

output_file = sys.argv[1] if len(sys.argv) > 1 else "reports/system-metrics.csv"

# Find the uvicorn/FastAPI process to track specifically
def find_fastapi_pid():
    for proc in psutil.process_iter(['pid', 'name', 'cmdline']):
        try:
            cmdline = ' '.join(proc.info['cmdline'] or [])
            if 'uvicorn' in cmdline or 'fastapi' in cmdline.lower():
                return proc.info['pid']
        except (psutil.NoSuchProcess, psutil.AccessDenied):
            pass
    return None

fastapi_pid = find_fastapi_pid()
if fastapi_pid:
    print(f"Tracking FastAPI process PID: {fastapi_pid}")
else:
    print("FastAPI process not found — tracking system-wide metrics only")

print(f"Writing metrics to: {output_file}")
print("Press Ctrl+C to stop...\n")

os.makedirs(os.path.dirname(output_file), exist_ok=True)

with open(output_file, 'w', newline='') as f:
    writer = csv.writer(f)
    writer.writerow([
        'timestamp',
        'system_cpu_pct',
        'system_mem_used_mb',
        'system_mem_pct',
        'fastapi_cpu_pct',
        'fastapi_mem_mb',
        'fastapi_threads'
    ])

    try:
        while True:
            timestamp = datetime.now().strftime('%H:%M:%S')
            system_cpu = psutil.cpu_percent(interval=1)
            mem = psutil.virtual_memory()
            system_mem_used = mem.used // 1024 // 1024
            system_mem_pct = mem.percent

            # FastAPI-specific metrics
            fastapi_cpu = 0
            fastapi_mem = 0
            fastapi_threads = 0

            if fastapi_pid:
                try:
                    proc = psutil.Process(fastapi_pid)
                    fastapi_cpu = proc.cpu_percent(interval=None)
                    fastapi_mem = proc.memory_info().rss // 1024 // 1024
                    fastapi_threads = proc.num_threads()
                except (psutil.NoSuchProcess, psutil.AccessDenied):
                    fastapi_pid = None

            writer.writerow([
                timestamp,
                round(system_cpu, 1),
                system_mem_used,
                round(system_mem_pct, 1),
                round(fastapi_cpu, 1),
                fastapi_mem,
                fastapi_threads
            ])
            f.flush()

            print(f"{timestamp} | CPU: {system_cpu:.1f}% | RAM: {system_mem_pct:.1f}% | "
                  f"FastAPI CPU: {fastapi_cpu:.1f}% | FastAPI RAM: {fastapi_mem}MB")

            time.sleep(3)

    except KeyboardInterrupt:
        print(f"\nStopped. Metrics saved to {output_file}")