import hashlib
import hmac
import secrets
import re
import urllib.parse
from decimal import Decimal, ROUND_HALF_UP
from typing import List, Dict, Any, Optional

# ==============================================================================
# 1. FIXED ASSETS DEPRECIATION CALCULATOR
# ==============================================================================

class DepreciationCalculator:
    @staticmethod
    def calculate_monthly(
        purchase_cost: Decimal,
        salvage_value: Decimal,
        useful_life_months: int,
        accumulated_depreciation: Decimal,
        method: str = "STRAIGHT_LINE"
    ) -> Dict[str, Decimal]:
        depreciable_base = max(Decimal('0.0'), purchase_cost - salvage_value)
        remaining_depreciable = max(Decimal('0.0'), depreciable_base - accumulated_depreciation)

        if useful_life_months <= 0 or remaining_depreciable <= Decimal('0.0'):
            return {
                "monthlyDepreciation": Decimal('0.0'),
                "newAccumulated": accumulated_depreciation,
                "newBookValue": purchase_cost - accumulated_depreciation
            }

        if method == "DECLINING_BALANCE":
            # 200% declining balance rate
            rate = (Decimal('2.0') / Decimal(useful_life_months))
            current_book_val = purchase_cost - accumulated_depreciation
            monthly = min(remaining_depreciable, (current_book_val * rate).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP))
        else:
            # Straight line
            monthly = min(remaining_depreciable, (depreciable_base / Decimal(useful_life_months)).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP))

        new_accumulated = accumulated_depreciation + monthly
        new_book_value = purchase_cost - new_accumulated

        return {
            "monthlyDepreciation": monthly,
            "newAccumulated": new_accumulated,
            "newBookValue": new_book_value
        }

# ==============================================================================
# 2. HR & PAYROLL CALCULATOR
# ==============================================================================

class PayrollCalculator:
    @staticmethod
    def calculate_net_pay(
        base_salary: Decimal,
        allowances: Decimal = Decimal('0.0'),
        deductions: Decimal = Decimal('0.0'),
        tax_rate_pct: Decimal = Decimal('5.0')
    ) -> Dict[str, Decimal]:
        gross_pay = base_salary + allowances
        taxable_amount = max(Decimal('0.0'), gross_pay - deductions)
        tax_amount = (taxable_amount * (tax_rate_pct / Decimal('100.0'))).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
        net_pay = max(Decimal('0.0'), gross_pay - deductions - tax_amount)

        return {
            "baseSalary": base_salary,
            "allowances": allowances,
            "grossPay": gross_pay,
            "deductions": deductions,
            "taxAmount": tax_amount,
            "netPay": net_pay
        }

# ==============================================================================
# 3. DEVELOPER API KEY & HMAC GENERATOR
# ==============================================================================

class ApiKeyGenerator:
    @staticmethod
    def generate_api_key(environment: str = "live") -> Dict[str, str]:
        prefix = f"sk_{environment}_"
        random_bytes = secrets.token_hex(24)
        full_key = f"{prefix}{random_bytes}"
        key_prefix = full_key[:14]  # e.g., sk_live_a1b2c3
        
        # SHA-256 hash for secure storage
        key_hash = hashlib.sha256(full_key.encode('utf-8')).hexdigest()

        return {
            "rawKey": full_key,
            "keyPrefix": key_prefix,
            "keyHash": key_hash
        }

    @staticmethod
    def verify_key(raw_key: str, expected_hash: str) -> bool:
        computed = hashlib.sha256(raw_key.encode('utf-8')).hexdigest()
        return hmac.compare_digest(computed, expected_hash)

    @staticmethod
    def compute_hmac_signature(payload_str: str, secret: str) -> str:
        return hmac.new(secret.encode('utf-8'), payload_str.encode('utf-8'), hashlib.sha256).hexdigest()

# ==============================================================================
# 4. TELEGRAM COMMAND ROUTER
# ==============================================================================

class TelegramCommandRouter:
    @staticmethod
    def route_command(command: str, params: str = "", context: Dict[str, Any] = None) -> str:
        cmd = command.lower().strip()
        ctx = context or {}

        if cmd == "/start" or cmd == "/help":
            return (
                "🤖 *Universal Enterprise Bot Active*\n\n"
                "Available Commands:\n"
                "• `/sales` — View revenue velocity and order counts\n"
                "• `/stock` — Depleted items & reorder alerts\n"
                "• `/orders` — Pending transaction volume\n"
                "• `/approve <id>` — Sign off workflow approvals\n"
                "• `/help` — Command directory"
            )
        elif cmd == "/sales":
            sales_today = ctx.get("salesToday", "1,245.50")
            count = ctx.get("orderCount", 18)
            return f"📊 *Sales Summary*\n• Revenue Today: `${sales_today}`\n• Completed Orders: `{count}`"
        elif cmd == "/stock":
            low_count = ctx.get("lowStockCount", 3)
            return f"⚠️ *Inventory Watchlist*\n• Low Stock SKUs: `{low_count}` items require reorder."
        elif cmd == "/orders":
            pending = ctx.get("pendingOrders", 2)
            return f"📦 *Order Status*\n• Open Fulfillment: `{pending}` orders pending."
        elif cmd == "/approve":
            return f"✅ *Approval Request Signed*\n• Reference: `{params or 'REQ-CURRENT'}` marked Approved."
        else:
            return f"❓ Unknown command `{command}`. Type `/help` for available options."

