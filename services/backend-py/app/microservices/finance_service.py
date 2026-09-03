import uvicorn
from app.microservices.common import create_microservice
from app.modules.finance.api import router as finance_router

app = create_microservice(
    name="Finance & Ledger Microservice",
    description="Manages Chart of Accounts, General Ledger journal entries, balance sheets, and tax accounting.",
    port=4006
)

app.include_router(finance_router, prefix="/api/v1")

if __name__ == "__main__":
    print("🚀 Starting Finance & Ledger Microservice on http://localhost:4006...")
    uvicorn.run(app, host="0.0.0.0", port=4006)
