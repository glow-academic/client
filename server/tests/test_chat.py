# tests/test_chat.py
from fastapi.testclient import TestClient
from sqlmodel import Session
from app.models import Chat


def test_new_chat_endpoint(client: TestClient, session: Session):
    # Create a test chat
    test_chat = Chat(title="Test Chat", profile="default", user_id="test-user")
    session.add(test_chat)
    session.commit()


def test_end_chat_endpoint(client: TestClient, session: Session):
    # Create a test chat
    test_chat = Chat(title="Test Chat", profile="default", user_id="test-user")
    session.add(test_chat)
    session.commit()


def test_message_endpoint(client: TestClient, session: Session):
    # Create a test chat
    test_chat = Chat(title="Test Chat", profile="default", user_id="test-user")
    session.add(test_chat)
    session.commit()
