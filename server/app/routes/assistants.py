# app/routes/assistants.py (OLD)
# Assistant chat endpoints with WebSocket streaming functionality
import asyncio
import json
import logging
import uuid
import warnings
from datetime import timezone
from typing import Dict, Optional

from agents import gen_trace_id

# Suppress Pydantic serialization warnings from OpenAI SDK
warnings.filterwarnings("ignore", message="Pydantic serializer warnings")
warnings.filterwarnings("ignore", category=UserWarning, module="pydantic")

import socketio  # type: ignore
from app.db import get_session
from app.models import AssistantChats, AssistantMessages, AssistantToolCalls
from app.services.agents.collection.assistant import (cancel_assistant_run,
                                                      run_assistant_agent)
from app.services.agents.collection.title import run_title_agent
from fastapi import APIRouter, Depends, Form, HTTPException
from fastapi.responses import JSONResponse
from sqlalchemy.exc import SQLAlchemyError
from sqlmodel import Session, select

logger = logging.getLogger(__name__)

router = APIRouter()

# Store active chat connections
active_connections: Dict[str, str] = {}

def get_sio_instance() -> socketio.AsyncServer:
    """Get the Socket.IO server instance from main.py"""
    from app.main import get_socketio_instance
    return get_socketio_instance()

@router.post("/stop")
async def stop_assistant_run(
    chat_id: uuid.UUID = Form(...),
    session: Session = Depends(get_session),
) -> JSONResponse:
    """
    Stop an active assistant run.
    """
    try:
        # Verify the chat exists
        chat = session.exec(
            select(AssistantChats).where(AssistantChats.id == chat_id)
        ).one_or_none()
        if not chat:
            raise HTTPException(status_code=404, detail="Chat not found")
        
        # Attempt to cancel the assistant run
        success = cancel_assistant_run(chat_id)
        
        if success:
            logger.info(f"Successfully cancelled assistant run for chat {chat_id}")
            
            # Emit stop signal via WebSocket using unified function
            from app.main import emit_chat_stopped
            await emit_chat_stopped(str(chat_id), "assistant", "Assistant run cancelled successfully")
            
            return JSONResponse({
                "success": True,
                "message": "Assistant run cancelled successfully"
            })
        else:
            logger.warning(f"No active assistant run found for chat {chat_id}")
            return JSONResponse(
                status_code=404,
                content={
                    "success": False,
                    "message": "No active assistant run found"
                }
            )
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error stopping assistant: {str(e)}")
        raise HTTPException(
            status_code=500, detail=f"Failed to stop assistant: {str(e)}"
        )

