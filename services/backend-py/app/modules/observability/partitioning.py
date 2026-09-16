# ==============================================================================
# Partition & Retention Management  (Control Center spec §31, §29 retention)
# ==============================================================================
# Provisions the monthly RANGE partitions the observability tables need, and
# implements retention by dropping whole partitions instead of deleting rows.
#
# Two properties this module exists to guarantee:
#
#   1. An insert must never fail because a partition is missing. A monitoring
#      platform that silently stops recording is worse than one that is plainly
#      down, so every table keeps a DEFAULT partition as a catch-all.
#
#   2. Provisioning must be safe to run repeatedly, concurrently, and on a
#      database that is already populated — it runs on startup of every worker.
#
# Ordering matters. Postgres refuses to create a new range partition when the
# DEFAULT partition already holds rows that would belong to it, because it has
# to revalidate the default's constraint. We therefore create the month
# partitions first and treat that specific failure as non-fatal: the rows stay
# in DEFAULT, which is slower to scan but entirely correct and still queryable.
# ==============================================================================

from __future__ import annotations

import datetime
from typing import Iterable, List, Sequence, Tuple

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncConnection, AsyncEngine

from app.core.telemetry import get_logger

from .models import PARTITIONED_TABLES

logger = get_logger("mystore.observability.partitioning")

# How many future months to keep provisioned. Two is enough that a month
# boundary crossed at 00:00 never lands in DEFAULT, even if no deploy happens.
MONTHS_AHEAD = 2

# Postgres error text emitted when a default partition holds conflicting rows.
_DEFAULT_CONFLICT_MARKERS = (
    "would be violated by some row",
    "updated partition constraint for default partition",
)


def _literal(moment: datetime.datetime) -> str:
    """Render a partition bound as an unambiguous SQL timestamp literal."""
    return moment.strftime("%Y-%m-%d %H:%M:%S")


def _month_start(moment: datetime.datetime) -> datetime.datetime:
    return datetime.datetime(moment.year, moment.month, 1)


def _next_month(moment: datetime.datetime) -> datetime.datetime:
    if moment.month == 12:
        return datetime.datetime(moment.year + 1, 1, 1)
    return datetime.datetime(moment.year, moment.month + 1, 1)


def _partition_name(table: str, month: datetime.datetime) -> str:
    return f"{table}_{month.year:04d}_{month.month:02d}"


def _default_partition_name(table: str) -> str:
    return f"{table}_default"


def month_windows(
    reference: datetime.datetime,
    months_ahead: int = MONTHS_AHEAD,
) -> List[Tuple[datetime.datetime, datetime.datetime]]:
    """Inclusive-start, exclusive-end windows for the current month and the next
    `months_ahead` months."""
    windows: List[Tuple[datetime.datetime, datetime.datetime]] = []
    cursor = _month_start(reference)
    for _ in range(months_ahead + 1):
        upper = _next_month(cursor)
        windows.append((cursor, upper))
        cursor = upper
    return windows


async def _is_partitioned(conn: AsyncConnection, table: str) -> bool:
    """True when `table` exists and is a partitioned (parent) table.

    Needed because tests and some environments create these tables as plain
    tables; issuing PARTITION OF against a plain table would error.
    """
    result = await conn.execute(
        text(
            """
            SELECT c.relkind = 'p'
            FROM pg_class c
            JOIN pg_namespace n ON n.oid = c.relnamespace
            WHERE c.relname = :table
              AND n.nspname = ANY (current_schemas(false))
            LIMIT 1
            """
        ),
        {"table": table},
    )
    row = result.first()
    return bool(row[0]) if row else False


