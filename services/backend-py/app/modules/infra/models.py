import uuid
from sqlalchemy import (
    Column,
    String,
    Boolean,
    Numeric,
    Integer,
    DateTime,
    ForeignKey,
    Text,
    JSON,
)
from sqlalchemy.orm import relationship
from app.core.database import Base
from app.core.datetime_utils import utc_now

def gen_id():
    return str(uuid.uuid4())


class InfraService(Base):
    __tablename__ = "infra_services"

    id = Column(String, primary_key=True, default=gen_id)
    name = Column(String, nullable=False, unique=True)
    port = Column(Integer, nullable=False)
    role = Column(String, nullable=False)
    version = Column(String, default="2.0.0", nullable=False)
    status = Column(String, default="HEALTHY", nullable=False)
    instances_count = Column("instancesCount", Integer, default=1, nullable=False)
    uptime_seconds = Column("uptimeSeconds", Integer, default=0, nullable=False)
    requests_per_sec = Column("requestsPerSec", Numeric(10, 2), default=0.0, nullable=False)
    error_rate_pct = Column("errorRatePct", Numeric(6, 4), default=0.0, nullable=False)
    p95_latency_ms = Column("p95LatencyMs", Numeric(10, 2), default=0.0, nullable=False)
    cpu_pct = Column("cpuPct", Numeric(6, 2), default=0.0, nullable=False)
    memory_pct = Column("memoryPct", Numeric(6, 2), default=0.0, nullable=False)
    db_ping_ms = Column("dbPingMs", Numeric(10, 2), nullable=True)
    created_at = Column("createdAt", DateTime, default=utc_now, nullable=False)
    updated_at = Column("updatedAt", DateTime, default=utc_now, onupdate=utc_now, nullable=False)


class InfraServiceDependency(Base):
    __tablename__ = "infra_service_dependencies"

    id = Column(String, primary_key=True, default=gen_id)
    source_service_id = Column("sourceServiceId", String, nullable=False)
    target_service_id = Column("targetServiceId", String, nullable=False)
    protocol = Column(String, default="HTTP/REST", nullable=False)
    is_healthy = Column("isHealthy", Boolean, default=True, nullable=False)
    created_at = Column("createdAt", DateTime, default=utc_now, nullable=False)


class InfraSecurityEvent(Base):
    __tablename__ = "infra_security_events"

    id = Column(String, primary_key=True, default=gen_id)
    severity = Column(String, default="MEDIUM", nullable=False)
    category = Column(String, nullable=False)
    rule_id = Column("ruleId", String, nullable=False)
    title = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    source_ip = Column("sourceIp", String, nullable=False)
    country = Column(String, nullable=True)
    asn = Column(String, nullable=True)
    affected_service = Column("affectedService", String, nullable=False)
    signals = Column(JSON, nullable=True)
    action_taken = Column("actionTaken", String, nullable=True)
    created_at = Column("createdAt", DateTime, default=utc_now, nullable=False)


class InfraIncident(Base):
    __tablename__ = "infra_incidents"

    id = Column(String, primary_key=True, default=gen_id)
    incident_number = Column("incidentNumber", String, nullable=False, unique=True)
    severity = Column(String, default="SEV3", nullable=False)
    status = Column(String, default="DETECTED", nullable=False)
    title = Column(String, nullable=False)
    description = Column(Text, nullable=False)
    affected_services = Column("affectedServices", JSON, nullable=False)
    owner_id = Column("ownerId", String, nullable=True)
    first_seen_at = Column("firstSeenAt", DateTime, default=utc_now, nullable=False)
    last_updated_at = Column("lastUpdatedAt", DateTime, default=utc_now, onupdate=utc_now, nullable=False)
    resolved_at = Column("resolvedAt", DateTime, nullable=True)
    created_at = Column("createdAt", DateTime, default=utc_now, nullable=False)

    timeline_entries = relationship("InfraIncidentTimeline", back_populates="incident", cascade="all, delete-orphan")


class InfraIncidentTimeline(Base):
    __tablename__ = "infra_incident_timeline"

    id = Column(String, primary_key=True, default=gen_id)
    incident_id = Column("incidentId", String, ForeignKey("infra_incidents.id", ondelete="CASCADE"), nullable=False)
    actor = Column(String, nullable=False)
    action_type = Column("actionType", String, nullable=False)
    description = Column(Text, nullable=False)
    evidence_ref = Column("evidenceRef", String, nullable=True)
    created_at = Column("createdAt", DateTime, default=utc_now, nullable=False)

    incident = relationship("InfraIncident", back_populates="timeline_entries")


class InfraDeployment(Base):
    __tablename__ = "infra_deployments"

    id = Column(String, primary_key=True, default=gen_id)
    service = Column(String, nullable=False)
    version = Column(String, nullable=False)
    commit_hash = Column("commitHash", String, nullable=False)
    commit_message = Column("commitMessage", String, nullable=True)
    environment = Column(String, default="production", nullable=False)
    deployer_name = Column("deployerName", String, nullable=False)
    rollback_state = Column("rollbackState", String, default="STABLE", nullable=False)
    error_rate_delta = Column("errorRateDelta", Numeric(6, 4), default=0.0, nullable=False)
    latency_delta_ms = Column("latencyDeltaMs", Numeric(10, 2), default=0.0, nullable=False)
    deployed_at = Column("deployedAt", DateTime, default=utc_now, nullable=False)


class InfraBreakGlassSession(Base):
    __tablename__ = "infra_break_glass_sessions"

    id = Column(String, primary_key=True, default=gen_id)
    actor_id = Column("actorId", String, nullable=False)
    actor_email = Column("actorEmail", String, nullable=False)
    reason = Column(Text, nullable=False)
    ip = Column(String, nullable=True)
    is_active = Column("isActive", Boolean, default=True, nullable=False)
    activated_at = Column("activatedAt", DateTime, default=utc_now, nullable=False)
    expires_at = Column("expiresAt", DateTime, nullable=False)
