from datetime import datetime
from typing import List, Optional

from sqlalchemy import ARRAY, Boolean, Column, DateTime, Enum, ForeignKeyConstraint, Integer, PrimaryKeyConstraint, Text, UUID, UniqueConstraint, Uuid, text
from sqlalchemy.dialects.postgresql import JSONB
from sqlmodel import Field, Relationship, SQLModel



class _Base(SQLModel):
    """Shared config so Pydantic will accept SQLAlchemy types."""
    model_config = {"arbitrary_types_allowed": True}
class Classes(_Base, table=True):
    __table_args__ = (
        PrimaryKeyConstraint('id', name='classes_pkey'),
    )

    id: UUID = Field(sa_column=Column('id', Uuid, primary_key=True, server_default=text('gen_random_uuid()')))
    created_at: datetime = Field(sa_column=Column('created_at', DateTime(True), server_default=text('now()')))
    name: str = Field(sa_column=Column('name', Text))
    class_code: str = Field(sa_column=Column('class_code', Text))
    description: str = Field(sa_column=Column('description', Text))
    aggressive_threshold: int = Field(sa_column=Column('aggressive_threshold', Integer))
    happy_threshold: int = Field(sa_column=Column('happy_threshold', Integer))
    confused_threshold: int = Field(sa_column=Column('confused_threshold', Integer))

    chats: List['Chats'] = Relationship(back_populates='class_')
    documents: List['Documents'] = Relationship(back_populates='class_')
    quizzes: List['Quizzes'] = Relationship(back_populates='class_')


class Users(_Base, table=True):
    __table_args__ = (
        PrimaryKeyConstraint('id', name='users_pkey'),
        UniqueConstraint('username', name='users_username_key')
    )

    id: UUID = Field(sa_column=Column('id', Uuid, primary_key=True, server_default=text('gen_random_uuid()')))
    viewed_intro: bool = Field(sa_column=Column('viewed_intro', Boolean, server_default=text('false')))
    created_at: datetime = Field(sa_column=Column('created_at', DateTime(True), server_default=text('now()')))
    admin: bool = Field(sa_column=Column('admin', Boolean, server_default=text('false')))
    name: str = Field(sa_column=Column('name', Text))
    username: str = Field(sa_column=Column('username', Text))
    password: str = Field(sa_column=Column('password', Text))
    classes: list = Field(sa_column=Column('classes', ARRAY(Uuid()), server_default=text('ARRAY[]::uuid[]')))

    chats: List['Chats'] = Relationship(back_populates='user')
    quizzes: List['Quizzes'] = Relationship(back_populates='creator')
    quiz_attempts: List['QuizAttempts'] = Relationship(back_populates='user')


class Chats(_Base, table=True):
    __table_args__ = (
        ForeignKeyConstraint(['class_id'], ['classes.id'], ondelete='CASCADE', name='chats_class_id_fkey'),
        ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE', name='chats_user_id_fkey'),
        PrimaryKeyConstraint('id', name='chats_pkey')
    )

    id: UUID = Field(sa_column=Column('id', Uuid, primary_key=True, server_default=text('gen_random_uuid()')))
    created_at: datetime = Field(sa_column=Column('created_at', DateTime(True), server_default=text('now()')))
    title: str = Field(sa_column=Column('title', Text))
    scenario_description: str = Field(sa_column=Column('scenario_description', Text))
    completed: bool = Field(sa_column=Column('completed', Boolean, server_default=text('false')))
    user_id: UUID = Field(sa_column=Column('user_id', Uuid))
    profile: str = Field(sa_column=Column('profile', Enum('aggressive', 'happy', 'confused', name='chat_profile')))
    class_id: UUID = Field(sa_column=Column('class_id', Uuid))
    completed_at: Optional[datetime] = Field(default=None, sa_column=Column('completed_at', DateTime(True)))

    class_: Optional['Classes'] = Relationship(back_populates='chats')
    user: Optional['Users'] = Relationship(back_populates='chats')
    messages: List['Messages'] = Relationship(back_populates='chat')
    rubrics: List['Rubrics'] = Relationship(back_populates='chat')


class Documents(_Base, table=True):
    __table_args__ = (
        ForeignKeyConstraint(['class_id'], ['classes.id'], ondelete='CASCADE', name='documents_class_id_fkey'),
        PrimaryKeyConstraint('id', name='documents_pkey')
    )

    id: UUID = Field(sa_column=Column('id', Uuid, primary_key=True, server_default=text('gen_random_uuid()')))
    created_at: datetime = Field(sa_column=Column('created_at', DateTime(True), server_default=text('now()')))
    name: str = Field(sa_column=Column('name', Text))
    file_path: str = Field(sa_column=Column('file_path', Text))
    mime_type: str = Field(sa_column=Column('mime_type', Text))
    profile: str = Field(sa_column=Column('profile', Enum('aggressive', 'happy', 'confused', name='chat_profile')))
    class_id: UUID = Field(sa_column=Column('class_id', Uuid))

    class_: Optional['Classes'] = Relationship(back_populates='documents')
    quizzes: List['Quizzes'] = Relationship(back_populates='document')