# ==============================================================================
# 5. n8n FLOW AUTOMATION DAG ENGINE
# ==============================================================================

class FlowExecutionEngine:
    MAX_STEPS = 50

    @staticmethod
    def is_safe_outbound_url(url_str: str) -> bool:
        try:
            parsed = urllib.parse.urlparse(url_str)
            if parsed.scheme not in ["http", "https"]:
                return False
            host = (parsed.hostname or "").lower()
            if host in ["localhost", "127.0.0.1", "0.0.0.0", "::1", "169.254.169.254"]:
                return False
            if host.startswith("127.") or host.startswith("10.") or host.startswith("192.168."):
                return False
            if re.match(r"^172\.(1[6-9]|2[0-9]|3[0-1])\.", host):
                return False
            return True
        except Exception:
            return False

    @classmethod
    def resolve_value(cls, expr: Any, context: Dict[str, Any]) -> Any:
        if not isinstance(expr, str):
            return expr
        # Match {{trigger.field}} or {{steps.node.output}}
        pattern = r"\{\{([^}]+)\}\}"
        matches = re.findall(pattern, expr)
        if not matches:
            return expr

        res = expr
        for match in matches:
            parts = match.strip().split(".")
            curr = context
            for p in parts:
                if isinstance(curr, dict) and p in curr:
                    curr = curr[p]
                else:
                    curr = ""
                    break
            res = res.replace(f"{{{{{match}}}}}", str(curr))
        return res

    @classmethod
    def evaluate_condition(cls, left: Any, operator: str, right: Any) -> bool:
        try:
            # Try numeric comparison if possible
            l_num = float(left)
            r_num = float(right)
            if operator == "GREATER_THAN":
                return l_num > r_num
            elif operator == "LESS_THAN":
                return l_num < r_num
            elif operator == "EQUALS":
                return l_num == r_num
            elif operator == "NOT_EQUALS":
                return l_num != r_num
        except (ValueError, TypeError):
            pass

        # String fallback
        l_str = str(left)
        r_str = str(right)
        if operator == "EQUALS":
            return l_str == r_str
        elif operator == "NOT_EQUALS":
            return l_str != r_str
        elif operator == "CONTAINS":
            return r_str in l_str
        return False

    @classmethod
    async def execute(
        cls,
        nodes: List[Dict[str, Any]],
        edges: List[Dict[str, Any]],
        initial_payload: Dict[str, Any]
    ) -> Dict[str, Any]:
        node_map = {n["id"]: n for n in nodes}
        trigger_node = next((n for n in nodes if n.get("type") == "TRIGGER"), None)

        if not trigger_node:
            return {
                "status": "FAILED",
                "executionTrace": [],
                "output": {},
                "error": "Invalid flow: TRIGGER node not found in graph."
            }

        trace: List[Dict[str, Any]] = []
        context: Dict[str, Any] = {
            "trigger": initial_payload,
            "steps": {}
        }

        current_node: Optional[Dict[str, Any]] = trigger_node
        current_input = dict(initial_payload)

        while current_node:
            if len(trace) >= cls.MAX_STEPS:
                return {
                    "status": "FAILED",
                    "executionTrace": trace,
                    "output": current_input,
                    "error": f"Execution halted: Maximum step limit ({cls.MAX_STEPS}) exceeded (potential cyclic graph)."
                }

            node = current_node
            node_id = node["id"]
            node_type = node.get("type")
            subtype = node.get("subtype", "")
            params = node.get("parameters", {})
            branch_handle = "default"
            node_output: Dict[str, Any] = {}

            if node_type == "TRIGGER":
                node_output = dict(current_input)
            elif node_type == "CONDITION":
                field = params.get("field", "")
                resolved_left = cls.resolve_value(field, context)
                operator = params.get("operator", "EQUALS")
                val = params.get("value", "")
                is_match = cls.evaluate_condition(resolved_left, operator, val)
                branch_handle = "true" if is_match else "false"
                node_output = {
                    "conditionMet": is_match,
                    "evaluated": resolved_left,
                    "branch": branch_handle
                }
            elif node_type == "TRANSFORM":
                node_output = {"transformed": True, **current_input}
            elif node_type == "ACTION":
                # Interpolate parameters
                resolved_params = {}
                for k, v in params.items():
                    resolved_params[k] = cls.resolve_value(v, context)
                node_output = {"executed": True, "action": subtype, "params": resolved_params}

            trace.append({
                "nodeId": node_id,
                "nodeName": node.get("name", node_id),
                "type": node_type,
                "subtype": subtype,
                "status": "SUCCESS",
                "durationMs": 4,
                "inputData": current_input,
                "outputData": node_output
            })

            context["steps"][node_id] = {"output": node_output}
            current_input = node_output

            # Traverse outgoing edge
            outgoing = [e for e in edges if e.get("sourceNodeId") == node_id]
            next_edge = None
            if node_type == "CONDITION":
                next_edge = next((e for e in outgoing if e.get("sourceHandle") == branch_handle), None)
            else:
                next_edge = outgoing[0] if outgoing else None

            current_node = node_map.get(next_edge["targetNodeId"]) if next_edge else None

        return {
            "status": "SUCCESS",
            "executionTrace": trace,
            "output": current_input,
            "error": None
        }
