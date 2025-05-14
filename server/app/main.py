# server/app/main.py
import platform
import sys
import time
import json
from typing import Generator, Optional
from uuid import UUID
import logging

from fastapi import FastAPI, Form, Response, Depends, HTTPException
from fastapi.responses import JSONResponse, StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlmodel import Session, select

from app.db import init_db, get_session
from app.models import Chat, Message

app = FastAPI(title="GLOW Chat API", on_startup=[init_db])

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, replace with your frontend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

class ChatRequest(BaseModel):
    message: str
    chat_id: UUID

class ChatResponse(BaseModel):
    chat_id: str
    response: str

@app.get("/")
async def root_info():
    """
    Return general server information.
    """
    info = {
        "python_version": sys.version.split()[0],
        "platform": platform.system(),
        "platform_release": platform.release(),
        "fastapi_version": getattr(sys.modules.get("fastapi"), "__version__", "unknown"),
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

@app.post("/chat")
async def chat_endpoint(
    message: str = Form(...),
    chat_id: str = Form(...),
    session: Session = Depends(get_session),
):
    """
    Chat endpoint that streams a response back to the client.
    """
    try:
        # Check if chat exists
        logger.debug(f"Looking for chat with ID: {chat_id}")
        chat = session.exec(select(Chat).where(Chat.id == chat_id)).first()
        if not chat:
            logger.error(f"Chat not found with ID: {chat_id}")
            raise HTTPException(status_code=404, detail="Chat not found")
        
        # For non-streaming response:
        logger.debug(f"Generating response for message: {message}")
        full_response = f"Echo: {message}"
        
        # Create a new message in the database
        logger.debug("Saving message to database")
        db_message = Message(
            query=message,
            response=full_response,
            completed=True,
            chat_id=chat_id
        )
        session.add(db_message)
        session.commit()
        session.refresh(db_message)
        
        # Return the response
        logger.debug("Returning response")
        return ChatResponse(chat_id=chat_id, response=full_response)
        
        # For streaming response (commented out for now):
        # def stream_and_save():
        #     response_text = ""
        #     for chunk in fake_chat_stream(message):
        #         chunk_str = chunk.decode("utf-8")
        #         response_text += chunk_str
        #         yield chunk
        #     
        #     # Save the complete response to the database
        #     db_message = Message(
        #         query=message,
        #         response=response_text.strip(),
        #         completed=True,
        #         chat_id=chat_id
        #     )
        #     session.add(db_message)
        #     session.commit()
        
        # return StreamingResponse(
        #     stream_and_save(),
        #     media_type="text/plain",
        #     headers={"X-Chat-ID": chat_id},
        # )
    
    except Exception as e:
        logger.exception(f"Error in chat endpoint: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error processing chat: {str(e)}")

@app.get("/db-test")
async def test_db_connection(session: Session = Depends(get_session)):
    """Test database connection"""
    try:
        # Try a simple query
        result = session.exec(select(Chat)).first()
        return {"status": "Database connection successful"}
    except Exception as e:
        logger.exception(f"Database connection error: {str(e)}")
        return {"status": "Database connection failed", "error": str(e)}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
