"""
Telegram Adapter — wraps all Telegram Bot API calls.
Centralizes HTTP calls to api.telegram.org so the rest of the engine
never imports httpx directly.
"""
import logging
from typing import Any, Dict, List, Optional

import httpx

logger = logging.getLogger("bot_builder.telegram_adapter")

TELEGRAM_API = "https://api.telegram.org"
_TIMEOUT = 10.0


class TelegramAdapter:
    """Stateless adapter for Telegram Bot API calls."""

    def __init__(self, bot_token: str):
        self._token = bot_token
        self._base = f"{TELEGRAM_API}/bot{bot_token}"

    # ─── Core Messaging ─────────────────────────────────────────────

    async def send_message(
        self,
        chat_id: str,
        text: str,
        parse_mode: Optional[str] = "HTML",
        reply_markup: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        payload: Dict[str, Any] = {
            "chat_id": chat_id,
            "text": text,
        }
        if parse_mode:
            payload["parse_mode"] = parse_mode
        if reply_markup:
            payload["reply_markup"] = reply_markup
        return await self._post("sendMessage", payload)

    async def edit_message_text(
        self,
        chat_id: str,
        message_id: int,
        text: str,
        parse_mode: Optional[str] = "HTML",
        reply_markup: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        payload: Dict[str, Any] = {
            "chat_id": chat_id,
            "message_id": message_id,
            "text": text,
        }
        if parse_mode:
            payload["parse_mode"] = parse_mode
        if reply_markup:
            payload["reply_markup"] = reply_markup
        return await self._post("editMessageText", payload)

    async def delete_message(self, chat_id: str, message_id: int) -> Dict[str, Any]:
        return await self._post("deleteMessage", {"chat_id": chat_id, "message_id": message_id})

    async def answer_callback_query(
        self,
        callback_query_id: str,
        text: Optional[str] = None,
        show_alert: bool = False,
    ) -> Dict[str, Any]:
        payload: Dict[str, Any] = {"callback_query_id": callback_query_id}
        if text:
            payload["text"] = text
        payload["show_alert"] = show_alert
        return await self._post("answerCallbackQuery", payload)

    # ─── Keyboards ──────────────────────────────────────────────────

    @staticmethod
    def build_inline_keyboard(buttons: List[List[Dict[str, Any]]]) -> Dict[str, Any]:
        """Build an InlineKeyboardMarkup from a 2D list of button dicts.
        Each button dict: { text, callback_data?, url?, web_app? }"""
        rows = []
        for row in buttons:
            keyboard_row = []
            for btn in row:
                button: Dict[str, Any] = {"text": btn.get("text", "Button")}
                if btn.get("callback_data"):
                    button["callback_data"] = btn["callback_data"]
                elif btn.get("url"):
                    button["url"] = btn["url"]
                elif btn.get("web_app"):
                    button["web_app"] = {"url": btn["web_app"]}
                else:
                    button["callback_data"] = btn.get("text", "noop")
                keyboard_row.append(button)
            rows.append(keyboard_row)
        return {"inline_keyboard": rows}

    @staticmethod
    def build_reply_keyboard(
        buttons: List[List[str]],
        resize: bool = True,
        one_time: bool = False,
    ) -> Dict[str, Any]:
        return {
            "keyboard": [[{"text": b} for b in row] for row in buttons],
            "resize_keyboard": resize,
            "one_time_keyboard": one_time,
        }

    @staticmethod
    def remove_keyboard() -> Dict[str, Any]:
        return {"remove_keyboard": True}

    # ─── Media ──────────────────────────────────────────────────────

    async def send_photo(
        self, chat_id: str, photo: str, caption: Optional[str] = None,
        reply_markup: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        payload: Dict[str, Any] = {"chat_id": chat_id, "photo": photo}
        if caption:
            payload["caption"] = caption
        if reply_markup:
            payload["reply_markup"] = reply_markup
        return await self._post("sendPhoto", payload)

    async def send_document(
        self, chat_id: str, document: str, caption: Optional[str] = None,
    ) -> Dict[str, Any]:
        payload: Dict[str, Any] = {"chat_id": chat_id, "document": document}
        if caption:
            payload["caption"] = caption
        return await self._post("sendDocument", payload)

    async def send_location(
        self, chat_id: str, latitude: float, longitude: float,
    ) -> Dict[str, Any]:
        return await self._post("sendLocation", {
            "chat_id": chat_id,
            "latitude": latitude,
            "longitude": longitude,
        })

    # ─── Bot Configuration ──────────────────────────────────────────

    async def set_my_commands(
        self, commands: List[Dict[str, str]], scope: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        payload: Dict[str, Any] = {
            "commands": [{"command": c["command"], "description": c.get("description", "")} for c in commands],
        }
        if scope:
            payload["scope"] = scope
        return await self._post("setMyCommands", payload)

    async def set_webhook(
        self, url: str, secret_token: Optional[str] = None,
    ) -> Dict[str, Any]:
        payload: Dict[str, Any] = {"url": url}
        if secret_token:
            payload["secret_token"] = secret_token
        return await self._post("setWebhook", payload)

    async def get_webhook_info(self) -> Dict[str, Any]:
        return await self._post("getWebhookInfo", {})

    async def delete_webhook(self) -> Dict[str, Any]:
        return await self._post("deleteWebhook", {})

    async def get_me(self) -> Dict[str, Any]:
        return await self._post("getMe", {})

    async def set_chat_menu_button(
        self, chat_id: Optional[str] = None,
        menu_button: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        payload: Dict[str, Any] = {}
        if chat_id:
            payload["chat_id"] = chat_id
        if menu_button:
            payload["menu_button"] = menu_button
        return await self._post("setChatMenuButton", payload)

    # ─── Internal ───────────────────────────────────────────────────

    async def _post(self, method: str, payload: Dict[str, Any]) -> Dict[str, Any]:
        url = f"{self._base}/{method}"
        try:
            async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
                resp = await client.post(url, json=payload)
                data = resp.json()
                if not data.get("ok"):
                    logger.warning("Telegram API error: %s %s → %s", method, payload.get("chat_id", ""), data)
                return data
        except Exception as exc:
            logger.error("Telegram API call failed: %s — %s", method, str(exc))
            return {"ok": False, "error": str(exc)}
