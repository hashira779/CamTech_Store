"""
Disk metrics collector using psutil.
"""
import psutil
from typing import Dict, Any, List


def collect_disk_metrics() -> Dict[str, Any]:
    """Collect disk usage and I/O metrics for all partitions."""
    partitions: List[Dict[str, Any]] = []
    for part in psutil.disk_partitions(all=False):
        try:
            usage = psutil.disk_usage(part.mountpoint)
            partitions.append({
                "device": part.device,
                "mountpoint": part.mountpoint,
                "fstype": part.fstype,
                "totalGb": round(usage.total / (1024 ** 3), 2),
                "usedGb": round(usage.used / (1024 ** 3), 2),
                "freeGb": round(usage.free / (1024 ** 3), 2),
                "usagePercent": round(usage.percent, 2),
            })
        except (PermissionError, OSError):
            continue

    # Disk I/O counters
    io = psutil.disk_io_counters()
    io_stats = {}
    if io:
        io_stats = {
            "readBytes": io.read_bytes,
            "writeBytes": io.write_bytes,
            "readCount": io.read_count,
            "writeCount": io.write_count,
        }

    return {
        "partitions": partitions,
        "io": io_stats,
    }
