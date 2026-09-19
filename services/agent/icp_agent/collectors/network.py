"""
Network metrics collector using psutil.
"""
import psutil
from typing import Dict, Any, List


def collect_network_metrics() -> Dict[str, Any]:
    """Collect network I/O and connection metrics."""
    # Network I/O per interface
    net_io = psutil.net_io_counters(pernic=True)
    interfaces: List[Dict[str, Any]] = []
    for name, counters in net_io.items():
        if name == "lo":
            continue
        interfaces.append({
            "name": name,
            "bytesSent": counters.bytes_sent,
            "bytesRecv": counters.bytes_recv,
            "packetsSent": counters.packets_sent,
            "packetsRecv": counters.packets_recv,
            "errIn": counters.errin,
            "errOut": counters.errout,
            "dropIn": counters.dropin,
            "dropOut": counters.dropout,
        })

    # Total network I/O
    total = psutil.net_io_counters()
    total_stats = {
        "bytesSent": total.bytes_sent,
        "bytesRecv": total.bytes_recv,
        "packetsSent": total.packets_sent,
        "packetsRecv": total.packets_recv,
    }

    # Active connections count by status
    try:
        connections = psutil.net_connections(kind="inet")
        conn_stats = {}
        for conn in connections:
            s = conn.status
            conn_stats[s] = conn_stats.get(s, 0) + 1
    except (psutil.AccessDenied, PermissionError):
        conn_stats = {"error": "access_denied"}

    return {
        "interfaces": interfaces,
        "total": total_stats,
        "connections": conn_stats,
    }
