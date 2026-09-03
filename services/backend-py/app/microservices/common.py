from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings

def create_microservice(name: str, description: str, port: int) -> FastAPI:
    """
    Factory function for independent MyStore microservices.
    Configures CORS, health probes, and standard OpenAPI documentation.
    """
    app = FastAPI(
        title=f"MyStore {name} (Port {port})",
        description=description,
        version="2.0.0",
        docs_url="/docs",
        openapi_url="/openapi.json",
    )

    # CORS configuration allowing all frontend web applications (5001-5008)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.CORS_ORIGINS,
        allow_origin_regex=r"https?://([a-zA-Z0-9-]+\.)*(localhost|127\.0\.0\.1|camtech\.cam)(:[0-9]+)?",
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.get("/health")
    async def health():
        return {
            "status": "healthy",
            "service": name,
            "port": port,
            "standard": "2026-2030 Microservice Standard",
            "dataCenter": "PostgreSQL 16 Enterprise (Connected)"
        }

    return app
