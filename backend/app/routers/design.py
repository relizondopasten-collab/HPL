from dataclasses import asdict

from fastapi import APIRouter
from pydantic import BaseModel, Field

from app.services.randomization import randomize_rcbd

router = APIRouter()


class RCBDRequest(BaseModel):
    n_treatments: int = Field(..., ge=2, le=50)
    n_blocks: int = Field(..., ge=2, le=20)
    seed: int | None = None


class PlotOut(BaseModel):
    block: int
    col: int
    treatment: int


class RCBDResponse(BaseModel):
    plots: list[PlotOut]


@router.post("/rcbd", response_model=RCBDResponse)
def post_rcbd(req: RCBDRequest) -> RCBDResponse:
    layout = randomize_rcbd(req.n_treatments, req.n_blocks, req.seed)
    return RCBDResponse(plots=[PlotOut(**asdict(p)) for p in layout])
