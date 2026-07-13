from fastapi import FastAPI

from ai_calculator.api.calculate import router as calculate_router
from ai_calculator.api.providers import router as providers_router

app = FastAPI(title="AI Calculator API")
app.include_router(providers_router)
app.include_router(calculate_router)
