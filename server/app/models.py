from typing import Optional
from uuid import uuid4, UUID
from datetime import datetime
from enum import Enum

from sqlmodel import Field, SQLModel

# Create an enum to match the PostgreSQL enum
class ChatProfile(str, Enum):
    aggressive = "aggressive"
    shy = "shy"
    happy = "happy"

class User(SQLModel, table=True):
    __tablename__ = "users"
    
    id: UUID = Field(default_factory=uuid4, primary_key=True)
    created_at: datetime = Field(default_factory=datetime.utcnow, nullable=False)
    username: str = Field(nullable=False, unique=True)
    password: str = Field(nullable=False)

class Chat(SQLModel, table=True):
    __tablename__ = "chats"
    
    id: UUID = Field(default_factory=uuid4, primary_key=True)
    created_at: datetime = Field(default_factory=datetime.utcnow, nullable=False)
    title: str
    completed: bool = Field(default=False, nullable=False)
    user_id: UUID = Field(foreign_key="users.id")
    profile: ChatProfile  # Use the enum type

class Message(SQLModel, table=True):
    __tablename__ = "messages"
    
    id: UUID = Field(default_factory=uuid4, primary_key=True)
    created_at: datetime = Field(default_factory=datetime.utcnow, nullable=False)
    chat_id: UUID = Field(foreign_key="chats.id")  # Add the missing chat_id field
    query: str
    response: str
    completed: bool = Field(default=False, nullable=False)

class Rubric(SQLModel, table=True):
    __tablename__ = "rubrics"
    
    id: UUID = Field(foreign_key="chats.id", primary_key=True)
    created_at: datetime = Field(default_factory=datetime.utcnow, nullable=False)
    passed: bool
    support: float
    elaborated: float
    time: int
