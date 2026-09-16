"""Tests for the security detection engine and the real-time event bus.

The priority here is the failure that would actually hurt: a **false positive**.
An operator who learns the Threat Center cries wolf stops reading it, and then a
real detection goes unread. So normal traffic being left alone is tested as
carefully as attacks being caught.

Second priority is the §17 separation — observed fact, detection inference, and
suggested action must stay distinguishable in the stored payload, because that
is what lets an analyst audit a detection instead of trusting it.
"""

from __future__ import annotations

import asyncio
import datetime
import uuid

import pytest
from sqlalchemy import text

from app.core.database import Base, engine
from app.modules.observability.detection import (
    DetectionEngine,
    Finding,
    Signal,
)
from app.modules.observability.eventbus import EventBus, envelope
from app.modules.observability.records import ApiRequestRecord
from app.modules.observability.repository import PostgresTelemetryRepository


@pytest.fixture(autouse=True)
async def _schema():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all, checkfirst=True)


def _ip() -> str:
    """A unique source per test, so tests never collide through the cooldown."""
    octets = uuid.uuid4().int
    return f"198.51.{octets % 254}.{(octets >> 8) % 254}"


def _req(
    *,
    ip: str,
    route: str,
    status: int,
    seconds_ago: int,
    service: str = "auth-service",
    actor_id: str | None = None,
    rate_limited: bool = False,
) -> ApiRequestRecord:
    return ApiRequestRecord(
        occurred_at=datetime.datetime.utcnow() - datetime.timedelta(seconds=seconds_ago),
        request_id=uuid.uuid4().hex[:12],
        trace_id=uuid.uuid4().hex[:16],
        service=service,
        method="POST",
        route=route,
        path=route,
        status_code=status,
        duration_ms=90.0,
        client_ip=ip,
        actor_id=actor_id,
        rate_limited=rate_limited,
    )


async def _seed(records):
    await PostgresTelemetryRepository(engine).write_api_requests(records)


async def _clear_events():
    async with engine.begin() as conn:
        await conn.execute(text("DELETE FROM infra_security_events"))


# ─── Attacks that must be caught ─────────────────────────────────────────────


async def test_brute_force_is_detected_with_explained_signals():
    ip = _ip()
    await _seed(
        [_req(ip=ip, route="/api/v1/auth/login", status=401, seconds_ago=i * 2) for i in range(60)]
    )

    findings = await DetectionEngine(engine).detect_auth_brute_force(
        datetime.datetime.utcnow() - datetime.timedelta(minutes=10),
        datetime.datetime.utcnow(),
    )
    mine = [f for f in findings if f.source_ip == ip]
    assert len(mine) == 1

    finding = mine[0]
    assert finding.rule_id == "AUTH-001"
    assert finding.severity in ("HIGH", "CRITICAL")
    assert finding.observed["failedAuthentications"] == 60
    assert finding.observed["successfulAuthentications"] == 0

    names = {s.name for s in finding.signals}
    assert "repeated_failed_authentication" in names
    # Zero successes is what separates guessing from a user mistyping.
    assert "no_successful_authentication" in names
    # Every signal must carry its reasoning, not just a number.
    assert all(s.explanation for s in finding.signals)


async def test_password_spraying_across_sources_is_detected_as_distributed():
    """The pattern per-source rate limits cannot see."""
    route = f"/api/v1/auth/login-{uuid.uuid4().hex[:6]}"
    records = []
    for source in range(14):
        for attempt in range(6):
            records.append(
                _req(ip=f"203.0.113.{source + 10}", route=route, status=401, seconds_ago=attempt + 5)
            )
    await _seed(records)

    findings = await DetectionEngine(engine).detect_distributed_auth_abuse(
        datetime.datetime.utcnow() - datetime.timedelta(minutes=10),
        datetime.datetime.utcnow(),
    )
    mine = [f for f in findings if f.observed.get("route") == route]
    assert len(mine) == 1
    assert mine[0].rule_id == "DIST-001"
    assert mine[0].severity == "CRITICAL"
    assert mine[0].observed["distinctSources"] >= 14
    # No single address characterises a distributed attempt.
    assert mine[0].source_ip == "(distributed)"


async def test_endpoint_enumeration_is_detected():
    ip = _ip()
    await _seed(
        [
            _req(ip=ip, route=f"/api/v1/probe-{i}-{uuid.uuid4().hex[:4]}", status=404, seconds_ago=i)
            for i in range(25)
        ]
    )

    findings = await DetectionEngine(engine).detect_endpoint_enumeration(
        datetime.datetime.utcnow() - datetime.timedelta(minutes=10),
        datetime.datetime.utcnow(),
    )
    mine = [f for f in findings if f.source_ip == ip]
    assert len(mine) == 1
    assert mine[0].rule_id == "ENUM-001"
    assert mine[0].observed["distinctMissingRoutes"] >= 25


