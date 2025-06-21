# app/routes/assistants.py
# Assistant chat endpoints with WebSocket streaming functionality
import asyncio
import json
import logging
import uuid
from datetime import timezone
from typing import Any, AsyncGenerator, Dict, Optional

import socketio  # type: ignore
from app.db import get_session
from app.models import AssistantChats, AssistantMessages
from app.utils.assistants import generate_assistant_response
from fastapi import APIRouter, Depends, Form, HTTPException
from fastapi.responses import JSONResponse
from sqlalchemy.exc import SQLAlchemyError
from sqlmodel import Session

logger = logging.getLogger(__name__)

router = APIRouter()

# Create Socket.IO server instance
sio = socketio.AsyncServer(
    cors_allowed_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    cors_credentials=True,
    logger=False,
    engineio_logger=False,
    async_mode='asgi'
)

# Store active chat connections
active_connections: Dict[str, str] = {}

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
async def join_chat(sid: str, data: Dict[str, Any]) -> None:
    """Join a specific chat room for real-time updates"""
    chat_id = data.get('chat_id')
    if chat_id:
        await sio.enter_room(sid, f"chat_{chat_id}")
        active_connections[chat_id] = sid
        logger.info(f"Client {sid} joined chat {chat_id}")
        await sio.emit('joined_chat', {'chat_id': chat_id}, room=sid)

@sio.event  # type: ignore
async def leave_chat(sid: str, data: Dict[str, Any]) -> None:
    """Leave a specific chat room"""
    chat_id = data.get('chat_id')
    if chat_id:
        await sio.leave_room(sid, f"chat_{chat_id}")
        if chat_id in active_connections:
            del active_connections[chat_id]
        logger.info(f"Client {sid} left chat {chat_id}")

@router.post("/start")
async def start_chat(
    initial_message: str = Form(...),
    profile_id: uuid.UUID = Form(...),
    session: Session = Depends(get_session),
) -> JSONResponse:
    """
    This endpoint creates a new chat based on a profile.
    """
    try:
        # 1. Create a new chat, based off the first message
        chat_title = (initial_message[:50] + "..." if len(initial_message) > 50 else initial_message) + " Chat"
        
        # Create the chat record
        new_chat = AssistantChats(
            title=chat_title,
            profile_id=profile_id
        )
        session.add(new_chat)
        session.commit()
        session.refresh(new_chat)

        # 2. Process the initial message via WebSocket
        asyncio.create_task(process_message_websocket(
            chat_id=str(new_chat.id),
            message=initial_message,
            session=None  # We create our own session in the function
        ))
        
        # 3. Return the chat id to the frontend
        return JSONResponse({
            "chat_id": str(new_chat.id),
            "message": "Chat started successfully"
        })

    except SQLAlchemyError as e:
        session.rollback()
        logger.error(f"Database error starting chat: {str(e)}")
        raise HTTPException(
            status_code=500, detail=f"Database error: {str(e)}"
        )
    except Exception as e:
        session.rollback()
        logger.error(f"Error starting chat: {str(e)}")
        raise HTTPException(
            status_code=500, detail=f"Failed to start chat: {str(e)}"
        )

@router.post("/message")
async def message(
    chat_id: uuid.UUID = Form(...),
    message: str = Form(...),
    session: Session = Depends(get_session),
) -> JSONResponse:
    """
    Process a message and stream response via WebSocket.
    """
    try:
        # 1. Verify the chat exists
        chat = session.get(AssistantChats, chat_id)
        if not chat:
            raise HTTPException(status_code=404, detail="Chat not found")
        
        # 2. Process the message via WebSocket
        asyncio.create_task(process_message_websocket(
            chat_id=str(chat_id),
            message=message,
            session=None  # We create our own session in the function
        ))
        
        return JSONResponse({
            "status": "processing",
            "message": "Message is being processed"
        })
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in message endpoint: {str(e)}")
        raise HTTPException(
            status_code=500, detail=f"Failed to process message: {str(e)}"
        )

async def process_message_websocket(chat_id: str, message: str, session: Optional[Session] = None) -> None:
    """
    Process a message and stream the response via WebSocket
    """
    # Create a new session for this async operation
    from app.db import get_session
    db_session = next(get_session())
    
    try:
        chat_uuid = uuid.UUID(chat_id)
        
        # 1. Add the user message to the chat
        user_message = AssistantMessages(
            chat_id=chat_uuid,
            role="user",
            content=message,
            completed=True
        )
        db_session.add(user_message)
        db_session.commit()
        db_session.refresh(user_message)
        
        # 2. Emit user message to connected clients
        await sio.emit('new_message', {
            'message_id': str(user_message.id),
            'chat_id': chat_id,
            'role': 'user',
            'content': message,
            'completed': True,
            'created_at': user_message.created_at.isoformat()
        }, room=f"chat_{chat_id}")
        
        # 3. Create placeholder assistant message
        assistant_message = AssistantMessages(
            chat_id=chat_uuid,
            role="assistant",
            content="",
            completed=False
        )
        db_session.add(assistant_message)
        db_session.commit()
        db_session.refresh(assistant_message)
        
        # 4. Emit placeholder assistant message
        await sio.emit('new_message', {
            'message_id': str(assistant_message.id),
            'chat_id': chat_id,
            'role': 'assistant',
            'content': '',
            'completed': False,
            'created_at': assistant_message.created_at.isoformat()
        }, room=f"chat_{chat_id}")

        logger.info(f"Processing message for chat {chat_id}")

        # 5. Stream the assistant response
        accumulated_content = ""
        async for token in generate_assistant_response(message):
            accumulated_content += token
            
            # Update the database with accumulated content
            assistant_message.content = accumulated_content
            db_session.add(assistant_message)
            db_session.commit()
            
            # Emit token update to connected clients
            await sio.emit('message_token', {
                'message_id': str(assistant_message.id),
                'chat_id': chat_id,
                'token': token,
                'accumulated_content': accumulated_content
            }, room=f"chat_{chat_id}")
        
        # 6. Mark as completed
        assistant_message.completed = True
        db_session.add(assistant_message)
        db_session.commit()
        
        # 7. Emit completion signal
        await sio.emit('message_complete', {
            'message_id': str(assistant_message.id),
            'chat_id': chat_id,
            'final_content': accumulated_content
        }, room=f"chat_{chat_id}")
        
    except Exception as e:
        logger.error(f"Error in process_message_websocket: {str(e)}")
        await sio.emit('message_error', {
            'chat_id': chat_id,
            'error': str(e)
        }, room=f"chat_{chat_id}")
    finally:
        db_session.close()

# Export the Socket.IO app for mounting
def get_socketio_app() -> socketio.AsyncServer:
    return sio