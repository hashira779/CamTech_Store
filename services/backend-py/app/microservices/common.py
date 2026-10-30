from fastapi import FastAPI, Request, Response

from app.core.http_edge import EdgePolicy, add_cors, add_gzip, client_ip, install_edge

# Import the full entity graph so EVERY microservice registers all SQLAlchemy
# models — a service that mounts only a few routers would otherwise have an
# incomplete mapper registry and 500 with `KeyError: 'Organization'` on the first
# query that touches a cross-module relationship (FKs to organizations, users, …).
import app.models.entities  # noqa: F401
from sqlalchemy.orm import configure_mappers as _configure_mappers

from app.core.telemetry import setup_structured_logging, get_logger

setup_structured_logging()
logger = get_logger("mystore.microservice")


def _traffic_recorder(app: FastAPI):
    def record(request: Request, response: Response, duration_ms: float, request_id: str, trace_id: str) -> None:
        path = request.url.path
        if not path.startswith("/api/v1/") or path.startswith("/api/v1/infra/events/stream"):
            return
        try:
            from app.modules.infra.service import LiveTrafficMonitor
            LiveTrafficMonitor.record(
                method=request.method,
                path=path,
                status_code=response.status_code,
                duration_ms=duration_ms,
                client_ip=client_ip(request, default="127.0.0.1"),
                target_service=getattr(app, "title", "microservice").split("(")[0].strip(),
                request_id=request_id,
                trace_id=trace_id,
            )
        except Exception:
            pass

    return record


def create_microservice(name: str, description: str, port: int, lifespan=None) -> FastAPI:
    """
    Factory function for independent MyStore microservices.
    Configures CORS, the enterprise response envelope, health probes, and OpenAPI docs.
    """
    app = FastAPI(
        title=f"MyStore {name} (Port {port})",
        description=description,
        version="2.0.0",
        docs_url="/docs",
        openapi_url="/openapi.json",
        lifespan=lifespan,
    )

    add_cors(app)
    install_edge(app, EdgePolicy(logger=logger, on_served=_traffic_recorder(app)))
    add_gzip(app)

    # Eagerly wire up all ORM relationships now that the full registry is loaded.
    _configure_mappers()

    @app.get("/health")
    async def health():
        return {"status": "healthy", "service": name, "port": port}

    return app
