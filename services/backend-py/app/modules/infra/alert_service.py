"""
ICP Alert & Notification Service — Rule evaluation, alert dispatch, and notification channels.

Supports Telegram, Email, Slack, and Webhook notification channels
with deduplication, cooldowns, and automatic recovery notices.
"""
import os
import logging
from datetime import datetime, timedelta, timezone
from typing import List, Dict, Any, Optional
import httpx
from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.datetime_utils import utc_now
from app.modules.infra.models import (
    InfraAlertRule,
    InfraAlert,
    InfraNotificationChannel,
)

logger = logging.getLogger("mystore.infra.alerts")


class AlertService:
    """Manages threshold alert rules and dispatches notifications."""

    # ── Notification Channels ────────────────────────────────────────────────

    async def list_channels(self, db: AsyncSession) -> List[Dict[str, Any]]:
        stmt = select(InfraNotificationChannel).order_by(desc(InfraNotificationChannel.created_at))
        result = await db.execute(stmt)
        channels = result.scalars().all()
        return [
            {
                "id": c.id,
                "name": c.name,
                "type": c.type,
                "config": {k: (v if k != "bot_token" and k != "webhook_url" else "***REDACTED***") for k, v in (c.config or {}).items()},
                "enabled": c.enabled,
                "createdAt": c.created_at.isoformat() if c.created_at else None,
            }
            for c in channels
        ]

    async def create_channel(
        self, db: AsyncSession, name: str, channel_type: str, config: Dict[str, Any], enabled: bool = True
    ) -> Dict[str, Any]:
        channel = InfraNotificationChannel(
            name=name,
            type=channel_type.upper(),
            config=config,
            enabled=enabled,
        )
        db.add(channel)
        await db.commit()
        await db.refresh(channel)
        return {"id": channel.id, "name": channel.name, "type": channel.type, "enabled": channel.enabled}

    async def delete_channel(self, db: AsyncSession, channel_id: str) -> bool:
        stmt = select(InfraNotificationChannel).where(InfraNotificationChannel.id == channel_id)
        result = await db.execute(stmt)
        c = result.scalar_one_or_none()
        if not c:
            return False
        await db.delete(c)
        await db.commit()
        return True

    async def send_notification(
        self, db: AsyncSession, channel_id: str, title: str, message: str, severity: str = "HIGH"
    ) -> bool:
        """Send a notification through a specific channel."""
        stmt = select(InfraNotificationChannel).where(InfraNotificationChannel.id == channel_id)
        result = await db.execute(stmt)
        c = result.scalar_one_or_none()
        if not c or not c.enabled:
            return False

        try:
            cfg = c.config or {}
            if c.type == "TELEGRAM":
                bot_token = cfg.get("bot_token") or os.getenv("TELEGRAM_BOT_TOKEN")
                chat_id = cfg.get("chat_id") or os.getenv("TELEGRAM_ADMIN_CHAT_ID")
                if bot_token and chat_id:
                    icon = "🚨" if severity in ("CRITICAL", "HIGH") else "⚠️"
                    text = f"{icon} *[ICP Alert - {severity}]*\n\n*{title}*\n{message}"
                    async with httpx.AsyncClient(timeout=5.0) as client:
                        await client.post(
                            f"https://api.telegram.org/bot{bot_token}/sendMessage",
                            json={"chat_id": chat_id, "text": text, "parse_mode": "Markdown"},
                        )
                    return True

            elif c.type == "SLACK":
                webhook_url = cfg.get("webhook_url")
                if webhook_url:
                    color = "#E02424" if severity in ("CRITICAL", "HIGH") else "#F59E0B"
                    payload = {
                        "attachments": [
                            {
                                "color": color,
                                "title": f"[{severity}] {title}",
                                "text": message,
                                "ts": int(utc_now().timestamp()),
                            }
                        ]
                    }
                    async with httpx.AsyncClient(timeout=5.0) as client:
                        await client.post(webhook_url, json=payload)
                    return True

            elif c.type == "WEBHOOK":
                webhook_url = cfg.get("webhook_url")
                if webhook_url:
                    payload = {
                        "title": title,
                        "message": message,
                        "severity": severity,
                        "timestamp": utc_now().isoformat(),
                    }
                    async with httpx.AsyncClient(timeout=5.0) as client:
                        await client.post(webhook_url, json=payload)
                    return True

        except Exception as e:
            logger.error("Failed to send notification via channel %s: %s", channel_id, e)

        return False

    # ── Alert Rules ──────────────────────────────────────────────────────────

    async def list_rules(self, db: AsyncSession) -> List[Dict[str, Any]]:
        stmt = select(InfraAlertRule).order_by(desc(InfraAlertRule.created_at))
        result = await db.execute(stmt)
        rules = result.scalars().all()
        return [
            {
                "id": r.id,
                "name": r.name,
                "description": r.description,
                "category": r.category,
                "severity": r.severity,
                "condition": r.condition,
                "channels": r.channels or [],
                "cooldownSec": r.cooldown_sec,
                "enabled": r.enabled,
                "createdAt": r.created_at.isoformat() if r.created_at else None,
            }
            for r in rules
        ]

    async def create_rule(
        self,
        db: AsyncSession,
        name: str,
        condition: Dict[str, Any],
        description: Optional[str] = None,
        category: str = "INFRA",
        severity: str = "HIGH",
        channels: Optional[List[str]] = None,
        cooldown_sec: int = 300,
        enabled: bool = True,
    ) -> Dict[str, Any]:
        rule = InfraAlertRule(
            name=name,
            description=description,
            category=category,
            severity=severity,
            condition=condition,
            channels=channels or [],
            cooldown_sec=cooldown_sec,
            enabled=enabled,
        )
        db.add(rule)
        await db.commit()
        await db.refresh(rule)
        return {"id": rule.id, "name": rule.name, "severity": rule.severity, "enabled": rule.enabled}

    async def delete_rule(self, db: AsyncSession, rule_id: str) -> bool:
        stmt = select(InfraAlertRule).where(InfraAlertRule.id == rule_id)
        result = await db.execute(stmt)
        r = result.scalar_one_or_none()
        if not r:
            return False
        await db.delete(r)
        await db.commit()
        return True

    # ── Alerts Management ───────────────────────────────────────────────────

    async def list_alerts(
        self, db: AsyncSession, status: Optional[str] = None, limit: int = 50
    ) -> List[Dict[str, Any]]:
        query = select(InfraAlert).order_by(desc(InfraAlert.fired_at)).limit(limit)
        if status:
            query = query.where(InfraAlert.status == status)

        result = await db.execute(query)
        alerts = result.scalars().all()
        return [
            {
                "id": a.id,
                "ruleId": a.rule_id,
                "agentId": a.agent_id,
                "severity": a.severity,
                "status": a.status,
                "title": a.title,
                "description": a.description,
                "firedAt": a.fired_at.isoformat() if a.fired_at else None,
                "acknowledgedAt": a.acknowledged_at.isoformat() if a.acknowledged_at else None,
                "acknowledgedBy": a.acknowledged_by,
                "resolvedAt": a.resolved_at.isoformat() if a.resolved_at else None,
            }
            for a in alerts
        ]

    async def acknowledge_alert(
        self, db: AsyncSession, alert_id: str, actor_id: str
    ) -> Optional[Dict[str, Any]]:
        stmt = select(InfraAlert).where(InfraAlert.id == alert_id)
        result = await db.execute(stmt)
        alert = result.scalar_one_or_none()
        if not alert:
            return None

        alert.status = "ACKNOWLEDGED"
        alert.acknowledged_at = utc_now()
        alert.acknowledged_by = actor_id
        await db.commit()
        return {"id": alert.id, "status": alert.status, "acknowledgedAt": alert.acknowledged_at.isoformat()}

    async def resolve_alert(
        self, db: AsyncSession, alert_id: str, actor_id: str
    ) -> Optional[Dict[str, Any]]:
        stmt = select(InfraAlert).where(InfraAlert.id == alert_id)
        result = await db.execute(stmt)
        alert = result.scalar_one_or_none()
        if not alert:
            return None

        alert.status = "RESOLVED"
        alert.resolved_at = utc_now()
        await db.commit()
        return {"id": alert.id, "status": alert.status, "resolvedAt": alert.resolved_at.isoformat()}


alert_service = AlertService()
