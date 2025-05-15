# app/routes/chat.py
from fastapi import APIRouter, Form, HTTPException, Depends
from app.models import Chats, Messages # Added Messages
from app.db import get_session
from app.agents.selector import generate_scenario # Import generate_scenario
from sqlmodel import Session # Import Session
import logging # Import logging

logger = logging.getLogger(__name__) # Initialize logger

router = APIRouter()

@router.post("/new")
async def new_chat(profile: str = Form(...), user_id: str = Form(...), session: Session = Depends(get_session)): # Added session dependency
    """
    This endpoint is used to create a new chat.
    """
    # call the agents sdk to come up with a scenario description
    scenario = await generate_scenario(profile=profile, chat_id="new_chat_placeholder") # chat_id can be refined if needed before chat obj creation

    # create a new chat
    # Ensure the profile value is one of the Enum values if your DB enforces it strictly.
    # For now, assuming the string matches.
    chat = Chats(
        profile=profile, 
        user_id=user_id, 
        scenario_description=scenario,
        title=f"Chat with {profile} agent" # Added a title
    )

    # save the chat to the database
    # session = get_session() # get_session is a generator, use Depends
    session.add(chat)
    session.commit()
    session.refresh(chat) # Refresh to get DB generated values like ID

    logger.info(f"New chat created with ID: {chat.id} for profile: {profile}")
    return chat.id


@router.get("/end")
async def end_chat(chat_id: str, session: Session = Depends(get_session)): # Added session dependency
    """
    This endpoint is used to end a chat.
    """
    # session = get_session() # Use Depends
    # call the agents sdk to come up with a rubric
    chat = session.get(Chats, chat_id) # Use session.get for primary key lookup
    if not chat:
        logger.error(f"Chat not found with ID: {chat_id} for ending.")
        raise HTTPException(status_code=404, detail="Chat not found")
    chat.completed = True
    session.add(chat)
    session.commit()
    logger.info(f"Chat ended with ID: {chat_id}")
    return {"message": "Chat ended"}


@router.post("/message")
async def message(chat_id: str = Form(...), message: str = Form(...), session: Session = Depends(get_session)): # Changed to Form and added session
    """
    This endpoint is used to send a message to the chat.
    This will store the user's message but not get an agent response here.
    Agent responses are handled by /chat in main.py.
    """
    # session = get_session() # Use Depends
    chat = session.get(Chats, chat_id) # Use session.get
    if not chat:
        logger.error(f"Chat not found with ID: {chat_id} for sending message.")
        raise HTTPException(status_code=404, detail="Chat not found")

    # Create a Messages object for the user's query
    db_message = Messages(
        chat_id=chat.id,
        query=message,
        response="", # Agent response will be filled by the /chat endpoint logic
        completed=False # Mark as not completed until agent responds
    )
    session.add(db_message)
    session.commit()
    session.refresh(db_message)
    logger.info(f"Message stored with ID: {db_message.id} for chat ID: {chat_id}")
    return {"message_id": db_message.id, "status": "Message received, awaiting agent response via /chat endpoint."}

