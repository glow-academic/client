# server/app/main.py
import contextlib
import logging
import platform
import sys
import time
from typing import Any, AsyncIterator, Generator

import socketio  # type: ignore
from app.db import get_session, init_db
from app.models import SimulationChats
from app.routes.assistants import get_socketio_app
from app.routes.assistants import router as assistants_router
from app.routes.documents import router as documents_router
from app.routes.evals import router as evals_router
from app.routes.profiles import router as profiles_router
from app.routes.scenarios import router as scenarios_router
from app.routes.simulations import router as simulations_router
from app.services.mcp.server import server
from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlmodel import Session, select


# Create a combined lifespan to manage both session managers
@contextlib.asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[Any]:
    async with contextlib.AsyncExitStack() as stack:
        await stack.enter_async_context(server.session_manager.run())
        yield


# Create FastAPI app with lifespan
fastapi_app = FastAPI(title="GLOW API", on_startup=[init_db], lifespan=lifespan)

# Add CORS middleware FIRST
fastapi_app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, replace with your frontend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
fastapi_app.include_router(documents_router, prefix="/documents")
fastapi_app.include_router(simulations_router, prefix="/simulations")
fastapi_app.include_router(profiles_router, prefix="/profiles")
fastapi_app.include_router(evals_router, prefix="/evals")
fastapi_app.include_router(scenarios_router, prefix="/scenarios")
fastapi_app.include_router(assistants_router, prefix="/assistants")

# mounting the mcp servers - ensure trailing slashes for proper routing
fastapi_app.mount("/domain", server.streamable_http_app(), name="MCP Server")

# Mount Socket.IO app AFTER everything else
sio_app = get_socketio_app()

# Create the combined ASGI app with Socket.IO
app = socketio.ASGIApp(sio_app, fastapi_app, socketio_path="socket.io")

# Configure logging - change this section
logging.basicConfig(
    level=logging.INFO,  # Change from DEBUG to INFO
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)

# Add specific logger for evaluation
eval_logger = logging.getLogger("app.agents.generic")
eval_logger.setLevel(logging.INFO)


@fastapi_app.get("/")
async def root_info() -> JSONResponse:
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


@fastapi_app.get("/health")
async def health_check() -> JSONResponse:
    """
    Simple health check endpoint.
    """
    return JSONResponse(content={"status": "ok"})


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


@fastapi_app.get("/db-test")
async def test_db_connection(session: Session = Depends(get_session)) -> JSONResponse:
    """Test database connection"""
    try:
        # Try a simple query
        session.exec(select(SimulationChats)).first()
        return JSONResponse(content={"status": "Database connection successful"})
    except Exception as e:
        logger.exception(f"Database connection error: {str(e)}")
        return JSONResponse(
            content={"status": "Database connection failed", "error": str(e)}
        )


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "app.main:app", host="0.0.0.0", port=8000, reload=True, log_level="info"
    )
