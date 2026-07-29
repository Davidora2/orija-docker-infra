from __future__ import annotations

from pathlib import Path

from fastapi import FastAPI, Query, Request
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates

from . import __version__
from .config import get_settings
from .service import run_scan

BASE = Path(__file__).resolve().parent
templates = Jinja2Templates(directory=str(BASE / "templates"))

app = FastAPI(
    title="SEC Insider Scout",
    description="Rank public Form 4 insider filings and surface research trade ideas.",
    version=__version__,
)
app.mount("/static", StaticFiles(directory=str(BASE / "static")), name="static")


@app.get("/", response_class=HTMLResponse)
async def dashboard(
    request: Request,
    lookback_days: int = Query(default=14, ge=1, le=60),
    max_filings: int = Query(default=60, ge=10, le=100),
    refresh: bool = Query(default=False),
) -> HTMLResponse:
    error: str | None = None
    result = None
    try:
        result = await run_scan(
            lookback_days=lookback_days,
            max_filings=max_filings,
            force_refresh=refresh,
        )
    except Exception as exc:  # noqa: BLE001
        error = str(exc)
    return templates.TemplateResponse(
        request,
        "index.html",
        {
            "result": result,
            "error": error,
            "lookback_days": lookback_days,
            "max_filings": max_filings,
            "version": __version__,
        },
    )


@app.get("/api/scan")
async def api_scan(
    lookback_days: int = Query(default=14, ge=1, le=60),
    max_filings: int = Query(default=60, ge=10, le=100),
    min_buy_value: float = Query(default=25000, ge=0),
    refresh: bool = Query(default=False),
) -> JSONResponse:
    try:
        result = await run_scan(
            lookback_days=lookback_days,
            max_filings=max_filings,
            min_buy_value=min_buy_value,
            force_refresh=refresh,
        )
        return JSONResponse(result.model_dump(mode="json"))
    except Exception as exc:  # noqa: BLE001
        return JSONResponse({"error": str(exc)}, status_code=502)


@app.get("/api/health")
async def health() -> dict[str, str]:
    return {"status": "ok", "version": __version__}


def main() -> None:
    import uvicorn

    settings = get_settings()
    uvicorn.run(
        "sec_insider_scout.web:app",
        host=settings.host,
        port=settings.port,
        reload=False,
    )


if __name__ == "__main__":
    main()
