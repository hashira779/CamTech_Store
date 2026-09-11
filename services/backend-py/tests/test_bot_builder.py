"""
Bot Builder & Workflow Automation — Comprehensive Unit & Integration Tests.
Covers:
1. Variable Resolver engine (resolve_template, build_context)
2. Node Executor (condition branching, send_message, variable resolution)
3. State Manager (set_state, get_state, update_variable, clear_state)
4. Workflows CRUD, Publishing, Versioning & Rollback API
"""
import pytest
import pytest_asyncio
from unittest.mock import AsyncMock
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.main import app
from app.core.database import AsyncSessionLocal
from app.core.security import create_access_token
from app.modules.bot_builder.engine.variable_resolver import resolve_template, build_context
from app.modules.bot_builder.engine.node_executor import NodeExecutor
from app.modules.bot_builder.engine.state_manager import StateManager
from app.modules.automations.models import TelegramBot


@pytest.fixture
async def auth_headers():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.post("/api/v1/auth/login", json={"email": "admin@demo.test", "password": "Admin123!"})
        assert resp.status_code == 200, f"Login failed: {resp.text}"
        token = resp.json()["data"]["accessToken"]
        return {"Authorization": f"Bearer {token}"}


# ─── 1. Variable Resolver Engine Tests ────────────────────────────────────────

def test_variable_resolver_simple():
    context = {"first_name": "Sokha", "username": "sokha_cam"}
    template = "Hello, {{first_name}}! Your handle is @{{username}}."
    resolved = resolve_template(template, context)
    assert resolved == "Hello, Sokha! Your handle is @sokha_cam."


def test_variable_resolver_nested():
    context = {
        "order": {
            "id": "ORD-1234",
            "total": 45.5,
        },
        "customer": {
            "name": "Dara",
        },
    }
    template = "Order #{{order.id}} for {{customer.name}}: Total ${{order.total}}"
    resolved = resolve_template(template, context)
    assert resolved == "Order #ORD-1234 for Dara: Total $45.5"


def test_variable_resolver_missing_fallback():
    context = {"known": "val"}
    template = "{{known}} and {{unknown_var}}"
    resolved = resolve_template(template, context)
    assert "val and {{unknown_var}}" == resolved


def test_build_context():
    telegram_user = {
        "id": 123456,
        "first_name": "Test",
        "last_name": "User",
        "username": "testuser",
    }
    input_data = {"text": "Hello bot"}
    conv_vars = {"flow_step": "greeting"}

    ctx = build_context(
        telegram_user=telegram_user,
        input_data=input_data,
        conversation_vars=conv_vars,
    )
    assert ctx["user"]["firstName"] == "Test"
    assert ctx["user"]["name"] == "Test User"
    assert ctx["input"]["text"] == "Hello bot"
    assert ctx["flow_step"] == "greeting"


# ─── 2. State Manager Tests ───────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_state_manager_lifecycle():
    async with AsyncSessionLocal() as db:
        bot_id = "test-bot-state-1"
        user_id = "999888777"
        chat_id = "123456"
        org_id = "cmtk8h18o0000vkd0etmdacgw"

        bot = TelegramBot(
            id=bot_id,
            organization_id=org_id,
            name="State Test Bot",
            bot_token="test_token_state",
            is_active=True,
        )
        db.add(bot)
        try:
            await db.commit()
        except Exception:
            await db.rollback()

        # 1. Get or create state
        st = await StateManager.get_or_create(
            db=db,
            organization_id=org_id,
            bot_id=bot_id,
            telegram_user_id=user_id,
            chat_id=chat_id,
            workflow_id="wf-test-1",
        )
        assert st is not None
        assert st.bot_id == bot_id
        assert st.telegram_user_id == user_id

        # 2. Advance state
        advanced = await StateManager.advance(
            db=db,
            state=st,
            next_node_id="node-step-2",
            variables={"phone": "+85512345678"},
            waiting_for_input=True,
            input_node_id="node-step-2",
        )
        assert advanced.current_node_id == "node-step-2"
        assert advanced.variables.get("phone") == "+85512345678"
        assert advanced.waiting_for_input is True

        # 3. Reset state
        await StateManager.reset(db=db, state=advanced)
        assert advanced.current_node_id is None
        assert advanced.variables == {}

        # 4. Destroy state
        await StateManager.destroy(db=db, state=advanced)
        await db.commit()


