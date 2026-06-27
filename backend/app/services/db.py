"""Cliente Supabase para acceso del backend con service_role.

Se usa para reportes y análisis batch que necesitan saltar RLS.
NUNCA exponer la service_role key al cliente.
"""
from __future__ import annotations

from functools import lru_cache
from typing import Any

from supabase import Client, create_client

from app.config import settings


@lru_cache(maxsize=1)
def db() -> Client:
    if not settings.supabase_url or not settings.supabase_service_key:
        raise RuntimeError(
            "Faltan SUPABASE_URL / SUPABASE_SERVICE_KEY en el entorno del backend."
        )
    return create_client(settings.supabase_url, settings.supabase_service_key)


# =================== Lecturas ===================

def get_trial(trial_id: str) -> dict[str, Any] | None:
    res = db().table("trials").select("*").eq("id", trial_id).limit(1).execute()
    return res.data[0] if res.data else None


def get_client(client_id: str | None) -> dict[str, Any] | None:
    if not client_id:
        return None
    res = db().table("clients").select("*").eq("id", client_id).limit(1).execute()
    return res.data[0] if res.data else None


def get_crop(crop_id: str | None) -> dict[str, Any] | None:
    if not crop_id:
        return None
    res = db().table("crops").select("*").eq("id", crop_id).limit(1).execute()
    return res.data[0] if res.data else None


def get_pest(pest_id: str | None) -> dict[str, Any] | None:
    if not pest_id:
        return None
    res = db().table("pests").select("*").eq("id", pest_id).limit(1).execute()
    return res.data[0] if res.data else None


def get_treatments(trial_id: str) -> list[dict[str, Any]]:
    res = (
        db()
        .table("treatments")
        .select("*")
        .eq("trial_id", trial_id)
        .order("number")
        .execute()
    )
    return res.data or []


def get_plots(trial_id: str) -> list[dict[str, Any]]:
    res = db().table("plots").select("*").eq("trial_id", trial_id).execute()
    return res.data or []


def get_evaluation(evaluation_id: str) -> dict[str, Any] | None:
    res = (
        db()
        .table("evaluations")
        .select("*")
        .eq("id", evaluation_id)
        .limit(1)
        .execute()
    )
    return res.data[0] if res.data else None


def get_pest_counts(evaluation_id: str) -> list[dict[str, Any]]:
    res = (
        db()
        .table("pest_counts")
        .select("*")
        .eq("evaluation_id", evaluation_id)
        .execute()
    )
    return res.data or []


def list_evaluations_for_trial(trial_id: str) -> list[dict[str, Any]]:
    res = (
        db()
        .table("evaluations")
        .select("*")
        .eq("trial_id", trial_id)
        .order("evaluated_at")
        .execute()
    )
    return res.data or []
