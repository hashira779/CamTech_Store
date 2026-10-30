import re
from pathlib import Path

import pytest

from app.microservices.registry import SERVICES

yaml = pytest.importorskip("yaml")

ROOT = Path(__file__).resolve().parents[3]
COMPOSE = yaml.safe_load((ROOT / "docker-compose.prod.yml").read_text(encoding="utf-8"))["services"]
NGINX = (ROOT / "deploy/nginx/nginx.conf").read_text(encoding="utf-8")

# Not long-running HTTP servers we own a probe for.
NO_HEALTHCHECK = {"postgres-replica", "pgbouncer", "otel-collector", "jaeger", "cloudflared"}
DB_CLIENT_PROCESS_BUDGET = 200


def test_every_owned_container_has_a_healthcheck():
    missing = [name for name, svc in COMPOSE.items() if name not in NO_HEALTHCHECK and "healthcheck" not in svc]
    assert missing == []


def test_gateway_targets_exist_for_every_registered_service():
    gateway_env = "\n".join(COMPOSE["api-gateway"]["environment"])
    for service in SERVICES:
        match = re.search(rf"{service.url_env}=http://([\w-]+):{service.port}\b", gateway_env)
        assert match, service.url_env
        assert match.group(1) in COMPOSE


def test_one_missing_app_cannot_stop_the_ingress():
    # A static `upstream` must resolve at startup, so one absent container would stop
    # nginx for every app. Only the gateway, which everything needs, may use one.
    assert re.findall(r"^\s*upstream\s+(\w+)\s*\{", NGINX, re.M) == ["api_gateway"]


def test_every_app_host_set_in_nginx_is_a_compose_service():
    hosts = re.findall(r"set \$\w+ http://([\w-]+):\d+;", NGINX)
    assert {"mini-app", "infra-app", "pos-app", "admin-app", "hr-app"} <= set(hosts)
    assert [host for host in hosts if host not in COMPOSE] == []


def test_set_runs_before_the_rewrite_that_would_skip_it():
    # `rewrite ... break` stops rewrite-module directives, and `set` is one of them.
    for block in re.findall(r"location [^{]+\{[^}]*\}", NGINX):
        if "set $" in block and "rewrite" in block:
            assert block.index("set $") < block.index("rewrite")


def test_data_stores_are_not_published_on_every_interface():
    for name in ("postgres", "postgres-replica", "pgbouncer", "jaeger", "otel-collector"):
        for port in COMPOSE[name].get("ports", []):
            assert str(port).startswith("${DATA_BIND_HOST:-127.0.0.1}:"), (name, port)


def test_database_connections_fit_within_postgres_limit():
    command = " ".join(COMPOSE["postgres"]["command"])
    assert f"max_connections={DB_CLIENT_PROCESS_BUDGET}" in command

    def default(env, key):
        return next(int(re.search(r":-(\d+)\}", item).group(1)) for item in env if item.startswith(f"{key}="))

    def workers(service):
        found = re.search(r"--workers (?:\$\{\w+:-)?(\d+)", service["command"])
        return int(found.group(1))

    total = 0
    for name, service in COMPOSE.items():
        env = service.get("environment")
        if isinstance(env, list) and any(item.startswith("DB_POOL_SIZE=") for item in env):
            total += workers(service) * (default(env, "DB_POOL_SIZE") + default(env, "DB_MAX_OVERFLOW"))
    assert 0 < total < DB_CLIENT_PROCESS_BUDGET - 20  # room for admin, migration and reporting connections
