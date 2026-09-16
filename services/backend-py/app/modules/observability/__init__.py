"""Observability & telemetry storage for the Infra & Security Control Center.

This module owns the *measurement* layer: capturing what actually happened,
storing it at volume, and answering questions about it. It deliberately owns no
opinions — detection, risk scoring, incidents and response actions belong to the
infra/security module that consumes these queries.

Wiring (one call each, see docs/control-center/TELEMETRY_LAYER.md):

    from app.modules.observability import (
        ObservabilityCaptureMiddleware, start_ingestion, stop_ingestion,
    )
    from app.modules.observability.api import router as observability_router

    app.add_middleware(ObservabilityCaptureMiddleware)
    app.include_router(observability_router, prefix="/api/v1")
    # on startup:  await start_ingestion(engine)
    # on shutdown: await stop_ingestion()
"""

# Importing models here registers the telemetry tables in Base.metadata, so
# create_all (used by CI and by scripts/auto_migrate.py) provisions them.
from . import models as models  # noqa: F401
from .ingestion import TelemetryIngestor, get_ingestor, ingestion_enabled, start_ingestion, stop_ingestion
from .middleware import ObservabilityCaptureMiddleware, record_actor, template_route
from .records import ApiRequestRecord, IngestionStats, LogEventRecord, SpanRecord
from .repository import PostgresTelemetryRepository, TelemetryQuery, TelemetrySink

__all__ = [
    "ApiRequestRecord",
    "IngestionStats",
    "LogEventRecord",
    "ObservabilityCaptureMiddleware",
    "PostgresTelemetryRepository",
    "SpanRecord",
    "TelemetryIngestor",
    "TelemetryQuery",
    "TelemetrySink",
    "get_ingestor",
    "ingestion_enabled",
    "record_actor",
    "start_ingestion",
    "stop_ingestion",
    "template_route",
]
