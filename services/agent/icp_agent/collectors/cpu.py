"""
CPU metrics collector using psutil.
"""
import psutil
from typing import Dict, Any


def collect_cpu_metrics() -> Dict[str, Any]:
    """Collect comprehensive CPU metrics."""
    cpu_percent = psutil.cpu_percent(interval=0.5)
    per_cpu = psutil.cpu_percent(interval=0, percpu=True)
    cpu_freq = psutil.cpu_freq()
    cpu_count_logical = psutil.cpu_count(logical=True)
    cpu_count_physical = psutil.cpu_count(logical=False)
    load_avg = psutil.getloadavg()

    return {
        "usagePercent": round(cpu_percent, 2),
        "perCore": [round(c, 2) for c in per_cpu],
        "coreCountLogical": cpu_count_logical,
        "coreCountPhysical": cpu_count_physical or cpu_count_logical,
        "frequencyMhz": round(cpu_freq.current, 2) if cpu_freq else 0,
        "frequencyMaxMhz": round(cpu_freq.max, 2) if cpu_freq else 0,
        "loadAvg1": round(load_avg[0], 2),
        "loadAvg5": round(load_avg[1], 2),
        "loadAvg15": round(load_avg[2], 2),
    }
