# app/routes/chat.py
from fastapi import APIRouter, Form
from app.models import Chats
from app.db import get_session


router = APIRouter()

@router.post("/new")
async def new_chat(profile: str = Form(...), user_id: str = Form(...)):
    """
    This endpoint is used to create a new chat.
    """
    # call the agents sdk to come up with a scenario description

    # create a new chat
    chat = Chats(profile=profile, user_id=user_id)

    # save the chat to the database
    session = get_session()
    session.add(chat)
    session.commit()

    return chat.id


@router.get("/end")
async def end_chat(chat_id: str):
    """
    This endpoint is used to end a chat.
    """
    session = get_session()
    # call the agents sdk to come up with a rubric
    chat = session.query(Chats).filter(Chats.id == chat_id).first()
    chat.completed = True
    session.commit()
    return {"message": "Chat ended"}


@router.post("/message")
async def message(chat_id: str, message: str):
    """
    This endpoint is used to send a message to the chat.
    """
    session = get_session()
    chat = session.query(Chats).filter(Chats.id == chat_id).first()
    # call the agents sdk to come up with a response
    response = chat.messages.append(message)
    session.commit()
    return {"message": "Message sent"}

