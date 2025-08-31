from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import logging
from contextlib import asynccontextmanager
import platform
import asyncio

from ..config import LOG_DIR
from ..utils.logging_utils import setup_daily_rotating_logger

from .routers import (
    prices_router,
    flows_router,
    tickers_router,
    info_router,
    name_router,
    stats_router,
    funds_flow_router,
    rrg_router,
    logo_router,
)


if platform.system() == "Windows":
    try:
        asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())
    except Exception:
        pass

_app_logger = setup_daily_rotating_logger("api", LOG_DIR)
_app_logger.info("Starting FastAPI application")

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger = logging.getLogger("api")
    logger.info("App startup: setting up routes and middleware")
    logger.info("Routes registered: /, /health, /prices, /flows, /tickers, /info, /name, /stats, /funds_flow, /rrg, /logo")
    try:
        yield
    finally:
        logging.getLogger("api").info("App shutdown")

app = FastAPI(title="Quant API", version="0.1.0", lifespan=lifespan)

# CORS para permitir o frontend React/Streamlit em dev
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def read_root():
    logging.getLogger("api").info("GET /")
    return {"message": "Financial Data API"}

@app.get("/health")
def health():
    logging.getLogger("api").info("GET /health")
    return {"status": "ok"}


app.include_router(prices_router, prefix="/prices", tags=["prices"])
app.include_router(flows_router, prefix="/flows", tags=["flows"])
app.include_router(tickers_router, prefix="/tickers", tags=["tickers"])
app.include_router(info_router, prefix="/info", tags=["info"])
app.include_router(name_router, prefix="/name", tags=["name"])
app.include_router(stats_router, prefix="/stats", tags=["stats"])
app.include_router(funds_flow_router, tags=["funds_flow"])
app.include_router(logo_router, prefix="/logo", tags=["logo"])
app.include_router(rrg_router, prefix="/rrg", tags=["rrg"])

