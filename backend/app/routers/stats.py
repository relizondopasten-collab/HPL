from typing import Any

import pandas as pd
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.services.anova import rcbd_anova_tukey
from app.services.cld import compact_letter_display
from app.services.efficacy import abbott, henderson_tilton

router = APIRouter()


# -------------------- Eficacia --------------------

class AbbottRequest(BaseModel):
    control_alive: float = Field(..., ge=0)
    treated_alive: float = Field(..., ge=0)


class AbbottResponse(BaseModel):
    efficacy_pct: float | None


@router.post("/abbott", response_model=AbbottResponse)
def post_abbott(req: AbbottRequest) -> AbbottResponse:
    return AbbottResponse(efficacy_pct=abbott(req.control_alive, req.treated_alive))


class HendersonTiltonRequest(BaseModel):
    control_pre: float = Field(..., ge=0)
    control_post: float = Field(..., ge=0)
    treated_pre: float = Field(..., ge=0)
    treated_post: float = Field(..., ge=0)


@router.post("/henderson-tilton", response_model=AbbottResponse)
def post_henderson_tilton(req: HendersonTiltonRequest) -> AbbottResponse:
    return AbbottResponse(
        efficacy_pct=henderson_tilton(
            req.control_pre, req.control_post, req.treated_pre, req.treated_post
        )
    )


# -------------------- ANOVA --------------------

class Observation(BaseModel):
    treatment: str
    block: str | None = None
    value: float


class AnovaRequest(BaseModel):
    observations: list[Observation]
    use_block: bool = True


@router.post("/anova-rcbd")
def post_anova_rcbd(req: AnovaRequest) -> dict[str, Any]:
    if len(req.observations) < 4:
        raise HTTPException(400, "Se requieren al menos 4 observaciones")
    df = pd.DataFrame([o.model_dump() for o in req.observations])
    block_col = "block" if req.use_block and df["block"].notna().all() else None
    return rcbd_anova_tukey(df, value_col="value", treatment_col="treatment", block_col=block_col)


# -------------------- Análisis completo de evaluación --------------------


class AnalyzeRequest(BaseModel):
    observations: list[Observation]
    control_treatment: str | None = None
    use_block: bool = True


@router.post("/analyze-evaluation")
def post_analyze_evaluation(req: AnalyzeRequest) -> dict[str, Any]:
    if len(req.observations) < 4:
        raise HTTPException(400, "Se requieren al menos 4 observaciones")

    df = pd.DataFrame([o.model_dump() for o in req.observations])
    block_col = "block" if req.use_block and df["block"].notna().all() else None

    result = rcbd_anova_tukey(
        df, value_col="value", treatment_col="treatment", block_col=block_col
    )

    means_by_trt: dict[str, float] = {row["treatment"]: row["mean"] for row in result["means"]}

    differing = [
        (t["group1"], t["group2"]) for t in result["tukey"] if t["reject"]
    ]
    letters = compact_letter_display(means_by_trt, differing)

    # Eficacia Abbott vs. testigo (si se indicó)
    control = req.control_treatment
    control_mean = means_by_trt.get(control) if control else None

    enriched_means = []
    for row in result["means"]:
        trt = row["treatment"]
        eff = (
            abbott(control_mean, row["mean"])
            if control_mean is not None and trt != control
            else (0.0 if trt == control else None)
        )
        enriched_means.append({**row, "letter": letters.get(trt, ""), "efficacy_pct": eff})

    # Ordenar por media descendente para presentación
    enriched_means.sort(key=lambda r: -r["mean"])

    result["means"] = enriched_means
    result["control_treatment"] = control
    return result
