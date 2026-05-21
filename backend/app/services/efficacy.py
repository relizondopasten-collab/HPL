"""Fórmulas de eficacia para ensayos de plaguicidas.

- Abbott (1925): eficacia con respecto a un testigo no tratado,
  asumiendo poblaciones iniciales equivalentes.
- Henderson-Tilton (1955): corrige por diferencias en la población
  pre-tratamiento entre testigo y tratamiento.
"""
from __future__ import annotations


def abbott(control_alive: float, treated_alive: float) -> float | None:
    """% Eficacia Abbott.

    E = (C - T) / C * 100
    """
    if control_alive is None or treated_alive is None:
        return None
    if control_alive <= 0:
        return None
    eff = (control_alive - treated_alive) / control_alive * 100.0
    return max(0.0, min(100.0, eff))


def henderson_tilton(
    control_pre: float,
    control_post: float,
    treated_pre: float,
    treated_post: float,
) -> float | None:
    """% Eficacia Henderson-Tilton.

    E = (1 - (Tpost * Cpre) / (Tpre * Cpost)) * 100
    """
    for v in (control_pre, control_post, treated_pre, treated_post):
        if v is None or v < 0:
            return None
    if control_pre <= 0 or treated_pre <= 0 or control_post <= 0:
        return None
    ratio = (treated_post * control_pre) / (treated_pre * control_post)
    eff = (1.0 - ratio) * 100.0
    return max(0.0, min(100.0, eff))
