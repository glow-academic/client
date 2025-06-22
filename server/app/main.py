# server/app/main.py
import contextlib
import logging
import os
import platform
import sys
import time
from typing import Any, AsyncIterator, Generator

import socketio  # type: ignore
from app.db import get_session, init_db
from app.models import SimulationChats
from app.routes.assistants import router as assistants_router
from app.routes.documents import router as documents_router
from app.routes.evals import router as evals_router
from app.routes.profiles import router as profiles_router
from app.routes.scenarios import router as scenarios_router
from app.routes.simulations import router as simulations_router
from app.services.mcp.server import server
from dotenv import load_dotenv
from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlmodel import Session, select

load_dotenv()

# Get client URL from environment
client_url = os.getenv("CLIENT_URL")

# Store active chat connections
active_connections: dict[str, str] = {}

# Create Socket.IO server instance globally
sio = socketio.AsyncServer(
    cors_allowed_origins=[client_url],
    cors_credentials=True,
    logger=False,
    engineio_logger=False,
    async_mode='asgi'
)

@sio.event  # type: ignore
async def connect(sid: str, environ: Any, auth: Any) -> bool:
    """Handle WebSocket connection"""
    logger.info(f"Client connected: {sid}")
    return True

@sio.event  # type: ignore
async def disconnect(sid: str) -> None:
    """Handle WebSocket disconnection"""
    logger.info(f"Client disconnected: {sid}")
    # Remove from active connections
    for chat_id, connection_sid in list(active_connections.items()):
        if connection_sid == sid:
            del active_connections[chat_id]
            break

@sio.event  # type: ignore
async def join_chat(sid: str, data: dict[str, Any]) -> None:
    """Join a specific chat room for real-time updates"""
    chat_id = data.get('chat_id')
    chat_type = data.get('chat_type', 'assistant')  # Default to assistant for backward compatibility
    
    if chat_id:
        room_name = f"{chat_type}_{chat_id}"
        await sio.enter_room(sid, room_name)
        active_connections[chat_id] = sid
        logger.info(f"Client {sid} joined {chat_type} chat {chat_id}")
        await sio.emit('joined_chat', {'chat_id': chat_id, 'chat_type': chat_type}, room=sid)

@sio.event  # type: ignore
async def leave_chat(sid: str, data: dict[str, Any]) -> None:
    """Leave a specific chat room"""
    chat_id = data.get('chat_id')
    chat_type = data.get('chat_type', 'assistant')  # Default to assistant for backward compatibility
    
    if chat_id:
        room_name = f"{chat_type}_{chat_id}"
        await sio.leave_room(sid, room_name)
        if chat_id in active_connections:
            del active_connections[chat_id]
        logger.info(f"Client {sid} left {chat_type} chat {chat_id}")

def get_socketio_instance() -> socketio.AsyncServer:
    """Get the global Socket.IO server instance"""
    return sio

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

# Create the combined ASGI app with Socket.IO
app = socketio.ASGIApp(sio, fastapi_app, socketio_path="socket.io")

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
