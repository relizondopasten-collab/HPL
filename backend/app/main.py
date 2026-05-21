from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.routers import design, reports, stats

app = FastAPI(
    title="Estación Experimental API",
    description="Diseño experimental, estadística y reportes para ensayos agrícolas.",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(design.router, prefix="/design", tags=["design"])
app.include_router(stats.router, prefix="/stats", tags=["stats"])
app.include_router(reports.router, prefix="/reports", tags=["reports"])


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
