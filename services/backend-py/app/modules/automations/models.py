import datetime
import uuid
from sqlalchemy import (
    Column,
    String,
    Boolean,
    DateTime,
    ForeignKey,
    JSON,
    Integer
)
from sqlalchemy.dialects.postgresql import ARRAY as PG_ARRAY
from app.core.database import Base

def gen_id():
    return str(uuid.uuid4())

class DeveloperApp(Base):
    __tablename__ = "developer_apps"

    id = Column(String, primary_key=True, default=gen_id)
    organization_id = Column("organizationId", String, ForeignKey("organizations.id"), nullable=False)
    name = Column(String, nullable=False)
    description = Column(String, nullable=True)
    homepage_url = Column("homepageUrl", String, nullable=True)
    created_at = Column("createdAt", DateTime, default=datetime.datetime.utcnow, nullable=False)
    updated_at = Column("updatedAt", DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow, nullable=False)

class ApiKey(Base):
    __tablename__ = "api_keys"

    id = Column(String, primary_key=True, default=gen_id)
    organization_id = Column("organizationId", String, ForeignKey("organizations.id"), nullable=False)
    app_id = Column("appId", String, ForeignKey("developer_apps.id"), nullable=True)
    name = Column(String, nullable=False)
    key_prefix = Column("keyPrefix", String, nullable=False)
    key_hash = Column("keyHash", String, unique=True, nullable=False)
    scopes = Column("scopes", PG_ARRAY(String), nullable=False)
    rate_limit = Column("rateLimit", Integer, default=60, nullable=False)
    expires_at = Column("expiresAt", DateTime, nullable=True)
    last_used_at = Column("lastUsedAt", DateTime, nullable=True)
    revoked_at = Column("revokedAt", DateTime, nullable=True)
    created_at = Column("createdAt", DateTime, default=datetime.datetime.utcnow, nullable=False)

class WebhookSubscription(Base):
    __tablename__ = "webhook_subscriptions"

    id = Column(String, primary_key=True, default=gen_id)
    organization_id = Column("organizationId", String, ForeignKey("organizations.id"), nullable=False)
    url = Column(String, nullable=False)
    secret = Column(String, nullable=False)
    description = Column(String, nullable=True)
    events = Column("events", PG_ARRAY(String), nullable=False)
    is_active = Column("isActive", Boolean, default=True, nullable=False)
    created_at = Column("createdAt", DateTime, default=datetime.datetime.utcnow, nullable=False)
    updated_at = Column("updatedAt", DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow, nullable=False)

class TelegramBot(Base):
    __tablename__ = "telegram_bots"

    id = Column(String, primary_key=True, default=gen_id)
    organization_id = Column("organizationId", String, ForeignKey("organizations.id"), nullable=False)
    name = Column(String, nullable=False)
    bot_token = Column("botToken", String, nullable=False)
    bot_username = Column("botUsername", String, nullable=True)
    description = Column(String, nullable=True)
    purpose = Column(String, default="GENERAL", nullable=False)
    default_chat_id = Column("defaultChatId", String, nullable=True)
    is_active = Column("isActive", Boolean, default=True, nullable=False)
    is_primary = Column("isPrimary", Boolean, default=False, nullable=False)
    status = Column(String, default="CONNECTED", nullable=False)
    last_tested_at = Column("lastTestedAt", DateTime, nullable=True)
    created_at = Column("createdAt", DateTime, default=datetime.datetime.utcnow, nullable=False)
    updated_at = Column("updatedAt", DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow, nullable=False)

class TelegramChatBinding(Base):
    __tablename__ = "telegram_chat_bindings"

    id = Column(String, primary_key=True, default=gen_id)
    organization_id = Column("organizationId", String, ForeignKey("organizations.id"), nullable=False)
    bot_id = Column("botId", String, ForeignKey("telegram_bots.id"), nullable=True)
    chat_id = Column("chatId", String, nullable=False)
    chat_title = Column("chatTitle", String, nullable=True)
    username = Column(String, nullable=True)
    binding_type = Column("bindingType", String, default="GROUP", nullable=False)
    role = Column(String, default="OPERATOR", nullable=False)
    is_active = Column("isActive", Boolean, default=True, nullable=False)
    bound_by_user_id = Column("boundByUserId", String, nullable=True)
    created_at = Column("createdAt", DateTime, default=datetime.datetime.utcnow, nullable=False)
    updated_at = Column("updatedAt", DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow, nullable=False)

class AutomationFlow(Base):
    __tablename__ = "automation_flows"

    id = Column(String, primary_key=True, default=gen_id)
    organization_id = Column("organizationId", String, ForeignKey("organizations.id"), nullable=False)
    name = Column(String, nullable=False)
    description = Column(String, nullable=True)
    is_active = Column("isActive", Boolean, default=True, nullable=False)
    trigger_type = Column("triggerType", String, default="MANUAL", nullable=False)
    nodes = Column(JSON, default=list, nullable=False)
    edges = Column(JSON, default=list, nullable=False)
    created_at = Column("createdAt", DateTime, default=datetime.datetime.utcnow, nullable=False)
    updated_at = Column("updatedAt", DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow, nullable=False)

class FlowExecution(Base):
    __tablename__ = "flow_executions"

    id = Column(String, primary_key=True, default=gen_id)
    organization_id = Column("organizationId", String, ForeignKey("organizations.id"), nullable=False)
    flow_id = Column("flowId", String, ForeignKey("automation_flows.id"), nullable=False)
    trigger_type = Column("triggerType", String, nullable=False)
    status = Column(String, default="RUNNING", nullable=False)
    trigger_payload = Column("triggerPayload", JSON, default=dict, nullable=False)
    execution_trace = Column("executionTrace", JSON, default=list, nullable=False)
    started_at = Column("startedAt", DateTime, default=datetime.datetime.utcnow, nullable=False)
    finished_at = Column("finishedAt", DateTime, nullable=True)