@router.post("/start")
async def start_chat(
    initial_message: str = Form(...),
    chat_id: uuid.UUID = Form(...),
    session: Session = Depends(get_session),
) -> JSONResponse:
    """
    This endpoint creates a new chat based on a profile.
    """
    try:
        # 0. Generate a trace id for the chat and refresh the chat
        trace_id = gen_trace_id()
        chat = session.get(AssistantChats, chat_id)
        if not chat:
            raise HTTPException(status_code=404, detail="Chat not found")
        chat.trace_id = trace_id
        session.add(chat)
        session.commit()
        session.refresh(chat)

        # 1. Process the initial message via WebSocket
        asyncio.create_task(process_message_websocket(
            chat_id=chat_id,
            message=initial_message,
            session=None  # We create our own session in the function
        ))

        # 2. Update the title with the title agent
        chat_title = await run_title_agent(chat_id, initial_message, session)
        logger.info(f"Chat title: {chat_title}")

        # 3. Emit title update to connected clients
        sio_instance = get_sio_instance()
        await sio_instance.emit('title_updated', {
            'chat_id': str(chat_id),
            'title': chat_title
        }, room=f"assistant_{chat_id}")
        
        # 4. Return the chat id to the frontend
        return JSONResponse({
            "chat_id": str(chat_id),
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
            chat_id=chat_id,
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

async def process_message_websocket(chat_id: uuid.UUID, message: str, session: Optional[Session] = None) -> None:
    """
    Process a message and stream the response via WebSocket
    """
    
    # Create a new session for this async operation
    from app.db import get_session
    db_session = next(get_session())
    
    try:
        
        # 1. Add the user message to the chat
        user_message = AssistantMessages(
            chat_id=chat_id,
            role="user",
            content=message,
            completed=True
        )
        db_session.add(user_message)
        db_session.commit()
        db_session.refresh(user_message)
        
        # 2. Emit user message to connected clients
        sio_instance = get_sio_instance()
        await sio_instance.emit('new_message', {
            'message_id': str(user_message.id),
            'chat_id': str(chat_id),
            'role': 'user',
            'content': message,
            'completed': True,
            'created_at': user_message.created_at.isoformat()
        }, room=f"assistant_{chat_id}")
        
        logger.info(f"Processing message for chat {chat_id}")

        # 3. Stream the assistant response
        accumulated_content = ""
        cancelled = False
        active_tool_calls = {}  # Track tool calls by ID
        current_message = None  # Track current message for splitting - create only when needed
        
        try:
            async for token in run_assistant_agent(chat_id, db_session):
                logger.info(f"Received token: '{token}' (type: {type(token)}, length: {len(token) if isinstance(token, str) else 'N/A'})")
                
                # Check if this is a tool call token
                if token.startswith('<tool_call_start>') and token.endswith('</tool_call_start>'):
                    logger.info(f"Received tool call start token: {token}")
                    
                    # If we have accumulated content, complete the current message and create a new one
                    if accumulated_content.strip() and current_message:
                        # Complete current message
                        current_message.content = accumulated_content
                        current_message.completed = True
                        db_session.add(current_message)
                        db_session.commit()
                        
                        # Emit completion for current message
                        await sio_instance.emit('message_complete', {
                            'message_id': str(current_message.id),
                            'chat_id': str(chat_id),
                            'final_content': accumulated_content
                        }, room=f"assistant_{chat_id}")
                        
                        # Reset accumulated content
                        accumulated_content = ""
                        current_message = None
                    
                    # Don't create a message just for tool calls - they can exist independently
                    # Only create messages when we have actual content
                    
                    # Extract tool call data
                    tool_call_json = token.replace('<tool_call_start>', '').replace('</tool_call_start>', '')
                    try:
                        tool_call_data = json.loads(tool_call_json)
                        
                        # Determine tool type based on tool name
                        tool_name = tool_call_data.get('name', 'unknown')
                        tool_type = 'read'  # Default to read
                        
                        # Map tool names to types based on their operation
                        if any(keyword in tool_name.lower() for keyword in ['create', 'add', 'insert', 'new']):
                            tool_type = 'create'
                        elif any(keyword in tool_name.lower() for keyword in ['update', 'edit', 'modify', 'change']):
                            tool_type = 'update'
                        elif any(keyword in tool_name.lower() for keyword in ['delete', 'remove', 'drop']):
                            tool_type = 'delete'
                        # Otherwise defaults to 'read' for find, get, list, etc.
                        
                        # Save tool call to database (without associating to a message)
                        tool_call = AssistantToolCalls(
                            chat_id=chat_id,
                            tool_name=tool_name,
                            tool_type=tool_type,
                            tool_arguments=tool_call_data.get('arguments', {}),
                            tool_result={},  # Will be updated when result comes in
                            completed=False  # Mark as incomplete initially
                        )
                        
                        try:
                            db_session.add(tool_call)
                            db_session.commit()
                            db_session.refresh(tool_call)
                            logger.info(f"Successfully created tool call record: {tool_call.id}")
                        except Exception as db_error:
                            logger.error(f"Failed to create tool call record: {db_error}")
                            db_session.rollback()
                            continue
                        
                        # Store the tool call for later result matching
                        tool_call_id = tool_call_data.get('id')
                        if tool_call_id:
                            active_tool_calls[tool_call_id] = tool_call
                        
                        # Emit tool call created event (frontend will refetch tool calls)
                        await sio_instance.emit('tool_call_created', {
                            'tool_call_id': str(tool_call.id),
                            'chat_id': str(chat_id),
                            'tool_name': tool_name,
                            'tool_type': tool_type
                        }, room=f"assistant_{chat_id}")
                        
                    except json.JSONDecodeError:
                        logger.error(f"Failed to parse tool call JSON: {tool_call_json}")
                    
                elif token.startswith('<tool_call_result>') and token.endswith('</tool_call_result>'):
                    logger.info(f"Received tool call result token: {token}")
                    # Extract tool call result data
                    tool_result_json = token.replace('<tool_call_result>', '').replace('</tool_call_result>', '')
                    try:
                        tool_result_data = json.loads(tool_result_json)
                        tool_call_id = tool_result_data.get('id')
                        
                        # Update the corresponding tool call record with the result
                        tool_call_record = None
                        if tool_call_id and tool_call_id in active_tool_calls:
                            tool_call_record = active_tool_calls[tool_call_id]
                            tool_call_record.tool_result = tool_result_data.get('result', {})
                            tool_call_record.completed = True
                            
                            try:
                                db_session.add(tool_call_record)
                                db_session.commit()
                                logger.info(f"Successfully updated tool call record {tool_call_record.id} with result")
                            except Exception as db_error:
                                logger.error(f"Failed to update tool call record: {db_error}")
                                db_session.rollback()
                            
                            # Remove from active tracking
                            del active_tool_calls[tool_call_id]
                        
                        # Emit tool call completed event (frontend will refetch tool calls)
                        await sio_instance.emit('tool_call_completed', {
                            'tool_call_id': str(tool_call_record.id) if tool_call_record else None,
                            'chat_id': str(chat_id),
                            'tool_name': tool_result_data.get('name')
                        }, room=f"assistant_{chat_id}")
                        
                    except json.JSONDecodeError:
                        logger.error(f"Failed to parse tool result JSON: {tool_result_json}")
                    
                else:
                    # Regular content token
                    accumulated_content += token
                    
                    # Create assistant message if we don't have one yet
                    if not current_message:
                        current_message = AssistantMessages(
                            chat_id=chat_id,
                            role="assistant",
                            content="",
                            completed=False
                        )
                        db_session.add(current_message)
                        db_session.commit()
                        db_session.refresh(current_message)
                        
                        # Emit new placeholder message
                        await sio_instance.emit('new_message', {
                            'message_id': str(current_message.id),
                            'chat_id': str(chat_id),
                            'role': 'assistant',
                            'content': '',
                            'completed': False,
                            'created_at': current_message.created_at.isoformat()
                        }, room=f"assistant_{chat_id}")
                    
                    # Update the database with accumulated content
                    current_message.content = accumulated_content
                    db_session.add(current_message)
                    db_session.commit()
                    
                    # Emit token update to connected clients
                    await sio_instance.emit('message_token', {
                        'message_id': str(current_message.id),
                        'chat_id': str(chat_id),
                        'token': token,
                        'accumulated_content': accumulated_content
                    }, room=f"assistant_{chat_id}")
        except Exception as e:
            if "cancelled" in str(e).lower() or "canceled" in str(e).lower():
                # Handle cancellation gracefully
                cancelled = True
                logger.info(f"Assistant run for chat {chat_id} was cancelled")
                
                # Emit cancellation signal (if we have a message)
                if current_message:
                    await sio_instance.emit('message_cancelled', {
                        'message_id': str(current_message.id),
                        'chat_id': str(chat_id),
                        'final_content': accumulated_content
                    }, room=f"assistant_{chat_id}")
            else:
                # Re-raise other exceptions
                raise e
        
        # 6. Mark current message as completed (if we have one)
        if current_message:
            current_message.completed = True
            db_session.add(current_message)
            db_session.commit()
            
            # 7. Emit completion signal (only if not cancelled)
            if not cancelled:
                await sio_instance.emit('message_complete', {
                    'message_id': str(current_message.id),
                    'chat_id': str(chat_id),
                    'final_content': accumulated_content
                }, room=f"assistant_{chat_id}")
        
    except Exception as e:
        logger.error(f"Error in process_message_websocket: {str(e)}")
        sio_instance = get_sio_instance()
        await sio_instance.emit('message_error', {
            'chat_id': str(chat_id),
            'error': str(e)
        }, room=f"assistant_{chat_id}")
    finally:
        db_session.close()