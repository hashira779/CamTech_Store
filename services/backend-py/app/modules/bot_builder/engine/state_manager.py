"""
State Manager — manages per-user conversation state for multi-step workflows.
Handles creating, advancing, resetting, and expiring conversation states.
"""
import logging
from typing import Any, Dict, List, Optional
from datetime import timedelta

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete

from app.core.datetime_utils import utc_now
from ..models import BotConversationState, gen_id

logger = logging.getLogger("bot_builder.state_manager")

DEFAULT_TTL_MINUTES = 30


class StateManager:
    """Manages conversation state for multi-step bot workflows."""

    @staticmethod
    async def get_or_create(
        db: AsyncSession,
        organization_id: str,
        bot_id: str,
        telegram_user_id: str,
        chat_id: str,
        workflow_id: str,
        workflow_version_id: Optional[str] = None,
    ) -> BotConversationState:
        """Get existing active conversation state or create a new one."""
        result = await db.execute(
            select(BotConversationState).where(
                BotConversationState.bot_id == bot_id,
                BotConversationState.telegram_user_id == telegram_user_id,
                BotConversationState.chat_id == chat_id,
            )
        )
        state = result.scalar_one_or_none()

        # Check expiration
        if state and state.expires_at and state.expires_at < utc_now():
            await db.delete(state)
            await db.flush()
            state = None

        if state:
            return state

        now = utc_now()
        state = BotConversationState(
            id=gen_id(),
            organization_id=organization_id,
            bot_id=bot_id,
            telegram_user_id=telegram_user_id,
            chat_id=chat_id,
            workflow_id=workflow_id,
            workflow_version_id=workflow_version_id,
            current_node_id=None,
            variables={},
            waiting_for_input=False,
            started_at=now,
            updated_at=now,
            expires_at=now + timedelta(minutes=DEFAULT_TTL_MINUTES),
        )
        db.add(state)
        await db.flush()
        return state

    @staticmethod
    async def advance(
        db: AsyncSession,
        state: BotConversationState,
        next_node_id: Optional[str],
        variables: Optional[Dict[str, Any]] = None,
        waiting_for_input: bool = False,
        input_node_id: Optional[str] = None,
    ) -> BotConversationState:
        """Advance state to the next node, update variables."""
        state.current_node_id = next_node_id
        state.waiting_for_input = waiting_for_input
        state.input_node_id = input_node_id if waiting_for_input else None
        if variables:
            merged = dict(state.variables or {})
            merged.update(variables)
            state.variables = merged
        state.updated_at = utc_now()
        # Extend TTL on activity
        state.expires_at = utc_now() + timedelta(minutes=DEFAULT_TTL_MINUTES)
        await db.flush()
        return state

    @staticmethod
    async def reset(
        db: AsyncSession,
        state: BotConversationState,
    ) -> None:
        """Reset the conversation to the beginning."""
        state.current_node_id = None
        state.variables = {}
        state.waiting_for_input = False
        state.input_node_id = None
        state.updated_at = utc_now()
        state.expires_at = utc_now() + timedelta(minutes=DEFAULT_TTL_MINUTES)
        await db.flush()

    @staticmethod
    async def destroy(
        db: AsyncSession,
        state: BotConversationState,
    ) -> None:
        """Remove the conversation state entirely."""
        await db.delete(state)
        await db.flush()

    @staticmethod
    async def cleanup_expired(db: AsyncSession) -> int:
        """Remove all expired conversation states. Returns count deleted."""
        now = utc_now()
        result = await db.execute(
            delete(BotConversationState).where(
                BotConversationState.expires_at < now,
            )
        )
        return result.rowcount or 0
