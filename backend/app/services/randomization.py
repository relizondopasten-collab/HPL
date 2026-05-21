"""Aleatorización de diseños experimentales.

MVP: Randomized Complete Block Design (DBCA).
"""
from __future__ import annotations

import random
from dataclasses import dataclass


@dataclass
class PlotAssignment:
    block: int
    col: int
    treatment: int


def randomize_rcbd(
    n_treatments: int,
    n_blocks: int,
    seed: int | None = None,
) -> list[PlotAssignment]:
    """Genera el layout aleatorizado de un DBCA.

    Cada bloque contiene los `n_treatments` tratamientos en orden aleatorio
    independiente. Devuelve la lista de parcelas con (bloque, columna, tratamiento).
    """
    if n_treatments < 2:
        raise ValueError("n_treatments debe ser >= 2")
    if n_blocks < 2:
        raise ValueError("n_blocks debe ser >= 2 (un DBCA necesita bloques)")

    rng = random.Random(seed)
    layout: list[PlotAssignment] = []
    for block in range(1, n_blocks + 1):
        order = list(range(1, n_treatments + 1))
        rng.shuffle(order)
        for col, treatment in enumerate(order, start=1):
            layout.append(PlotAssignment(block=block, col=col, treatment=treatment))
    return layout
