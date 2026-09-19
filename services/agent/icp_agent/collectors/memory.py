"""
Memory metrics collector using psutil.
"""
import psutil
from typing import Dict, Any


def collect_memory_metrics() -> Dict[str, Any]:
    """Collect virtual and swap memory metrics."""
    vm = psutil.virtual_memory()
    swap = psutil.swap_memory()

    return {
        "virtual": {
            "totalMb": round(vm.total / (1024 * 1024), 2),
            "usedMb": round(vm.used / (1024 * 1024), 2),
            "availableMb": round(vm.available / (1024 * 1024), 2),
            "freeMb": round(vm.free / (1024 * 1024), 2),
            "usagePercent": round(vm.percent, 2),
            "cached": round(getattr(vm, "cached", 0) / (1024 * 1024), 2),
            "buffers": round(getattr(vm, "buffers", 0) / (1024 * 1024), 2),
        },
        "swap": {
            "totalMb": round(swap.total / (1024 * 1024), 2),
            "usedMb": round(swap.used / (1024 * 1024), 2),
            "freeMb": round(swap.free / (1024 * 1024), 2),
            "usagePercent": round(swap.percent, 2),
        },
    }