# ─── 3. Node Executor Logic & Branching ───────────────────────────────────────

@pytest.mark.asyncio
async def test_node_executor_condition_branching():
    adapter = AsyncMock()
    adapter.send_message.return_value = {"ok": True, "result": {"message_id": 100}}

    executor = NodeExecutor(adapter=adapter)

    edges = [
        {"id": "e1", "source": "cond-1", "target": "msg-true", "sourceHandle": "true"},
        {"id": "e2", "source": "cond-1", "target": "msg-false", "sourceHandle": "false"},
    ]

    cond_node = {
        "id": "cond-1",
        "type": "condition",
        "data": {
            "config": {
                "variable": "is_vip",
                "operator": "equals",
                "value": "true",
            }
        },
    }

    # VIP evaluation
    res_true = await executor.execute_node(
        node=cond_node,
        edges=edges,
        context={"is_vip": "true"},
        chat_id="12345",
    )
    assert res_true.success is True
    assert res_true.next_node_id == "msg-true"

    # Non-VIP evaluation
    res_false = await executor.execute_node(
        node=cond_node,
        edges=edges,
        context={"is_vip": "false"},
        chat_id="12345",
    )
    assert res_false.success is True
    assert res_false.next_node_id == "msg-false"


@pytest.mark.asyncio
async def test_node_executor_send_message_template():
    adapter = AsyncMock()
    adapter.send_message.return_value = {"ok": True, "result": {"message_id": 101}}

    executor = NodeExecutor(adapter=adapter)

    node = {
        "id": "msg-1",
        "type": "send_message",
        "data": {
            "config": {
                "message": "Welcome {{user.name}}! Thanks for joining.",
            }
        },
    }
    edges = [{"id": "e1", "source": "msg-1", "target": "next-step"}]
    context = {"user": {"name": "Sokha"}}

    result = await executor.execute_node(
        node=node,
        edges=edges,
        context=context,
        chat_id="998877",
    )
    assert result.success is True
    assert result.next_node_id == "next-step"
    adapter.send_message.assert_called_once_with(
        "998877",
        "Welcome Sokha! Thanks for joining.",
    )


# ─── 4. Workflows CRUD, Publish, Versioning & Rollback API ──────────────────

