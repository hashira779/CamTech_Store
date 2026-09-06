"""
Bot Builder — SQLAlchemy Models.
Defines the core data models for the visual Telegram bot builder:
  - BotWorkflow: links a TelegramBot to a visual workflow with draft state
  - BotWorkflowVersion: immutable published snapshot
  - BotCommand: Telegram commands configured for a bot
  - BotConversationState: per-user multi-step conversation state
  - BotExecution: audit trail of every Telegram update processed
"""
import uuid
from sqlalchemy import (
    Column,
    String,
    Boolean,
    DateTime,
    ForeignKey,
    JSON,
    Integer,
    Text,
    Index,
)
from app.core.database import Base
from app.core.datetime_utils import utc_now


def gen_id():
    return str(uuid.uuid4())


class BotWorkflow(Base):
    """A visual workflow attached to a TelegramBot.
    Contains the mutable draft state (nodes/edges) and a pointer
    to the currently published immutable version."""
    __tablename__ = "bot_workflows"

    id = Column(String, primary_key=True, default=gen_id)
    organization_id = Column("organizationId", String, ForeignKey("organizations.id"), nullable=False)
    bot_id = Column("botId", String, ForeignKey("telegram_bots.id", ondelete="CASCADE"), nullable=False)
    name = Column(String, nullable=False)
    description = Column(String, nullable=True)
    # Draft state — mutable, saved on every "Save Draft"
    status = Column(String, default="DRAFT", nullable=False)  # DRAFT | PUBLISHED | PAUSED
    draft_nodes = Column("draftNodes", JSON, default=list, nullable=False)
    draft_edges = Column("draftEdges", JSON, default=list, nullable=False)
    draft_variables = Column("draftVariables", JSON, default=list, nullable=False)
    # Pointer to the currently active published version
    published_version_id = Column("publishedVersionId", String, nullable=True)
    published_version_number = Column("publishedVersionNumber", Integer, default=0, nullable=False)
    created_by = Column("createdBy", String, nullable=True)
    created_at = Column("createdAt", DateTime, default=utc_now, nullable=False)
    updated_at = Column("updatedAt", DateTime, default=utc_now, onupdate=utc_now, nullable=False)

    __table_args__ = (
        Index("ix_bot_workflows_org", "organizationId"),
        Index("ix_bot_workflows_bot", "botId"),
    )


class BotWorkflowVersion(Base):
    """Immutable snapshot of a published workflow.
    Once created, nodes/edges/variables are never modified.
    Rollback = point BotWorkflow.published_version_id to an older version."""
    __tablename__ = "bot_workflow_versions"

    id = Column(String, primary_key=True, default=gen_id)
    organization_id = Column("organizationId", String, ForeignKey("organizations.id"), nullable=False)
    workflow_id = Column("workflowId", String, ForeignKey("bot_workflows.id", ondelete="CASCADE"), nullable=False)
    version_number = Column("versionNumber", Integer, nullable=False)
    nodes = Column(JSON, default=list, nullable=False)
    edges = Column(JSON, default=list, nullable=False)
    variables = Column(JSON, default=list, nullable=False)
    commands = Column(JSON, default=list, nullable=False)  # snapshot of commands at publish time
    published_by = Column("publishedBy", String, nullable=True)
    published_at = Column("publishedAt", DateTime, default=utc_now, nullable=False)
    notes = Column(String, nullable=True)

    __table_args__ = (
        Index("ix_bot_wf_versions_workflow", "workflowId"),
    )


class BotCommand(Base):
    """A Telegram command configured for a bot (e.g. /start, /help, /orders).
    Linked to a workflow that fires when the command is received."""
    __tablename__ = "bot_commands"

    id = Column(String, primary_key=True, default=gen_id)
    organization_id = Column("organizationId", String, ForeignKey("organizations.id"), nullable=False)
    bot_id = Column("botId", String, ForeignKey("telegram_bots.id", ondelete="CASCADE"), nullable=False)
    command = Column(String, nullable=False)  # e.g. "/start"
    description = Column(String, nullable=True)
    workflow_id = Column("workflowId", String, ForeignKey("bot_workflows.id", ondelete="SET NULL"), nullable=True)
    scope = Column(String, default="default", nullable=False)  # default | all_private_chats | all_group_chats
    is_active = Column("isActive", Boolean, default=True, nullable=False)
    created_at = Column("createdAt", DateTime, default=utc_now, nullable=False)
    updated_at = Column("updatedAt", DateTime, default=utc_now, onupdate=utc_now, nullable=False)

    __table_args__ = (
        Index("ix_bot_commands_bot", "botId"),
    )


class BotConversationState(Base):
    """Tracks the current position of a Telegram user inside a multi-step
    workflow conversation. Auto-expires after a configurable TTL."""
    __tablename__ = "bot_conversation_states"

    id = Column(String, primary_key=True, default=gen_id)
    organization_id = Column("organizationId", String, ForeignKey("organizations.id"), nullable=False)
    bot_id = Column("botId", String, ForeignKey("telegram_bots.id", ondelete="CASCADE"), nullable=False)
    telegram_user_id = Column("telegramUserId", String, nullable=False)
    chat_id = Column("chatId", String, nullable=False)
    workflow_id = Column("workflowId", String, nullable=False)
    workflow_version_id = Column("workflowVersionId", String, nullable=True)
    current_node_id = Column("currentNodeId", String, nullable=True)
    variables = Column(JSON, default=dict, nullable=False)
    waiting_for_input = Column("waitingForInput", Boolean, default=False, nullable=False)
    input_node_id = Column("inputNodeId", String, nullable=True)
    started_at = Column("startedAt", DateTime, default=utc_now, nullable=False)
    updated_at = Column("updatedAt", DateTime, default=utc_now, onupdate=utc_now, nullable=False)
    expires_at = Column("expiresAt", DateTime, nullable=True)

    __table_args__ = (
        Index("ix_bot_conv_state_lookup", "botId", "telegramUserId", "chatId"),
    )


class BotExecution(Base):
    """Audit record of a single Telegram update processed by the runtime.
    Includes the full execution trace (which nodes ran, duration, errors)."""
    __tablename__ = "bot_executions"

    id = Column(String, primary_key=True, default=gen_id)
    organization_id = Column("organizationId", String, ForeignKey("organizations.id"), nullable=False)
    bot_id = Column("botId", String, ForeignKey("telegram_bots.id", ondelete="CASCADE"), nullable=False)
    workflow_id = Column("workflowId", String, nullable=True)
    workflow_version_id = Column("workflowVersionId", String, nullable=True)
    version_number = Column("versionNumber", Integer, nullable=True)
    telegram_user_id = Column("telegramUserId", String, nullable=True)
    chat_id = Column("chatId", String, nullable=True)
    trigger_type = Column("triggerType", String, nullable=False)  # command | message | callback_query | webhook
    trigger_data = Column("triggerData", JSON, default=dict, nullable=False)
    execution_trace = Column("executionTrace", JSON, default=list, nullable=False)
    status = Column(String, default="RUNNING", nullable=False)  # RUNNING | SUCCESS | FAILED
    error_message = Column("errorMessage", Text, nullable=True)
    started_at = Column("startedAt", DateTime, default=utc_now, nullable=False)
    finished_at = Column("finishedAt", DateTime, nullable=True)

    __table_args__ = (
        Index("ix_bot_executions_bot", "botId"),
        Index("ix_bot_executions_org", "organizationId"),
    )