class Messages(_Base, table=True):
    __table_args__ = (
        ForeignKeyConstraint(['chat_id'], ['chats.id'], ondelete='CASCADE', name='messages_chat_id_fkey'),
        PrimaryKeyConstraint('id', name='messages_pkey')
    )

    id: UUID = Field(sa_column=Column('id', Uuid, primary_key=True, server_default=text('gen_random_uuid()')))
    created_at: datetime = Field(sa_column=Column('created_at', DateTime(True), server_default=text('now()')))
    chat_id: UUID = Field(sa_column=Column('chat_id', Uuid))
    query: str = Field(sa_column=Column('query', Text))
    response: str = Field(sa_column=Column('response', Text))
    completed: bool = Field(sa_column=Column('completed', Boolean, server_default=text('false')))

    chat: Optional['Chats'] = Relationship(back_populates='messages')


class Quizzes(_Base, table=True):
    __table_args__ = (
        ForeignKeyConstraint(['class_id'], ['classes.id'], ondelete='CASCADE', name='quizzes_class_id_fkey'),
        ForeignKeyConstraint(['creator_id'], ['users.id'], ondelete='CASCADE', name='quizzes_creator_id_fkey'),
        ForeignKeyConstraint(['document_id'], ['documents.id'], ondelete='SET NULL', name='quizzes_document_id_fkey'),
        PrimaryKeyConstraint('id', name='quizzes_pkey')
    )

    id: UUID = Field(sa_column=Column('id', Uuid, primary_key=True, server_default=text('gen_random_uuid()')))
    created_at: datetime = Field(sa_column=Column('created_at', DateTime(True), server_default=text('now()')))
    title: str = Field(sa_column=Column('title', Text))
    class_id: UUID = Field(sa_column=Column('class_id', Uuid))
    time_limit: int = Field(sa_column=Column('time_limit', Integer))
    creator_id: UUID = Field(sa_column=Column('creator_id', Uuid))
    active: bool = Field(sa_column=Column('active', Boolean, server_default=text('true')))
    student_interactions: dict = Field(sa_column=Column('student_interactions', JSONB, server_default=text('\'{"happy": [], "confused": [], "aggressive": []}\'::jsonb')))
    document_id: Optional[UUID] = Field(default=None, sa_column=Column('document_id', Uuid))

    class_: Optional['Classes'] = Relationship(back_populates='quizzes')
    creator: Optional['Users'] = Relationship(back_populates='quizzes')
    document: Optional['Documents'] = Relationship(back_populates='quizzes')
    quiz_attempts: List['QuizAttempts'] = Relationship(back_populates='quiz')


class Rubrics(_Base, table=True):
    __table_args__ = (
        ForeignKeyConstraint(['chat_id'], ['chats.id'], ondelete='CASCADE', name='rubrics_chat_id_fkey'),
        PrimaryKeyConstraint('id', name='rubrics_pkey')
    )

    id: UUID = Field(sa_column=Column('id', Uuid, primary_key=True, server_default=text('gen_random_uuid()')))
    chat_id: UUID = Field(sa_column=Column('chat_id', Uuid))
    created_at: datetime = Field(sa_column=Column('created_at', DateTime(True), server_default=text('now()')))
    passed: bool = Field(sa_column=Column('passed', Boolean))
    score: int = Field(sa_column=Column('score', Integer))
    time_taken: int = Field(sa_column=Column('time_taken', Integer))
    adaptability: int = Field(sa_column=Column('adaptability', Integer))
    listening: int = Field(sa_column=Column('listening', Integer))
    objectives: int = Field(sa_column=Column('objectives', Integer))
    time_management: int = Field(sa_column=Column('time_management', Integer))
    adaptability_feedback: Optional[str] = Field(default=None, sa_column=Column('adaptability_feedback', Text))
    listening_feedback: Optional[str] = Field(default=None, sa_column=Column('listening_feedback', Text))
    objectives_feedback: Optional[str] = Field(default=None, sa_column=Column('objectives_feedback', Text))
    time_management_feedback: Optional[str] = Field(default=None, sa_column=Column('time_management_feedback', Text))

    chat: Optional['Chats'] = Relationship(back_populates='rubrics')


class QuizAttempts(_Base, table=True):
    __tablename__ = 'quiz_attempts'
    __table_args__ = (
        ForeignKeyConstraint(['quiz_id'], ['quizzes.id'], ondelete='CASCADE', name='quiz_attempts_quiz_id_fkey'),
        ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE', name='quiz_attempts_user_id_fkey'),
        PrimaryKeyConstraint('id', name='quiz_attempts_pkey'),
        UniqueConstraint('quiz_id', 'user_id', 'started_at', name='quiz_attempts_quiz_id_user_id_started_at_key')
    )

    id: UUID = Field(sa_column=Column('id', Uuid, primary_key=True, server_default=text('gen_random_uuid()')))
    quiz_id: UUID = Field(sa_column=Column('quiz_id', Uuid))
    user_id: UUID = Field(sa_column=Column('user_id', Uuid))
    started_at: datetime = Field(sa_column=Column('started_at', DateTime(True), server_default=text('now()')))
    completed: bool = Field(sa_column=Column('completed', Boolean, server_default=text('false')))
    completed_at: Optional[datetime] = Field(default=None, sa_column=Column('completed_at', DateTime(True)))
    score: Optional[int] = Field(default=None, sa_column=Column('score', Integer))
    time_taken: Optional[int] = Field(default=None, sa_column=Column('time_taken', Integer))

    quiz: Optional['Quizzes'] = Relationship(back_populates='quiz_attempts')
    user: Optional['Users'] = Relationship(back_populates='quiz_attempts')