async def test_rate_limit_abuse_is_detected():
    ip = _ip()
    await _seed(
        [
            _req(ip=ip, route="/api/v1/products", status=429, seconds_ago=i, rate_limited=True)
            for i in range(30)
        ]
    )

    findings = await DetectionEngine(engine).detect_rate_limit_abuse(
        datetime.datetime.utcnow() - datetime.timedelta(minutes=10),
        datetime.datetime.utcnow(),
    )
    mine = [f for f in findings if f.source_ip == ip]
    assert len(mine) == 1
    assert mine[0].rule_id == "RATE-001"
    # This records defence working, and the description must say so.
    assert "defence working" in mine[0].description or "absorbed" in mine[0].description


async def test_one_account_from_many_addresses_is_flagged_cautiously():
    actor = f"user-{uuid.uuid4().hex[:8]}"
    await _seed(
        [
            _req(
                ip=f"192.0.2.{i + 10}",
                route="/api/v1/products",
                status=200,
                seconds_ago=i,
                service="sales-service",
                actor_id=actor,
            )
            for i in range(8)
        ]
    )

    findings = await DetectionEngine(engine).detect_session_anomaly(
        datetime.datetime.utcnow() - datetime.timedelta(minutes=10),
        datetime.datetime.utcnow(),
    )
    mine = [f for f in findings if f.observed.get("authenticatedActorId") == actor]
    assert len(mine) == 1
    # Roaming and shared NAT produce this legitimately, so it must not be
    # escalated and the description must say why it may be benign.
    assert mine[0].severity == "MEDIUM"
    assert "roaming" in mine[0].description.lower()
    assert any("confirm" in a.lower() for a in mine[0].suggested_actions)


# ─── The false-positive guard ────────────────────────────────────────────────


async def test_ordinary_successful_traffic_is_not_flagged():
    """Volume alone is not suspicious. A busy legitimate client must stay quiet."""
    ip = _ip()
    await _seed(
        [
            _req(
                ip=ip,
                route="/api/v1/products",
                status=200,
                seconds_ago=i % 300,
                service="sales-service",
                actor_id="legit-user",
            )
            for i in range(150)
        ]
    )

    findings = await DetectionEngine(engine).evaluate(persist=False)
    assert [f for f in findings if f.source_ip == ip] == []


async def test_a_few_failed_logins_are_not_flagged():
    """A person mistyping a password three times is not an attack."""
    ip = _ip()
    await _seed(
        [_req(ip=ip, route="/api/v1/auth/login", status=401, seconds_ago=i * 20) for i in range(3)]
        + [_req(ip=ip, route="/api/v1/auth/login", status=200, seconds_ago=1)]
    )

    findings = await DetectionEngine(engine).detect_auth_brute_force(
        datetime.datetime.utcnow() - datetime.timedelta(minutes=10),
        datetime.datetime.utcnow(),
    )
    assert [f for f in findings if f.source_ip == ip] == []


async def test_a_handful_of_404s_is_not_enumeration():
    ip = _ip()
    await _seed([_req(ip=ip, route=f"/api/v1/typo-{i}", status=404, seconds_ago=i) for i in range(4)])

    findings = await DetectionEngine(engine).detect_endpoint_enumeration(
        datetime.datetime.utcnow() - datetime.timedelta(minutes=10),
        datetime.datetime.utcnow(),
    )
    assert [f for f in findings if f.source_ip == ip] == []


# ─── Evidence discipline (§17) ───────────────────────────────────────────────


def test_risk_score_is_the_sum_of_signal_weights_and_is_capped():
    finding = Finding(
        rule_id="T-1",
        category="TEST",
        severity="LOW",
        title="t",
        description="d",
        source_ip="1.2.3.4",
        affected_service="svc",
        window_start=datetime.datetime.utcnow(),
        window_end=datetime.datetime.utcnow(),
        signals=[
            Signal("a", 1, 1, 40, "because a"),
            Signal("b", 2, 1, 35, "because b"),
        ],
    )
    assert finding.risk_score == 75

    finding.signals.append(Signal("c", 3, 1, 60, "because c"))
    assert finding.risk_score == 100  # capped, never runaway


