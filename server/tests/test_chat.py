# tests/test_chat.py
from fastapi.testclient import TestClient
from sqlmodel import Session
from app.models import Chat, Message

def test_chat_endpoint(client: TestClient, session: Session):
    # Create a test chat
    test_chat = Chat(title="Test Chat", profile="default", user_id="test-user")
    session.add(test_chat)
    session.commit()
    
    chat_id = str(test_chat.id)
    
    # Test the chat endpoint
    response = client.post(
        "/chat",
        data={"message": "Hello, AI!", "chat_id": chat_id}
    )
    
    assert response.status_code == 200
    data = response.json()
    assert data["chat_id"] == chat_id
    assert "Echo: Hello, AI!" in data["response"]
    
    # Check that the message was saved to the database
    messages = session.query(Message).filter(Message.chat_id == chat_id).all()
    assert len(messages) == 1
    assert messages[0].query == "Hello, AI!"
    assert "Echo: Hello, AI!" in messages[0].response
    assert messages[0].completed == True