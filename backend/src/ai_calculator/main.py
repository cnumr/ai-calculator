import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from ai_calculator.api.calculate import router as calculate_router
from ai_calculator.api.providers import router as providers_router
from ai_calculator.api.use_cases import router as use_cases_router

app = FastAPI(title="AI Calculator API")

# Dev default matches the Vite dev server port used by docker-compose.yml.
cors_allowed_origins = os.environ.get(
    "CORS_ALLOWED_ORIGINS", "http://localhost:5173"
).split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_allowed_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(providers_router)
app.include_router(calculate_router)
app.include_router(use_cases_router)
