"""
Variable Resolver — resolves template variables like {{user.name}}, {{input.message}}.
Supports nested dot-notation access into the variable context.
"""
import re
import logging
from typing import Any, Dict, Optional

logger = logging.getLogger("bot_builder.variable_resolver")

_VAR_PATTERN = re.compile(r"\{\{([\w.]+)\}\}")


def resolve_template(template: str, context: Dict[str, Any]) -> str:
    """Replace all {{path.to.var}} placeholders in a template string."""
    def _replacer(match: re.Match) -> str:
        path = match.group(1)
        value = _resolve_path(context, path)
        if value is None:
            return match.group(0)  # Leave unresolved if not found
        return str(value)

    return _VAR_PATTERN.sub(_replacer, template)


def _resolve_path(data: Dict[str, Any], path: str) -> Optional[Any]:
    """Resolve a dot-separated path into nested dicts."""
    parts = path.split(".")
    current: Any = data
    for part in parts:
        if isinstance(current, dict):
            current = current.get(part)
        else:
            return None
        if current is None:
            return None
    return current


def build_context(
    telegram_user: Optional[Dict[str, Any]] = None,
    input_data: Optional[Dict[str, Any]] = None,
    conversation_vars: Optional[Dict[str, Any]] = None,
    business_data: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """Build a unified variable context from various data sources."""
    ctx: Dict[str, Any] = {}

    if telegram_user:
        ctx["user"] = {
            "id": telegram_user.get("id"),
            "name": _full_name(telegram_user),
            "firstName": telegram_user.get("first_name", ""),
            "lastName": telegram_user.get("last_name", ""),
            "username": telegram_user.get("username", ""),
            "languageCode": telegram_user.get("language_code", "en"),
        }

    if input_data:
        ctx["input"] = input_data

    if conversation_vars:
        ctx.update(conversation_vars)

    if business_data:
        ctx.update(business_data)

    return ctx


def _full_name(user: Dict[str, Any]) -> str:
    first = user.get("first_name", "")
    last = user.get("last_name", "")
    return f"{first} {last}".strip() or "User"
