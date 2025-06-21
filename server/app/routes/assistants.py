# app/routes/assistants.py
# Assistant chat endpoints with streaming response functionality
import asyncio
import json
import logging
import uuid
from datetime import timezone
from typing import AsyncGenerator, Optional

from app.db import get_session
from app.models import AssistantChats, AssistantMessages
from app.utils.assistants import generate_assistant_response
from fastapi import APIRouter, Depends, Form, HTTPException
from fastapi.responses import JSONResponse, StreamingResponse
from sqlalchemy.exc import SQLAlchemyError
from sqlmodel import Session

logger = logging.getLogger(__name__)

router = APIRouter()

# Import your database models here - adjust these imports based on your actual models
# from app.models import AssistantChat, AssistantMessage

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
        
        # Create the chat record (adjust based on your actual model)
        new_chat = AssistantChats(
            title=chat_title,
            profile_id=profile_id
        )
        session.add(new_chat)
        session.commit()

        # call the message endpoint below, do not await it.
        asyncio.create_task(message(
            chat_id=new_chat.id,
            message=initial_message,
            session=session
        ))
        
        # 3. Return the chat id to the frontend to track websocket connection
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
) -> StreamingResponse:
    """
    Streams assistant tokens back to the frontend via Server-Sent Events.
    """
    try:
        # 1. Verify the chat exists
        chat = session.get(AssistantChats, chat_id)
        if not chat:
            raise HTTPException(status_code=404, detail="Chat not found")
        
        # 2. Add the user message to the chat
        user_message = AssistantMessages(
            chat_id=chat_id,
            role="user",
            content=message,
            completed=True
        )
        session.add(user_message)
        session.commit()
        
        # 3. Create placeholder assistant message
        assistant_message = AssistantMessages(
            chat_id=chat_id,
            role="assistant",
            content="",
            completed=False
        )
        session.add(assistant_message)
        session.commit()

        logger.info(f"Processing message for chat {chat_id}")

        async def stream_response() -> AsyncGenerator[str, None]:
            """Generate Server-Sent Events stream"""
            try:
                # Send initial connection confirmation
                yield f"data: {json.dumps({'type': 'start', 'message_id': assistant_message.id})}\n\n"
                
                # Stream the assistant response
                accumulated_content = ""
                async for token in generate_assistant_response(message):
                    accumulated_content += token
                    
                    # Send each token as a streaming update
                    yield f"data: {json.dumps({'text': token, 'accumulated': accumulated_content})}\n\n"
                    
                    # Update the database with accumulated content
                    assistant_message.content = accumulated_content
                    session.add(assistant_message)
                    session.commit()
                
                # Mark as completed
                assistant_message.completed = True
                session.add(assistant_message)
                session.commit()
                
                # Send completion signal
                yield f"data: {json.dumps({'done': True, 'final_content': accumulated_content})}\n\n"
                
            except Exception as e:
                logger.error(f"Error in stream_response: {str(e)}")
                yield f"data: {json.dumps({'error': str(e)})}\n\n"

        return StreamingResponse(
            stream_response(),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
                "Access-Control-Allow-Headers": "Content-Type",
            }
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in message endpoint: {str(e)}")
        raise HTTPException(
            status_code=500, detail=f"Failed to process message: {str(e)}"
        )