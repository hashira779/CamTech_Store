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


# ═════════════════════════════════════════════════════════════════════════════
# ICP — Infrastructure Control Platform Models
# ═════════════════════════════════════════════════════════════════════════════

class InfraAgent(Base):
    """A registered server agent managed by the control center."""
    __tablename__ = "infra_agents"

    id = Column(String, primary_key=True, default=gen_id)
    hostname = Column(String, nullable=False)
    ip_address = Column("ipAddress", String, nullable=False)
    os_type = Column("osType", String, default="linux", nullable=False)
    agent_port = Column("agentPort", Integer, default=9100, nullable=False)
    api_key_hash = Column("apiKeyHash", String, nullable=False)
    status = Column(String, default="ONLINE", nullable=False)
    version = Column(String, default="1.0.0", nullable=False)
    tags = Column(JSON, default=list)
    latest_metrics = Column("latestMetrics", JSON, nullable=True)
    last_heartbeat_at = Column("lastHeartbeatAt", DateTime, nullable=True)
    created_at = Column("createdAt", DateTime, default=utc_now, nullable=False)
    updated_at = Column("updatedAt", DateTime, default=utc_now, onupdate=utc_now, nullable=False)


class InfraAgentCommand(Base):
    """Audit trail of every command sent to an agent."""
    __tablename__ = "infra_agent_commands"

    id = Column(String, primary_key=True, default=gen_id)
    agent_id = Column("agentId", String, ForeignKey("infra_agents.id"), nullable=False)
    actor_id = Column("actorId", String, nullable=False)
    command = Column(String, nullable=False)
    parameters = Column(JSON, default=dict)
    status = Column(String, default="PENDING", nullable=False)
    result = Column(Text, nullable=True)
    executed_at = Column("executedAt", DateTime, nullable=True)
    created_at = Column("createdAt", DateTime, default=utc_now, nullable=False)


class InfraScheduledTask(Base):
    """Cron-based scheduled tasks pushed to agents."""
    __tablename__ = "infra_scheduled_tasks"

    id = Column(String, primary_key=True, default=gen_id)
    name = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    agent_id = Column("agentId", String, ForeignKey("infra_agents.id"), nullable=True)
    cron_expr = Column("cronExpr", String, nullable=False)
    command = Column(String, nullable=False)
    parameters = Column(JSON, default=dict)
    enabled = Column(Boolean, default=True, nullable=False)
    last_run_at = Column("lastRunAt", DateTime, nullable=True)
    next_run_at = Column("nextRunAt", DateTime, nullable=True)
    last_result = Column("lastResult", Text, nullable=True)
    created_at = Column("createdAt", DateTime, default=utc_now, nullable=False)
    updated_at = Column("updatedAt", DateTime, default=utc_now, onupdate=utc_now, nullable=False)


class InfraServerMetric(Base):
    """Time-series metrics snapshots from server agents."""
    __tablename__ = "infra_server_metrics"

    id = Column(String, primary_key=True, default=gen_id)
    agent_id = Column("agentId", String, ForeignKey("infra_agents.id"), nullable=False)
    cpu_pct = Column("cpuPct", Numeric(6, 2), nullable=True)
    memory_pct = Column("memoryPct", Numeric(6, 2), nullable=True)
    memory_used_mb = Column("memoryUsedMb", Numeric(12, 2), nullable=True)
    memory_total_mb = Column("memoryTotalMb", Numeric(12, 2), nullable=True)
    disk_pct = Column("diskPct", Numeric(6, 2), nullable=True)
    disk_used_gb = Column("diskUsedGb", Numeric(12, 2), nullable=True)
    disk_total_gb = Column("diskTotalGb", Numeric(12, 2), nullable=True)
    network_in_mbps = Column("networkInMbps", Numeric(10, 2), nullable=True)
    network_out_mbps = Column("networkOutMbps", Numeric(10, 2), nullable=True)
    load_avg_1 = Column("loadAvg1", Numeric(8, 2), nullable=True)
    load_avg_5 = Column("loadAvg5", Numeric(8, 2), nullable=True)
    load_avg_15 = Column("loadAvg15", Numeric(8, 2), nullable=True)
    container_count = Column("containerCount", Integer, default=0)
    process_count = Column("processCount", Integer, default=0)
    uptime_seconds = Column("uptimeSeconds", Integer, nullable=True)
    recorded_at = Column("recordedAt", DateTime, default=utc_now, nullable=False)


class InfraCloudflareConfig(Base):
    """Cloudflare zone configuration with encrypted API tokens."""
    __tablename__ = "infra_cloudflare_configs"

    id = Column(String, primary_key=True, default=gen_id)
    zone_name = Column("zoneName", String, nullable=False)
    zone_id = Column("zoneId", String, nullable=False)
    api_token_encrypted = Column("apiTokenEncrypted", Text, nullable=False)
    account_id = Column("accountId", String, nullable=True)
    enabled = Column(Boolean, default=True, nullable=False)
    created_at = Column("createdAt", DateTime, default=utc_now, nullable=False)


class InfraAlertRule(Base):
    """Threshold-based alert rules for automated monitoring."""
    __tablename__ = "infra_alert_rules"

    id = Column(String, primary_key=True, default=gen_id)
    name = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    category = Column(String, default="INFRA", nullable=False)
    severity = Column(String, default="HIGH", nullable=False)
    condition = Column(JSON, nullable=False)
    enabled = Column(Boolean, default=True, nullable=False)
    channels = Column(JSON, default=list)
    cooldown_sec = Column("cooldownSec", Integer, default=300, nullable=False)
    created_at = Column("createdAt", DateTime, default=utc_now, nullable=False)


class InfraAlert(Base):
    """Fired alerts with status tracking."""
    __tablename__ = "infra_alerts"

    id = Column(String, primary_key=True, default=gen_id)
    rule_id = Column("ruleId", String, ForeignKey("infra_alert_rules.id"), nullable=True)
    agent_id = Column("agentId", String, ForeignKey("infra_agents.id"), nullable=True)
    severity = Column(String, nullable=False)
    status = Column(String, default="FIRING", nullable=False)
    title = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    fired_at = Column("firedAt", DateTime, default=utc_now, nullable=False)
    acknowledged_at = Column("acknowledgedAt", DateTime, nullable=True)
    acknowledged_by = Column("acknowledgedBy", String, nullable=True)
    resolved_at = Column("resolvedAt", DateTime, nullable=True)


class InfraNotificationChannel(Base):
    """Notification channel configuration (Telegram, Email, Slack, Webhook)."""
    __tablename__ = "infra_notification_channels"

    id = Column(String, primary_key=True, default=gen_id)
    type = Column(String, nullable=False)
    name = Column(String, nullable=False)
    config = Column(JSON, nullable=False)
    enabled = Column(Boolean, default=True, nullable=False)
    created_at = Column("createdAt", DateTime, default=utc_now, nullable=False)
