from fastapi import FastAPI

from ai_calculator.api.providers import router as providers_router

app = FastAPI(title="AI Calculator API")
app.include_router(providers_router)
