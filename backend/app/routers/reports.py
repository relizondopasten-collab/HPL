from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import Response

from app.services import reports

router = APIRouter()


@router.get("/evaluation/{evaluation_id}.pdf")
def get_evaluation_pdf(
    evaluation_id: str,
    variable: str = Query(reports.TOTAL_VARIABLE, description="Estadio o '__total__'"),
):
    try:
        pdf = reports.render_evaluation_pdf(evaluation_id, variable)
    except LookupError as e:
        raise HTTPException(404, str(e))
    except ValueError as e:
        raise HTTPException(400, str(e))
    except Exception as e:  # noqa: BLE001
        raise HTTPException(500, f"Error generando PDF: {e}")
    return Response(
        content=pdf,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="evaluacion-{evaluation_id[:8]}.pdf"',
        },
    )


@router.get("/evaluation/{evaluation_id}.xlsx")
def get_evaluation_xlsx(
    evaluation_id: str,
    variable: str = Query(reports.TOTAL_VARIABLE, description="Estadio o '__total__'"),
):
    try:
        data = reports.render_evaluation_xlsx(evaluation_id, variable)
    except LookupError as e:
        raise HTTPException(404, str(e))
    except ValueError as e:
        raise HTTPException(400, str(e))
    except Exception as e:  # noqa: BLE001
        raise HTTPException(500, f"Error generando Excel: {e}")
    return Response(
        content=data,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={
            "Content-Disposition": f'attachment; filename="evaluacion-{evaluation_id[:8]}.xlsx"',
        },
    )
