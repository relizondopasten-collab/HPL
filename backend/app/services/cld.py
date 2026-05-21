"""Compact Letter Display (CLD).

Asigna a cada tratamiento una cadena de letras de modo que dos tratamientos
compartan letra si y sólo si NO difieren significativamente.

Implementación: enumeración de cliques maximales (Bron–Kerbosch) sobre el grafo
"no diferente". Para n ≤ ~15 (típico en ensayos agrícolas) es práctico.

Las letras se asignan en orden de la media descendente: la 'a' va al tratamiento
con mayor media.
"""
from __future__ import annotations

from typing import Iterable


def compact_letter_display(
    means: dict[str, float],
    differing_pairs: Iterable[tuple[str, str]],
) -> dict[str, str]:
    """Devuelve {treatment: letras} ordenando por media descendente.

    `differing_pairs` son los pares (g1, g2) con diferencia significativa
    (rechazo de H0 en Tukey).
    """
    treatments = list(means.keys())
    if not treatments:
        return {}

    diff = {frozenset(p) for p in differing_pairs}

    # Grafo de "NO diferente" (aristas entre tratamientos sin diferencia significativa).
    adj: dict[str, set[str]] = {t: set() for t in treatments}
    for i, a in enumerate(treatments):
        for b in treatments[i + 1 :]:
            if frozenset((a, b)) not in diff:
                adj[a].add(b)
                adj[b].add(a)

    cliques: list[set[str]] = []

    def bron_kerbosch(r: set[str], p: set[str], x: set[str]) -> None:
        if not p and not x:
            cliques.append(set(r))
            return
        # Pivot para podar (Tomita)
        pivot = max(p | x, key=lambda v: len(adj[v] & p)) if (p | x) else None
        candidates = p - (adj[pivot] if pivot is not None else set())
        for v in list(candidates):
            nv = adj[v]
            bron_kerbosch(r | {v}, p & nv, x & nv)
            p.remove(v)
            x.add(v)

    bron_kerbosch(set(), set(treatments), set())

    # Cada tratamiento debe quedar en al menos una clique; los tratamientos sin
    # vecinos forman cliques unipersonales (Bron–Kerbosch ya las produce).

    # Ordenar cliques por la media del mejor tratamiento de la clique (desc)
    cliques.sort(key=lambda c: -max(means[t] for t in c))

    letters: dict[str, str] = {t: "" for t in treatments}
    for idx, clique in enumerate(cliques):
        letter = _letter_for_index(idx)
        for t in clique:
            letters[t] += letter

    # Ordenar las letras de cada tratamiento alfabéticamente para legibilidad
    return {t: "".join(sorted(set(letters[t]))) for t in treatments}


def _letter_for_index(i: int) -> str:
    # 0 -> 'a', 25 -> 'z', 26 -> 'aa', 27 -> 'ab', ...
    out = ""
    n = i
    while True:
        out = chr(ord("a") + (n % 26)) + out
        n = n // 26 - 1
        if n < 0:
            return out
