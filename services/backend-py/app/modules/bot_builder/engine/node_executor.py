"""
Node Executor — the universal workflow execution engine.
Given a published workflow (nodes + edges), processes Telegram updates
by walking the graph from the current state node, executing each node
handler, and following edges to the next node.
"""
import logging
import time
from typing import Any, Dict, List, Optional, Tuple

from .telegram_adapter import TelegramAdapter
from .variable_resolver import resolve_template, build_context

logger = logging.getLogger("bot_builder.node_executor")


# ─── Node Type Registry ─────────────────────────────────────────────────────

TRIGGER_TYPES = {"start", "command_received", "message_received", "callback_query", "webhook_received"}

TELEGRAM_NODE_TYPES = {
    "send_message", "edit_message", "delete_message",
    "show_inline_keyboard", "show_reply_keyboard", "remove_keyboard",
    "answer_callback", "send_photo", "send_document", "send_location",
}

INPUT_NODE_TYPES = {"wait_input", "wait_choice"}

LOGIC_NODE_TYPES = {"condition", "switch"}

DATA_NODE_TYPES = {"set_variable", "api_call"}


class NodeExecutionResult:
    """Result of executing a single node."""

    def __init__(
        self,
        success: bool,
        next_node_id: Optional[str] = None,
        output_data: Optional[Dict[str, Any]] = None,
        error: Optional[str] = None,
        wait_for_input: bool = False,
        input_node_id: Optional[str] = None,
        updated_variables: Optional[Dict[str, Any]] = None,
    ):
        self.success = success
        self.next_node_id = next_node_id
        self.output_data = output_data or {}
        self.error = error
        self.wait_for_input = wait_for_input
        self.input_node_id = input_node_id
        self.updated_variables = updated_variables or {}


