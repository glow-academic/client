# server/app/main.py
import platform
import sys
import time
from typing import Generator
import logging

from fastapi import FastAPI, Depends
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from sqlmodel import Session, select
from app.models import SimulationChats
from app.routes.documents import router as documents_router
from app.routes.users import router as users_router
from app.routes.scenarios import router as scenarios_router
from app.routes.simulations import router as simulations_router
from app.routes.evals import router as evals_router
from app.db import init_db, get_session

app = FastAPI(title="GLOW API", on_startup=[init_db])
app.include_router(documents_router, prefix="/documents")
app.include_router(simulations_router, prefix="/simulations")
app.include_router(users_router, prefix="/users")
app.include_router(evals_router, prefix="/evals")
app.include_router(scenarios_router, prefix="/scenarios")

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, replace with your frontend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging - change this section
logging.basicConfig(
    level=logging.INFO,  # Change from DEBUG to INFO
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)

# Add specific logger for evaluation
eval_logger = logging.getLogger("app.agents.generic")
eval_logger.setLevel(logging.INFO)


@app.get("/")
async def root_info():
    """
    Return general server information.
    """
    info = {
        "python_version": sys.version.split()[0],
        "platform": platform.system(),
        "platform_release": platform.release(),
        "fastapi_version": getattr(
            sys.modules.get("fastapi"), "__version__", "unknown"
        ),
    }
    return JSONResponse(content={"server_info": info})


@app.get("/health")
async def health_check():
    """
    Simple health check endpoint.
    """
    return {"status": "ok"}


def fake_chat_stream(user_message: str) -> Generator[bytes, None, None]:
    """
    Simulate streaming a chat response back in chunks.
    """
    # A very simple echo + delay demo
    words = f"Echo: {user_message}".split()
    for word in words:
        yield (word + " ").encode("utf-8")
        time.sleep(0.3)
    # indicate end of stream
    yield b""


@app.get("/db-test")
async def test_db_connection(session: Session = Depends(get_session)):
    """Test database connection"""
    try:
        # Try a simple query
        session.exec(select(SimulationChats)).first()
        return {"status": "Database connection successful"}
    except Exception as e:
        logger.exception(f"Database connection error: {str(e)}")
        return {"status": "Database connection failed", "error": str(e)}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "app.main:app", host="0.0.0.0", port=8000, reload=True, log_level="info"
    )
