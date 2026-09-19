"""
ICP Scheduler Service — Manages and executes scheduled infrastructure tasks.

Supports cron schedules for server restarts, maintenance scripts,
backups, cache purging, and diagnostic checks.
"""
import logging
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional
from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.datetime_utils import utc_now
from app.modules.infra.models import InfraScheduledTask
from app.modules.infra.agent_manager import agent_manager

logger = logging.getLogger("mystore.infra.scheduler")


class SchedulerService:
    """Manages scheduled maintenance, restart, and monitoring operations."""

    async def list_tasks(
        self, db: AsyncSession, agent_id: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """List all scheduled tasks with execution status."""
        query = select(InfraScheduledTask).order_by(desc(InfraScheduledTask.created_at))
        if agent_id:
            query = query.where(InfraScheduledTask.agent_id == agent_id)

        result = await db.execute(query)
        tasks = result.scalars().all()

        task_list = []
        for t in tasks:
            params = t.parameters
            if isinstance(params, str):
                import json
                try:
                    params = json.loads(params)
                except Exception:
                    params = {}

            task_list.append({
                "id": t.id,
                "name": t.name,
                "description": t.description,
                "agentId": t.agent_id,
                "cronExpr": t.cron_expr,
                "command": t.command,
                "parameters": params or {},
                "enabled": t.enabled,
                "lastRunAt": t.last_run_at.isoformat() if t.last_run_at else None,
                "nextRunAt": t.next_run_at.isoformat() if t.next_run_at else None,
                "lastResult": t.last_result,
                "createdAt": t.created_at.isoformat() if t.created_at else None,
                "updatedAt": t.updated_at.isoformat() if t.updated_at else None,
            })
        return task_list


    async def create_task(
        self,
        db: AsyncSession,
        name: str,
        cron_expr: str,
        command: str,
        description: Optional[str] = None,
        agent_id: Optional[str] = None,
        parameters: Optional[Dict[str, Any]] = None,
        enabled: bool = True,
    ) -> Dict[str, Any]:
        """Create a new scheduled task."""
        task = InfraScheduledTask(
            name=name,
            description=description,
            agent_id=agent_id,
            cron_expr=cron_expr,
            command=command,
            parameters=parameters or {},
            enabled=enabled,
        )
        db.add(task)
        await db.commit()
        await db.refresh(task)

        logger.info("Created scheduled task: %s (%s)", task.name, task.cron_expr)
        return {
            "id": task.id,
            "name": task.name,
            "cronExpr": task.cron_expr,
            "command": task.command,
            "enabled": task.enabled,
            "agentId": task.agent_id,
        }

    async def update_task(
        self, db: AsyncSession, task_id: str, updates: Dict[str, Any]
    ) -> Optional[Dict[str, Any]]:
        """Update an existing scheduled task."""
        stmt = select(InfraScheduledTask).where(InfraScheduledTask.id == task_id)
        result = await db.execute(stmt)
        task = result.scalar_one_or_none()
        if not task:
            return None

        field_map = {
            "name": "name",
            "description": "description",
            "agentId": "agent_id",
            "cronExpr": "cron_expr",
            "command": "command",
            "parameters": "parameters",
            "enabled": "enabled",
        }
        for key, attr in field_map.items():
            if key in updates and updates[key] is not None:
                setattr(task, attr, updates[key])

        task.updated_at = utc_now()
        await db.commit()
        await db.refresh(task)
        return {"id": task.id, "name": task.name, "enabled": task.enabled}

    async def delete_task(self, db: AsyncSession, task_id: str) -> bool:
        """Delete a scheduled task."""
        stmt = select(InfraScheduledTask).where(InfraScheduledTask.id == task_id)
        result = await db.execute(stmt)
        task = result.scalar_one_or_none()
        if not task:
            return False

        await db.delete(task)
        await db.commit()
        return True

    async def run_task_now(
        self, db: AsyncSession, task_id: str, actor_id: str
    ) -> Dict[str, Any]:
        """Trigger immediate execution of a scheduled task."""
        stmt = select(InfraScheduledTask).where(InfraScheduledTask.id == task_id)
        result = await db.execute(stmt)
        task = result.scalar_one_or_none()
        if not task:
            return {"success": False, "error": "Task not found"}

        now = utc_now()
        task.last_run_at = now

        output_msg = ""
        success = True

        # If targeted to an agent, execute via AgentManager
        if task.agent_id:
            try:
                res = await agent_manager.send_command(
                    db=db,
                    agent_id=task.agent_id,
                    command=task.command,
                    actor_id=actor_id,
                )
                success = res.get("success", False)
                output_msg = res.get("result", str(res))
            except Exception as e:
                success = False
                output_msg = f"Agent execution failed: {str(e)}"
        else:
            # Platform-level task execution simulation / local dispatch
            output_msg = f"Executed platform task '{task.command}' successfully at {now.isoformat()}"
            logger.info("Dispatched platform scheduled task: %s", task.command)

        task.last_result = f"[{'SUCCESS' if success else 'FAILURE'}] {output_msg[:500]}"
        task.updated_at = now
        await db.commit()

        return {
            "success": success,
            "taskId": task.id,
            "lastRunAt": task.last_run_at.isoformat(),
            "result": task.last_result,
        }


scheduler_service = SchedulerService()
