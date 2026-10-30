from typing import List, Dict, Any, Optional
from pydantic import BaseModel
from fastapi import APIRouter, Depends
from app.core.dependencies import get_current_user, TenantUser
from app.domain.ai_copilot_engine import AiCopilotEngine

router = APIRouter(prefix="/ai", tags=["AI Copilot & Assistant (Spec §68-§71)"])

class CopilotChatInput(BaseModel):
    message: str
    pageContext: Optional[str] = None

class CopilotChatResponse(BaseModel):
    intent: str
    authorized: bool
    message: str
    actionLink: Optional[str] = None
    actionText: Optional[str] = None
    suggestions: List[str]

@router.post("/chat", response_model=CopilotChatResponse)
async def copilot_chat(
    inp: CopilotChatInput,
    user: TenantUser = Depends(get_current_user)
):
    """
    Processes natural language enterprise queries with contextual data and RBAC tool security.
    """
    res = AiCopilotEngine.generate_response(
        query=inp.message,
        user_roles=user.roles
    )
    return CopilotChatResponse(**res)

@router.get("/suggestions")
async def get_copilot_suggestions(
    context: Optional[str] = "dashboard",
    user: TenantUser = Depends(get_current_user)
):
    """
    Returns contextual prompt recommendations based on the user's active page.
    """
    suggestions_by_page = {
        "dashboard": [
            "What are today's sales and top products?",
            "Show low stock inventory alerts",
            "Where are our active drivers right now?",
        ],
        "sales": [
            "Summarize sales by payment method",
            "What is today's average order value?",
            "Who are the top cashiers today?",
        ],
        "inventory": [
            "Which items need immediate reorder?",
            "Show recent stock adjustments",
            "Calculate total inventory valuation",
        ],
        "delivery": [
            "Show live fleet status and ETA",
            "Which orders are waiting for dispatch?",
            "List drivers with low battery",
        ],
        "finance": [
            "What is our gross profit margin this month?",
            "Show accounts receivable aging",
            "Summarize tax liabilities",
        ],
    }
    return {
        "context": context,
        "prompts": suggestions_by_page.get(context, suggestions_by_page["dashboard"])
    }