class NodeExecutor:
    """Executes a single workflow node and returns the result."""

    def __init__(self, adapter: TelegramAdapter):
        self._adapter = adapter

    async def execute_node(
        self,
        node: Dict[str, Any],
        edges: List[Dict[str, Any]],
        context: Dict[str, Any],
        chat_id: str,
        callback_query_id: Optional[str] = None,
    ) -> NodeExecutionResult:
        """Execute a single node, return the result with the next node to traverse."""
        node_type = node.get("type", "").lower()
        node_id = node.get("id", "")
        params = node.get("data", {}).get("config", {}) or node.get("data", {})

        try:
            if node_type in ("start", "command_received", "message_received",
                             "callback_query", "webhook_received"):
                return self._resolve_next(node_id, edges)

            elif node_type == "send_message":
                return await self._handle_send_message(node_id, params, edges, context, chat_id)

            elif node_type == "show_inline_keyboard":
                return await self._handle_inline_keyboard(node_id, params, edges, context, chat_id)

            elif node_type == "show_reply_keyboard":
                return await self._handle_reply_keyboard(node_id, params, edges, context, chat_id)

            elif node_type == "remove_keyboard":
                return await self._handle_remove_keyboard(node_id, params, edges, context, chat_id)

            elif node_type == "answer_callback":
                return await self._handle_answer_callback(node_id, params, edges, context, callback_query_id)

            elif node_type == "wait_input":
                return NodeExecutionResult(
                    success=True,
                    wait_for_input=True,
                    input_node_id=node_id,
                )

            elif node_type == "wait_choice":
                # Wait for a callback_query from an inline keyboard
                return NodeExecutionResult(
                    success=True,
                    wait_for_input=True,
                    input_node_id=node_id,
                )

            elif node_type == "condition":
                return self._handle_condition(node_id, params, edges, context)

            elif node_type == "switch":
                return self._handle_switch(node_id, params, edges, context)

            elif node_type == "set_variable":
                return self._handle_set_variable(node_id, params, edges, context)

            elif node_type == "api_call":
                return await self._handle_api_call(node_id, params, edges, context)

            elif node_type == "send_photo":
                return await self._handle_send_photo(node_id, params, edges, context, chat_id)

            elif node_type == "send_location":
                return await self._handle_send_location(node_id, params, edges, context, chat_id)

            elif node_type == "delay":
                # For now, delays are a no-op pass-through (real async delay requires queue)
                return self._resolve_next(node_id, edges)

            else:
                logger.warning("Unknown node type: %s (node %s)", node_type, node_id)
                return self._resolve_next(node_id, edges)

        except Exception as exc:
            logger.error("Node execution error: node=%s type=%s error=%s", node_id, node_type, str(exc))
            return NodeExecutionResult(success=False, error=str(exc))

    # ─── Message Handlers ───────────────────────────────────────────

    async def _handle_send_message(
        self, node_id: str, params: Dict, edges: List, context: Dict, chat_id: str,
    ) -> NodeExecutionResult:
        text = resolve_template(params.get("message", params.get("text", "")), context)
        if not text:
            text = "..."
        result = await self._adapter.send_message(chat_id, text)
        return NodeExecutionResult(
            success=result.get("ok", False),
            next_node_id=self._find_next(node_id, edges),
            output_data={"message_id": result.get("result", {}).get("message_id")},
            error=result.get("description") if not result.get("ok") else None,
        )

    async def _handle_inline_keyboard(
        self, node_id: str, params: Dict, edges: List, context: Dict, chat_id: str,
    ) -> NodeExecutionResult:
        text = resolve_template(params.get("message", params.get("text", "Choose:")), context)
        buttons = params.get("buttons", [])
        # Build keyboard rows
        keyboard_rows = []
        current_row: List[Dict[str, Any]] = []
        for btn in buttons:
            btn_text = resolve_template(btn.get("text", "Button"), context)
            btn_data = {
                "text": btn_text,
                "callback_data": btn.get("callbackData", btn.get("callback_data", btn_text)),
            }
            if btn.get("url"):
                btn_data["url"] = btn["url"]
                del btn_data["callback_data"]
            current_row.append(btn_data)
            columns = params.get("columns", 1)
            if len(current_row) >= columns:
                keyboard_rows.append(current_row)
                current_row = []
        if current_row:
            keyboard_rows.append(current_row)

        markup = TelegramAdapter.build_inline_keyboard(keyboard_rows)
        result = await self._adapter.send_message(chat_id, text, reply_markup=markup)

        # After showing inline keyboard, we typically wait for a callback
        return NodeExecutionResult(
            success=result.get("ok", False),
            wait_for_input=True,
            input_node_id=node_id,
            output_data={"message_id": result.get("result", {}).get("message_id")},
        )

    async def _handle_reply_keyboard(
        self, node_id: str, params: Dict, edges: List, context: Dict, chat_id: str,
    ) -> NodeExecutionResult:
        text = resolve_template(params.get("message", "Choose:"), context)
        buttons = params.get("buttons", [])
        rows = []
        current_row: List[str] = []
        cols = params.get("columns", 2)
        for btn in buttons:
            btn_text = resolve_template(btn if isinstance(btn, str) else btn.get("text", ""), context)
            current_row.append(btn_text)
            if len(current_row) >= cols:
                rows.append(current_row)
                current_row = []
        if current_row:
            rows.append(current_row)

        markup = TelegramAdapter.build_reply_keyboard(rows, one_time=params.get("oneTime", True))
        result = await self._adapter.send_message(chat_id, text, reply_markup=markup)
        return NodeExecutionResult(
            success=result.get("ok", False),
            wait_for_input=True,
            input_node_id=node_id,
        )

    async def _handle_remove_keyboard(
        self, node_id: str, params: Dict, edges: List, context: Dict, chat_id: str,
    ) -> NodeExecutionResult:
        text = resolve_template(params.get("message", "✓"), context)
        markup = TelegramAdapter.remove_keyboard()
        result = await self._adapter.send_message(chat_id, text, reply_markup=markup)
        return NodeExecutionResult(
            success=result.get("ok", False),
            next_node_id=self._find_next(node_id, edges),
        )

    async def _handle_answer_callback(
        self, node_id: str, params: Dict, edges: List, context: Dict,
        callback_query_id: Optional[str],
    ) -> NodeExecutionResult:
        if callback_query_id:
            text = resolve_template(params.get("text", ""), context) or None
            await self._adapter.answer_callback_query(
                callback_query_id, text, params.get("showAlert", False),
            )
        return self._resolve_next(node_id, edges)

    async def _handle_send_photo(
        self, node_id: str, params: Dict, edges: List, context: Dict, chat_id: str,
    ) -> NodeExecutionResult:
        photo = resolve_template(params.get("photoUrl", params.get("photo", "")), context)
        caption = resolve_template(params.get("caption", ""), context) or None
        result = await self._adapter.send_photo(chat_id, photo, caption)
        return NodeExecutionResult(
            success=result.get("ok", False),
            next_node_id=self._find_next(node_id, edges),
        )

    async def _handle_send_location(
        self, node_id: str, params: Dict, edges: List, context: Dict, chat_id: str,
    ) -> NodeExecutionResult:
        lat = params.get("latitude", 0)
        lon = params.get("longitude", 0)
        result = await self._adapter.send_location(chat_id, lat, lon)
        return NodeExecutionResult(
            success=result.get("ok", False),
            next_node_id=self._find_next(node_id, edges),
        )

    # ─── Logic Handlers ─────────────────────────────────────────────

    def _handle_condition(
        self, node_id: str, params: Dict, edges: List, context: Dict,
    ) -> NodeExecutionResult:
        """Evaluate an IF condition and follow the true or false edge."""
        variable_path = params.get("variable", "")
        operator = params.get("operator", "equals")
        compare_value = params.get("value", "")

        from .variable_resolver import _resolve_path
        actual = _resolve_path(context, variable_path)
        actual_str = str(actual) if actual is not None else ""
        compare_str = str(compare_value)

        result = False
        if operator == "equals":
            result = actual_str.lower() == compare_str.lower()
        elif operator == "not_equals":
            result = actual_str.lower() != compare_str.lower()
        elif operator == "contains":
            result = compare_str.lower() in actual_str.lower()
        elif operator == "starts_with":
            result = actual_str.lower().startswith(compare_str.lower())
        elif operator == "greater_than":
            try:
                result = float(actual_str) > float(compare_str)
            except ValueError:
                result = False
        elif operator == "less_than":
            try:
                result = float(actual_str) < float(compare_str)
            except ValueError:
                result = False
        elif operator == "is_empty":
            result = not actual_str
        elif operator == "is_not_empty":
            result = bool(actual_str)
        elif operator == "exists":
            result = actual is not None

        handle = "true" if result else "false"
        next_id = self._find_next(node_id, edges, handle)
        return NodeExecutionResult(
            success=True,
            next_node_id=next_id,
            output_data={"condition_result": result, "handle": handle},
        )

    def _handle_switch(
        self, node_id: str, params: Dict, edges: List, context: Dict,
    ) -> NodeExecutionResult:
        """Multi-branch switch: matches variable against cases."""
        variable_path = params.get("variable", "")
        from .variable_resolver import _resolve_path
        actual = str(_resolve_path(context, variable_path) or "")

        cases = params.get("cases", [])
        for case in cases:
            if str(case.get("value", "")).lower() == actual.lower():
                next_id = self._find_next(node_id, edges, case.get("handle", "default"))
                return NodeExecutionResult(success=True, next_node_id=next_id)

        # Default branch
        next_id = self._find_next(node_id, edges, "default")
        return NodeExecutionResult(success=True, next_node_id=next_id)

    def _handle_set_variable(
        self, node_id: str, params: Dict, edges: List, context: Dict,
    ) -> NodeExecutionResult:
        var_name = params.get("variableName", params.get("name", ""))
        var_value = params.get("value", "")
        resolved = resolve_template(str(var_value), context)
        return NodeExecutionResult(
            success=True,
            next_node_id=self._find_next(node_id, edges),
            updated_variables={var_name: resolved} if var_name else {},
        )

    async def _handle_api_call(
        self, node_id: str, params: Dict, edges: List, context: Dict,
    ) -> NodeExecutionResult:
        import httpx

        url = resolve_template(params.get("url", ""), context)
        method = params.get("method", "GET").upper()
        headers = params.get("headers", {})
        body = params.get("body")

        if body and isinstance(body, str):
            body = resolve_template(body, context)

        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                resp = await client.request(method, url, headers=headers, content=body)
                response_data = resp.json() if resp.headers.get("content-type", "").startswith("application/json") else {"text": resp.text}

            output_var = params.get("outputVariable", "apiResponse")
            return NodeExecutionResult(
                success=True,
                next_node_id=self._find_next(node_id, edges, "true" if resp.is_success else "false"),
                output_data=response_data,
                updated_variables={output_var: response_data},
            )
        except Exception as exc:
            return NodeExecutionResult(
                success=False,
                next_node_id=self._find_next(node_id, edges, "false"),
                error=str(exc),
            )

    # ─── Edge Resolution ────────────────────────────────────────────

    def _resolve_next(self, node_id: str, edges: List[Dict]) -> NodeExecutionResult:
        """Simple pass-through: find the default outgoing edge."""
        return NodeExecutionResult(
            success=True,
            next_node_id=self._find_next(node_id, edges),
        )

    @staticmethod
    def _find_next(
        source_id: str,
        edges: List[Dict[str, Any]],
        handle: Optional[str] = None,
    ) -> Optional[str]:
        """Find the target node ID from the edges list.
        If handle is specified, match the sourceHandle; otherwise take default."""
        for edge in edges:
            if edge.get("source") == source_id:
                edge_handle = edge.get("sourceHandle")
                if handle:
                    if edge_handle == handle:
                        return edge.get("target")
                else:
                    if not edge_handle or edge_handle == "default":
                        return edge.get("target")

        # Fallback: if no handle-specific match, take the first outgoing edge
        if handle:
            for edge in edges:
                if edge.get("source") == source_id:
                    return edge.get("target")

        return None
