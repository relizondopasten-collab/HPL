"""ANOVA y comparación de medias para diseños experimentales agrícolas."""
from __future__ import annotations

from typing import Any

import numpy as np
import pandas as pd
from statsmodels.formula.api import ols
from statsmodels.stats.anova import anova_lm
from statsmodels.stats.multicomp import pairwise_tukeyhsd


def rcbd_anova_tukey(
    df: pd.DataFrame,
    value_col: str = "value",
    treatment_col: str = "treatment",
    block_col: str | None = "block",
) -> dict[str, Any]:
    """ANOVA RCBD (modelo: value ~ treatment + block) + Tukey HSD entre tratamientos.

    Devuelve tabla ANOVA, comparación pareada Tukey, medias por tratamiento y CV%.
    """
    required = {value_col, treatment_col}
    if block_col:
        required.add(block_col)
    missing = required - set(df.columns)
    if missing:
        raise ValueError(f"Faltan columnas: {sorted(missing)}")

    data = df.dropna(subset=list(required)).copy()
    data[treatment_col] = data[treatment_col].astype(str)
    if block_col:
        data[block_col] = data[block_col].astype(str)

    formula = f"{value_col} ~ C({treatment_col})"
    if block_col:
        formula += f" + C({block_col})"
    model = ols(formula, data=data).fit()
    table = anova_lm(model, typ=2)

    tukey = pairwise_tukeyhsd(
        endog=data[value_col].to_numpy(),
        groups=data[treatment_col].to_numpy(),
        alpha=0.05,
    )
    tukey_rows = tukey._results_table.data[1:]  # type: ignore[attr-defined]

    means = (
        data.groupby(treatment_col)[value_col]
        .agg(["count", "mean", "std"])
        .rename(columns={"count": "n", "mean": "mean", "std": "sd"})
        .reset_index()
    )
    means["se"] = means["sd"] / np.sqrt(means["n"]).replace(0, np.nan)

    grand_mean = float(data[value_col].mean())
    mse = float(model.mse_resid) if model.mse_resid is not None else float("nan")
    cv_pct = (np.sqrt(mse) / grand_mean * 100.0) if grand_mean else float("nan")

    return {
        "anova": [
            {"source": idx, **{k: (None if pd.isna(v) else float(v)) for k, v in row.items()}}
            for idx, row in table.iterrows()
        ],
        "tukey": [
            {
                "group1": str(r[0]),
                "group2": str(r[1]),
                "meandiff": float(r[2]),
                "p_adj": float(r[3]),
                "lower": float(r[4]),
                "upper": float(r[5]),
                "reject": bool(r[6]),
            }
            for r in tukey_rows
        ],
        "means": means.to_dict(orient="records"),
        "grand_mean": grand_mean,
        "mse": mse,
        "cv_pct": cv_pct,
        "n_obs": int(len(data)),
    }