async def ensure_partitions(
    engine: AsyncEngine,
    *,
    tables: Sequence[str] = PARTITIONED_TABLES,
    reference: datetime.datetime | None = None,
    months_ahead: int = MONTHS_AHEAD,
) -> dict[str, list[str]]:
    """Create any missing month partitions plus the DEFAULT catch-all.

    Idempotent and safe to call from every worker on startup. Returns a map of
    table -> partitions created, for logging and self-monitoring (§30).
    """
    reference = reference or datetime.datetime.utcnow()
    created: dict[str, list[str]] = {}

    async with engine.begin() as conn:
        for table in tables:
            if not await _is_partitioned(conn, table):
                # Plain table (or not yet created) — nothing to provision.
                continue

            made: list[str] = []

            for lower, upper in month_windows(reference, months_ahead):
                name = _partition_name(table, lower)
                # Partition bounds must be literals — Postgres rejects bound
                # parameters in a FOR VALUES clause. These are formatted from
                # datetime objects computed here, never from caller input, so
                # there is no untrusted text in the statement.
                statement = text(
                    f'CREATE TABLE IF NOT EXISTS "{name}" '
                    f'PARTITION OF "{table}" '
                    f"FOR VALUES FROM ('{_literal(lower)}') TO ('{_literal(upper)}')"
                )
                try:
                    # Savepoint per partition: one failure must not abort the
                    # provisioning of the others in this transaction.
                    async with conn.begin_nested():
                        await conn.execute(statement)
                    made.append(name)
                except Exception as exc:  # noqa: BLE001 - classified below
                    message = str(exc).lower()
                    if any(marker in message for marker in _DEFAULT_CONFLICT_MARKERS):
                        # Rows for this month already sit in DEFAULT. Correct,
                        # just unpartitioned; moving them is an operator task.
                        logger.warning(
                            "Partition %s not created: DEFAULT already holds rows for this range. "
                            "Telemetry is still being recorded in the default partition.",
                            name,
                        )
                    else:
                        logger.error("Failed to create partition %s: %s", name, exc)

            default_name = _default_partition_name(table)
            try:
                async with conn.begin_nested():
                    await conn.execute(
                        text(
                            f'CREATE TABLE IF NOT EXISTS "{default_name}" '
                            f'PARTITION OF "{table}" DEFAULT'
                        )
                    )
                made.append(default_name)
            except Exception as exc:  # noqa: BLE001
                logger.error("Failed to ensure DEFAULT partition for %s: %s", table, exc)

            if made:
                created[table] = made

    if created:
        logger.info("Observability partitions ensured: %s", created)
    return created


async def list_partitions(engine: AsyncEngine, table: str) -> List[str]:
    """Names of every partition currently attached to `table`."""
    async with engine.connect() as conn:
        result = await conn.execute(
            text(
                """
                SELECT c.relname
                FROM pg_inherits i
                JOIN pg_class c   ON c.oid = i.inhrelid
                JOIN pg_class p   ON p.oid = i.inhparent
                WHERE p.relname = :table
                ORDER BY c.relname
                """
            ),
            {"table": table},
        )
        return [row[0] for row in result.fetchall()]


async def apply_retention(
    engine: AsyncEngine,
    *,
    retain_months: int,
    tables: Sequence[str] = PARTITIONED_TABLES,
    reference: datetime.datetime | None = None,
    dry_run: bool = False,
) -> dict[str, list[str]]:
    """Drop partitions entirely older than the retention window.

    Dropping a partition is O(1) and reclaims the space immediately, which is
    the whole reason for partitioning: a DELETE of a month of telemetry would
    leave the table bloated and hold a long vacuum hostage.

    The DEFAULT partition is never dropped — it may hold rows from any period,
    including current ones, so removing it could destroy live telemetry.
    """
    if retain_months < 1:
        raise ValueError("retain_months must be >= 1")

    reference = reference or datetime.datetime.utcnow()
    cutoff = _month_start(reference)
    for _ in range(retain_months):
        # Walk back `retain_months` month boundaries.
        cutoff = _month_start(cutoff - datetime.timedelta(days=1))

    dropped: dict[str, list[str]] = {}

    for table in tables:
        candidates = await list_partitions(engine, table)
        default_name = _default_partition_name(table)
        to_drop: list[str] = []

        for partition in candidates:
            if partition == default_name:
                continue
            suffix = partition[len(table) + 1 :]  # "2026_09"
            try:
                year_str, month_str = suffix.split("_")
                partition_month = datetime.datetime(int(year_str), int(month_str), 1)
            except (ValueError, IndexError):
                # Not a partition this module named; leave it alone.
                continue
            if partition_month < cutoff:
                to_drop.append(partition)

        if to_drop and not dry_run:
            async with engine.begin() as conn:
                for partition in to_drop:
                    try:
                        await conn.execute(text(f'DROP TABLE IF EXISTS "{partition}"'))
                        logger.info("Dropped expired telemetry partition %s", partition)
                    except Exception as exc:  # noqa: BLE001
                        logger.error("Failed to drop partition %s: %s", partition, exc)

        if to_drop:
            dropped[table] = to_drop

    return dropped


def partition_names_for(
    table: str,
    reference: datetime.datetime | None = None,
    months_ahead: int = MONTHS_AHEAD,
) -> List[str]:
    """Partition names this module would provision. Exposed for tests and for
    the self-monitoring view, so an operator can compare intended against
    actual without reading SQL."""
    reference = reference or datetime.datetime.utcnow()
    names = [_partition_name(table, lower) for lower, _ in month_windows(reference, months_ahead)]
    names.append(_default_partition_name(table))
    return names
