"""
Bot Builder — Runtime Controller.
The universal Telegram webhook handler and webhook registration endpoints.
This is the heart of the no-code bot engine: it receives Telegram updates,
resolves the published workflow, and executes nodes dynamically.
"""
import logging
import time
from typing import Any, Dict, Optional
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.core.datetime_utils import utc_now
from app.core.dependencies import get_current_user, TenantUser
from app.core.crypto import EncryptionService
from app.modules.automations.models import TelegramBot
from ..models import (
    BotWorkflow, BotWorkflowVersion, BotCommand,
    BotConversationState, BotExecution, gen_id,
)
from ..schemas import RegisterWebhookInput
from ..engine.telegram_adapter import TelegramAdapter
from ..engine.node_executor import NodeExecutor
from ..engine.state_manager import StateManager
from ..engine.variable_resolver import build_context, resolve_template

logger = logging.getLogger("bot_builder.runtime")

router = APIRouter(tags=["Bot Builder — Runtime"])


# ─── Webhook Registration ───────────────────────────────────────────────────

@router.post("/bot-builder/bots/{bot_id}/register-webhook")
async def register_webhook(
    bot_id: str,
    data: RegisterWebhookInput,
    user: TenantUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    bot = await _get_bot(db, bot_id, user.organization_id)
    token = _decrypt_token(bot)
    adapter = TelegramAdapter(token)

    webhook_url = data.webhookUrl.rstrip("/")
    if not webhook_url.endswith(f"/bot-builder/webhook/{bot_id}"):
        webhook_url = f"{webhook_url}/api/v1/bot-builder/webhook/{bot_id}"

    result = await adapter.set_webhook(webhook_url, data.secretToken)
    return {
        "success": result.get("ok", False),
        "webhookUrl": webhook_url,
        "description": result.get("description", ""),
    }


@router.post("/bot-builder/bots/{bot_id}/remove-webhook")
async def remove_webhook(
    bot_id: str,
    user: TenantUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    bot = await _get_bot(db, bot_id, user.organization_id)
    token = _decrypt_token(bot)
    adapter = TelegramAdapter(token)
    result = await adapter.delete_webhook()
    return {"success": result.get("ok", False)}


# ─── Webhook Handler (Telegram sends updates here) ──────────────────────────

@router.post("/bot-builder/webhook/{bot_id}")
async def handle_telegram_webhook(
    bot_id: str,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Universal Telegram update handler — the core of the no-code bot engine.
    This endpoint is called by Telegram for every incoming message/callback/etc.
    It does NOT require user authentication (Telegram calls it directly)."""
    start_time = time.time()

    try:
        update = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON body")

    # ── 1. Resolve Bot ──
    bot_result = await db.execute(
        select(TelegramBot).where(TelegramBot.id == bot_id, TelegramBot.is_active == True)
    )
    bot = bot_result.scalar_one_or_none()
    if not bot:
        return {"ok": True, "skipped": "bot_not_found"}

    token = _decrypt_token(bot)
    adapter = TelegramAdapter(token)
    executor = NodeExecutor(adapter, db=db, organization_id=bot.organization_id)

    # ── 2. Extract update info ──
    message = update.get("message") or update.get("edited_message")
    callback_query = update.get("callback_query")

    chat_id: Optional[str] = None
    telegram_user: Optional[Dict] = None
    text: Optional[str] = None
    command: Optional[str] = None
    callback_data: Optional[str] = None
    callback_query_id: Optional[str] = None
    trigger_type = "message"

    if callback_query:
        telegram_user = callback_query.get("from", {})
        chat_id = str(callback_query.get("message", {}).get("chat", {}).get("id", ""))
        callback_data = callback_query.get("data", "")
        callback_query_id = callback_query.get("id")
        trigger_type = "callback_query"
    elif message:
        telegram_user = message.get("from", {})
        chat_id = str(message.get("chat", {}).get("id", ""))
        text = message.get("text", "")
        if text and text.startswith("/"):
            command = text.split()[0].split("@")[0].lower()
            trigger_type = "command"
        else:
            trigger_type = "message"

    if not chat_id or not telegram_user:
        return {"ok": True, "skipped": "no_chat_or_user"}

    telegram_user_id = str(telegram_user.get("id", ""))

    # ── 3. Resolve Workflow ──
    workflow, version = await _resolve_workflow(
        db, bot.id, bot.organization_id, command, callback_data,
    )

    if not workflow or not version:
        # If /start and no workflow, send a default greeting
        if command == "/start":
            await adapter.send_message(chat_id, f"👋 Welcome! I'm {bot.name}.")
        return {"ok": True, "skipped": "no_workflow"}

    nodes = version.nodes or []
    edges = version.edges or []

    # ── 4. Get/Create conversation state ──
    state = await StateManager.get_or_create(
        db, bot.organization_id, bot.id,
        telegram_user_id, chat_id,
        workflow.id, version.id,
    )

    # Build variable context
    input_data: Dict[str, Any] = {}
    if text:
        input_data["message"] = text
        input_data["text"] = text
    if callback_data:
        input_data["callbackData"] = callback_data
        input_data["button"] = callback_data
    if command:
        input_data["command"] = command

    context = build_context(
        telegram_user=telegram_user,
        input_data=input_data,
        conversation_vars=state.variables or {},
    )

    # ── 5. Determine starting node ──
    execution_trace = []

    # If waiting for input, continue from that node
    if state.waiting_for_input and state.input_node_id:
        # Store the user's response
        context["input"]["response"] = text or callback_data or ""

        # Find the input node and resolve next
        input_node = _find_node(nodes, state.input_node_id)
        if input_node:
            # For inline keyboards waiting for callback, match callback_data to edge handles
            if callback_data:
                next_node_id = _find_callback_edge(state.input_node_id, edges, callback_data)
            else:
                next_node_id = NodeExecutor._find_next(state.input_node_id, edges)

            if callback_query_id:
                await adapter.answer_callback_query(callback_query_id)

            if next_node_id:
                await StateManager.advance(
                    db, state, next_node_id,
                    variables={"input": input_data},
                    waiting_for_input=False,
                )
                current_node_id = next_node_id
            else:
                # No next node — conversation ends
                await StateManager.reset(db, state)
                return {"ok": True}
        else:
            await StateManager.reset(db, state)
            return {"ok": True}
    elif command == "/start" or not state.current_node_id:
        # Start from the beginning
        await StateManager.reset(db, state)
        current_node_id = _find_start_node(nodes, command)
    else:
        current_node_id = state.current_node_id

    if not current_node_id:
        return {"ok": True, "skipped": "no_start_node"}

    # ── 6. Execute node chain ──
    max_steps = 20  # Safety limit to prevent infinite loops
    step_count = 0

    while current_node_id and step_count < max_steps:
        step_count += 1
        node = _find_node(nodes, current_node_id)
        if not node:
            break

        step_start = time.time()
        result = await executor.execute_node(
            node, edges, context, chat_id, callback_query_id,
        )
        step_duration = int((time.time() - step_start) * 1000)

        execution_trace.append({
            "nodeId": current_node_id,
            "nodeName": node.get("data", {}).get("label", node.get("type", "")),
            "nodeType": node.get("type", ""),
            "status": "SUCCESS" if result.success else "FAILED",
            "inputData": {"context_keys": list(context.keys())},
            "outputData": result.output_data,
            "errorMessage": result.error,
            "durationMs": step_duration,
        })

        # Merge updated variables
        if result.updated_variables:
            context.update(result.updated_variables)

        if result.wait_for_input:
            await StateManager.advance(
                db, state, current_node_id,
                variables=result.updated_variables,
                waiting_for_input=True,
                input_node_id=result.input_node_id or current_node_id,
            )
            break

        if not result.success and not result.next_node_id:
            break

        current_node_id = result.next_node_id
        if current_node_id:
            await StateManager.advance(
                db, state, current_node_id,
                variables=result.updated_variables,
            )

    # ── 7. Record execution ──
    duration_ms = int((time.time() - start_time) * 1000)
    execution = BotExecution(
        id=gen_id(),
        organization_id=bot.organization_id,
        bot_id=bot.id,
        workflow_id=workflow.id,
        workflow_version_id=version.id,
        version_number=version.version_number,
        telegram_user_id=telegram_user_id,
        chat_id=chat_id,
        trigger_type=trigger_type,
        trigger_data={"text": text, "command": command, "callbackData": callback_data},
        execution_trace=execution_trace,
        status="SUCCESS" if all(t.get("status") == "SUCCESS" for t in execution_trace) else "FAILED",
        started_at=utc_now(),
        finished_at=utc_now(),
    )
    db.add(execution)
    await db.commit()

    return {"ok": True, "steps": len(execution_trace), "durationMs": duration_ms}


# ─── Helpers ────────────────────────────────────────────────────────────────

async def _get_bot(db: AsyncSession, bot_id: str, org_id: str) -> TelegramBot:
    result = await db.execute(
        select(TelegramBot).where(
            TelegramBot.id == bot_id,
            TelegramBot.organization_id == org_id,
        )
    )
    bot = result.scalar_one_or_none()
    if not bot:
        raise HTTPException(status_code=404, detail="Telegram bot not found")
    return bot


def _decrypt_token(bot: TelegramBot) -> str:
    try:
        return EncryptionService.decrypt(bot.bot_token)
    except Exception:
        return bot.bot_token


async def _resolve_workflow(
    db: AsyncSession,
    bot_id: str,
    org_id: str,
    command: Optional[str],
    callback_data: Optional[str],
):
    """Resolve the workflow + published version for this bot update."""
    workflow = None

    # If it's a command, check BotCommand → workflow mapping
    if command:
        cmd_result = await db.execute(
            select(BotCommand).where(
                BotCommand.bot_id == bot_id,
                BotCommand.organization_id == org_id,
                BotCommand.command == command,
                BotCommand.is_active == True,
            )
        )
        bot_cmd = cmd_result.scalar_one_or_none()
        if bot_cmd and bot_cmd.workflow_id:
            wf_result = await db.execute(
                select(BotWorkflow).where(BotWorkflow.id == bot_cmd.workflow_id)
            )
            workflow = wf_result.scalar_one_or_none()

    # Fallback: get the first published workflow for this bot
    if not workflow:
        wf_result = await db.execute(
            select(BotWorkflow).where(
                BotWorkflow.bot_id == bot_id,
                BotWorkflow.organization_id == org_id,
                BotWorkflow.status == "PUBLISHED",
            ).order_by(BotWorkflow.updated_at.desc())
        )
        workflow = wf_result.scalars().first()

    if not workflow or not workflow.published_version_id:
        return None, None

    ver_result = await db.execute(
        select(BotWorkflowVersion).where(
            BotWorkflowVersion.id == workflow.published_version_id,
        )
    )
    version = ver_result.scalar_one_or_none()
    return workflow, version


def _find_start_node(nodes: list, command: Optional[str] = None) -> Optional[str]:
    """Find the entry node for the workflow."""
    # Look for a trigger node matching the command
    if command:
        for node in nodes:
            ntype = node.get("type", "").lower()
            if ntype in ("command_received", "start"):
                cfg = node.get("data", {}).get("config", {})
                if cfg.get("command") == command:
                    return node.get("id")

    # Fallback: find 'start' type node
    for node in nodes:
        if node.get("type", "").lower() == "start":
            return node.get("id")

    # Last resort: first node
    return nodes[0].get("id") if nodes else None


def _find_node(nodes: list, node_id: str) -> Optional[Dict]:
    for node in nodes:
        if node.get("id") == node_id:
            return node
    return None


def _find_callback_edge(
    source_id: str, edges: list, callback_data: str,
) -> Optional[str]:
    """Find an edge whose sourceHandle matches the callback data."""
    for edge in edges:
        if edge.get("source") == source_id:
            handle = edge.get("sourceHandle", "")
            if handle == callback_data:
                return edge.get("target")

    # Fallback: first outgoing edge
    for edge in edges:
        if edge.get("source") == source_id:
            return edge.get("target")
    return None
