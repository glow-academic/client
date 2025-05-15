# app/routes/chat.py
from fastapi import APIRouter, Form, HTTPException, Depends
from app.models import Chats, Messages # Added Messages
from app.db import get_session
from app.agents.selector import generate_scenario # Import generate_scenario
from sqlmodel import Session # Import Session
import logging # Import logging
from app.agents.selector import get_agent_response  # Import the agent selector
from pydantic import BaseModel
from uuid import UUID
from sqlmodel import Session, select


logger = logging.getLogger(__name__) # Initialize logger

router = APIRouter()
class ChatRequest(BaseModel):
    message: str
    chat_id: UUID


class ChatResponse(BaseModel):
    chat_id: str
    response: str


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
    Chat endpoint that streams a response back to the client.
    """
    try:
        # Check if chat exists
        logger.debug(f"Looking for chat with ID: {chat_id}")
        chat = session.get(Chats, chat_id)  # Use session.get for primary key lookup
        if not chat:
            logger.error(f"Chat not found with ID: {chat_id}")
            raise HTTPException(status_code=404, detail="Chat not found")

        # Get the profile from the chat
        profile = chat.profile
        if not profile:
            logger.error(f"Chat with ID: {chat_id} has no profile.")
            raise HTTPException(status_code=500, detail="Chat profile not set.")

        logger.debug(f"Generating response for message: '{message}' using profile: {profile}")

        # Fetch prior messages for full context
        history_msgs = session.exec(
            select(Messages).where(Messages.chat_id == chat.id)
        ).all()
        history_parts = []
        for m in history_msgs:
            # include only completed exchanges
            if m.response:
                history_parts.append(f"User: {m.query}")
                history_parts.append(f"Assistant: {m.response}")
        history_str = "\n".join(history_parts)
        # build the new input as full conversation + the latest user turn
        combined_input = history_str + f"\nUser: {message}\nAssistant:"

        full_response = ""
        # Call the agent selector to get the response
        async for chunk in get_agent_response(
            profile=profile, 
            chat_id=str(chat.id), 
            input_text=combined_input
        ):
            full_response += chunk

        logger.debug(f"Full response from agent: {full_response}")

        # Create a new message in the database for both query and response
        logger.debug("Saving message and response to database")
        db_message = Messages(
            query=message,
            response=full_response,
            completed=True,
            chat_id=chat.id
        )
        session.add(db_message)
        session.commit()
        session.refresh(db_message)

        # Return the response
        logger.debug("Returning agent response")
        return ChatResponse(chat_id=str(chat.id), response=full_response)

        # For streaming response (commented out for now):
        # async def stream_and_save():
        #     response_text = ""
        #     async for chunk in get_agent_response(profile=profile, chat_id=str(chat.id), input_text=message):
        #         response_text += chunk
        #         yield chunk.encode('utf-8') # Assuming chunks are strings
        #
        #     # Save the complete response to the database
        #     db_message = Messages(
        #         query=message,
        #         response=response_text.strip(),
        #         completed=True,
        #         chat_id=chat.id
        #     )
        #     session.add(db_message)
        #     session.commit()
        #
        # return StreamingResponse(
        #     stream_and_save(),
        #     media_type="text/plain",
        #     headers={"X-Chat-ID": str(chat.id)},
        # )

    except HTTPException as http_exc:
        logger.error(f"HTTP exception in chat endpoint: {http_exc.detail}")
        raise http_exc
    except Exception as e:
        logger.exception(f"Error in chat endpoint: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error processing chat: {str(e)}")