@pytest.mark.asyncio
async def test_bot_builder_workflow_api_lifecycle(auth_headers):
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # First ensure a test bot exists
        async with AsyncSessionLocal() as db:
            bot = TelegramBot(
                id="test-builder-bot-1",
                organization_id="cmtk8h18o0000vkd0etmdacgw",
                name="Test Builder Bot",
                bot_username="test_builder_bot",
                bot_token="fakehash123",
                is_active=True,
            )
            db.add(bot)
            try:
                await db.commit()
            except Exception:
                await db.rollback()

        # 1. Create a new workflow
        create_payload = {
            "botId": "test-builder-bot-1",
            "name": "Customer Support Flow",
            "description": "Visual support flow for inquiries",
            "draftNodes": [
                {
                    "id": "node-1",
                    "type": "start",
                    "position": {"x": 100, "y": 100},
                    "data": {"label": "Start Flow"},
                },
                {
                    "id": "node-2",
                    "type": "send_message",
                    "position": {"x": 100, "y": 250},
                    "data": {"label": "Welcome", "config": {"message": "Hello from Bot Builder v1!"}},
                },
            ],
            "draftEdges": [
                {"id": "edge-1", "source": "node-1", "target": "node-2"},
            ],
        }

        res = await client.post("/api/v1/bot-builder/workflows", json=create_payload, headers=auth_headers)
        assert res.status_code == 201, res.text
        wf_data = res.json()["data"]
        wf_id = wf_data["id"]
        assert wf_data["name"] == "Customer Support Flow"
        assert wf_data["status"] == "DRAFT"

        # 2. Get the workflow
        get_res = await client.get(f"/api/v1/bot-builder/workflows/{wf_id}", headers=auth_headers)
        assert get_res.status_code == 200
        assert get_res.json()["data"]["id"] == wf_id

        # 2b. Test empty workflow publish rejection and atomic publish
        empty_wf_res = await client.post(
            "/api/v1/bot-builder/workflows",
            json={"botId": "test-builder-bot-1", "name": "Empty Test Flow"},
            headers=auth_headers,
        )
        assert empty_wf_res.status_code == 201
        empty_wf_id = empty_wf_res.json()["data"]["id"]

        # Explicitly clear nodes to make it empty
        await client.patch(
            f"/api/v1/bot-builder/workflows/{empty_wf_id}",
            json={"draftNodes": [], "draftEdges": []},
            headers=auth_headers,
        )

        empty_pub_res = await client.post(
            f"/api/v1/bot-builder/workflows/{empty_wf_id}/publish",
            json={"notes": "Try publish empty"},
            headers=auth_headers,
        )
        assert empty_pub_res.status_code == 400
        assert "Cannot publish an empty workflow" in empty_pub_res.json()["message"]

        atomic_pub_res = await client.post(
            f"/api/v1/bot-builder/workflows/{empty_wf_id}/publish",
            json={
                "notes": "Atomic publish with nodes",
                "draftNodes": [
                    {"id": "n1", "type": "start", "position": {"x": 0, "y": 0}, "data": {"label": "Start"}}
                ],
                "draftEdges": [],
            },
            headers=auth_headers,
        )
        assert atomic_pub_res.status_code == 201
        assert atomic_pub_res.json()["data"]["versionNumber"] == 1
        await client.delete(f"/api/v1/bot-builder/workflows/{empty_wf_id}", headers=auth_headers)

        # 3. Publish to create Version 1
        pub_res = await client.post(
            f"/api/v1/bot-builder/workflows/{wf_id}/publish",
            json={"notes": "Initial v1 release"},
            headers=auth_headers,
        )
        assert pub_res.status_code == 201, pub_res.text
        v1_data = pub_res.json()["data"]
        assert v1_data["versionNumber"] == 1
        assert v1_data["notes"] == "Initial v1 release"

        # Check workflow is now PUBLISHED and pointed to v1
        wf_v1 = (await client.get(f"/api/v1/bot-builder/workflows/{wf_id}", headers=auth_headers)).json()["data"]
        assert wf_v1["status"] == "PUBLISHED"
        assert wf_v1["publishedVersionNumber"] == 1

        # 4. Update draft with new node and publish Version 2
        update_payload = {
            "draftNodes": [
                {
                    "id": "node-1",
                    "type": "start",
                    "position": {"x": 100, "y": 100},
                    "data": {"label": "Start Flow"},
                },
                {
                    "id": "node-2",
                    "type": "send_message",
                    "position": {"x": 100, "y": 250},
                    "data": {"label": "Welcome", "config": {"message": "Updated message in v2!"}},
                },
                {
                    "id": "node-3",
                    "type": "send_message",
                    "position": {"x": 100, "y": 400},
                    "data": {"label": "Follow Up", "config": {"message": "How can we help?"}},
                },
            ],
            "draftEdges": [
                {"id": "edge-1", "source": "node-1", "target": "node-2"},
                {"id": "edge-2", "source": "node-2", "target": "node-3"},
            ],
        }
        patch_res = await client.patch(f"/api/v1/bot-builder/workflows/{wf_id}", json=update_payload, headers=auth_headers)
        assert patch_res.status_code == 200

        pub2_res = await client.post(
            f"/api/v1/bot-builder/workflows/{wf_id}/publish",
            json={"notes": "Added follow-up step in v2"},
            headers=auth_headers,
        )
        assert pub2_res.status_code == 201
        assert pub2_res.json()["data"]["versionNumber"] == 2

        # 5. List versions
        vers_res = await client.get(f"/api/v1/bot-builder/workflows/{wf_id}/versions", headers=auth_headers)
        assert vers_res.status_code == 200
        vers = vers_res.json()["data"]
        assert len(vers) == 2
        assert vers[0]["versionNumber"] == 2
        assert vers[1]["versionNumber"] == 1

        # 6. Rollback to Version 1
        rb_res = await client.post(f"/api/v1/bot-builder/workflows/{wf_id}/rollback/1", headers=auth_headers)
        assert rb_res.status_code == 200
        rb_wf = rb_res.json()["data"]
        assert rb_wf["publishedVersionNumber"] == 1

        # 7. Cleanup test workflow
        del_res = await client.delete(f"/api/v1/bot-builder/workflows/{wf_id}", headers=auth_headers)
        assert del_res.status_code == 200