def test_stored_payload_separates_fact_from_inference_from_suggestion():
    """The structural guarantee behind §17.

    An analyst must be able to see the measurement, the threshold it crossed,
    and the recommended action as three separate things.
    """
    finding = Finding(
        rule_id="T-2",
        category="TEST",
        severity="HIGH",
        title="t",
        description="d",
        source_ip="1.2.3.4",
        affected_service="svc",
        window_start=datetime.datetime.utcnow(),
        window_end=datetime.datetime.utcnow(),
        observed={"failedAuthentications": 99},
        signals=[Signal("repeated_failed_authentication", 99, 20, 35, "explained")],
        suggested_actions=["Block this source temporarily"],
    )
    payload = finding.signal_payload()

    assert payload["observed"]["failedAuthentications"] == 99      # fact
    assert payload["signals"][0]["threshold"] == 20                 # inference
    assert payload["suggestedActions"] == ["Block this source temporarily"]  # suggestion
    # The score must never be presentable as proof of intent.
    assert "not that malicious intent" in payload["risk"]["interpretation"]
    # And an address must never be presented as an identity.
    assert "does not identify a person" in payload["disclaimer"]


async def test_detection_records_but_never_acts_automatically():
    """§21: high-impact defensive actions stay operator-initiated."""
    await _clear_events()
    ip = _ip()
    await _seed(
        [_req(ip=ip, route="/api/v1/auth/login", status=401, seconds_ago=i) for i in range(40)]
    )

    stored = await DetectionEngine(engine).evaluate()
    assert stored

    async with engine.connect() as conn:
        actions = (
            await conn.execute(text('SELECT DISTINCT "actionTaken" FROM infra_security_events'))
        ).fetchall()
    assert {a[0] for a in actions} == {"DETECTED_ONLY"}


async def test_an_ongoing_attack_is_not_re_reported_every_cycle():
    """Without suppression one attack buries the operator in duplicates."""
    await _clear_events()
    ip = _ip()
    await _seed(
        [_req(ip=ip, route="/api/v1/auth/login", status=401, seconds_ago=i) for i in range(40)]
    )

    first = await DetectionEngine(engine).evaluate()
    second = await DetectionEngine(engine).evaluate()

    assert len(first) >= 1
    assert second == []  # cooldown holds


async def test_one_failing_detector_does_not_silence_the_others(monkeypatch):
    """A broken rule must degrade to fewer detections, not to none."""
    ip = _ip()
    await _seed(
        [_req(ip=ip, route="/api/v1/auth/login", status=401, seconds_ago=i) for i in range(40)]
    )

    async def _boom(*_args, **_kwargs):
        raise RuntimeError("detector exploded")

    engine_under_test = DetectionEngine(engine)
    monkeypatch.setattr(engine_under_test, "detect_endpoint_enumeration", _boom)

    findings = await engine_under_test.evaluate(persist=False)
    assert any(f.rule_id == "AUTH-001" and f.source_ip == ip for f in findings)


# ─── Real-time event bus (§27) ───────────────────────────────────────────────


async def test_subscribers_receive_published_events():
    bus = EventBus()
    async with bus.subscribe() as queue:
        await bus.publish("SECURITY_EVENT", {"ruleId": "AUTH-001"})
        message = await asyncio.wait_for(queue.get(), timeout=2.0)

    assert message["event"] == "SECURITY_EVENT"
    assert message["data"]["ruleId"] == "AUTH-001"
    # Versioned envelope so the console can evolve without a flag day.
    assert message["schemaVersion"] == 1
    assert message["emittedAt"].endswith("Z")


async def test_a_stalled_subscriber_drops_events_instead_of_blocking_detection():
    """An operator's laggy browser tab must never stall the detectors."""
    bus = EventBus()
    async with bus.subscribe() as queue:
        # Never drain: overflow the per-subscriber buffer.
        for i in range(600):
            await bus.publish("API_ERROR", {"seq": i})

        stats = bus.stats()
        assert stats["published"] == 600
        assert stats["droppedToSlowSubscribers"] > 0
        # The subscriber still holds current events rather than being wedged.
        assert not queue.empty()


async def test_publish_survives_having_no_subscribers():
    bus = EventBus()
    await bus.publish("METRIC_ALERT", {"x": 1})
    assert bus.stats()["published"] == 1


def test_envelope_is_versioned_and_typed():
    message = envelope("INCIDENT_CREATED", {"id": "inc-1"})
    assert set(message) == {"schemaVersion", "event", "emittedAt", "data"}
    assert message["event"] == "INCIDENT_CREATED"
