import socket

host = "10.1.0.11"
ports = {
    22: "SSH",
    4010: "API Gateway",
    5001: "Storefront App",
    5002: "Admin/WMS App",
    5004: "Delivery App",
    5433: "PostgreSQL",
}

print(f"Checking {host}...")
for port, name in ports.items():
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    s.settimeout(3.0)
    res = s.connect_ex((host, port))
    status = "OPEN" if res == 0 else f"CLOSED ({res})"
    print(f"Port {port:5d} ({name:16s}): {status}")
    s.close()
