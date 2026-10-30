# Load Balancing & Capacity

Production runs on one server (`10.1.0.11`) with Docker Compose. This page states what that does and doesn't protect against.

## Traffic path

```
Cloudflare -> cloudflared -> nginx-ingress -> api-gateway -> service (auth, catalog, sales, ...)
                                           -> frontend container (admin, pos, mini, infra, hr, ...)
```

`scripts/deploy_production.sh` also attaches `admin-web`, `infra-web` and `mini-web` aliases to `camtech_camtech-net` for an
external tunnel. Hostnames routed through those aliases bypass `nginx-ingress` and its rate limits. Check the tunnel's public
hostname settings in Cloudflare.

## What balances load today

| Layer | Mechanism |
|---|---|
| Between processes | Uvicorn workers share a port: gateway 4, auth/catalog/sales 2, others 1 |
| Between containers | Nothing. Every service and app has one container |
| Between servers | Nothing. There is one server |

Passkey challenges and live events use Redis, so workers and future replicas are safe for those flows.

## Failure behaviour

| Failure | Result |
|---|---|
| One frontend down | That app returns 502; the others keep working |
| One backend service down | The gateway serves safe requests, and undelivered writes, from its in-process fallback |
| Gateway down | All API calls fail |
| Postgres or the server down | Everything fails. No automatic failover exists |

## Capacity limits

`workers x (DB_POOL_SIZE + DB_MAX_OVERFLOW)` summed across services must stay under Postgres `max_connections` (200).
`tests/test_deploy_config.py` checks the defaults.

## Path to real load balancing

1. **Remove the limits on replicas.** Fixed `container_name` and host ports block `--scale`. `scripts/camtech.py`, the deploy
   scripts, the infra scheduler and the Cloudflare aliases depend on those names, so change them together.
2. **Use PgBouncer.** Point `DATABASE_URL` at `pgbouncer:6432` with asyncpg `statement_cache_size=0`.
3. **Configure real replication** for `postgres-replica`, then set `REPLICA_DATABASE_URL`.
4. **Add a second server** and run a `cloudflared` connector on each. Only this survives a server failure.
5. **Decide on Kubernetes.** `infra/k8s/` covers only the gateway, sales and catalog, and is not deployed.
