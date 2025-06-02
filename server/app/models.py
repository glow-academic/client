from datetime import datetime
from typing import List, Optional

from sqlalchemy import ARRAY, Boolean, Column, DateTime, Enum, ForeignKeyConstraint, Integer, PrimaryKeyConstraint, Text, UUID, UniqueConstraint, Uuid, text
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
    profile_ids: list = Field(sa_column=Column('profile_ids', ARRAY(Uuid()), server_default=text('ARRAY[]::uuid[]')))

    documents: List['Documents'] = Relationship(back_populates='class_')
    quizzes: List['Quizzes'] = Relationship(back_populates='class_')
    chats: List['Chats'] = Relationship(back_populates='class_')


class Profiles(_Base, table=True):
    __table_args__ = (
        PrimaryKeyConstraint('id', name='profiles_pkey'),
    )

    id: UUID = Field(sa_column=Column('id', Uuid, primary_key=True, server_default=text('gen_random_uuid()')))
    created_at: datetime = Field(sa_column=Column('created_at', DateTime(True), server_default=text('now()')))
    name: str = Field(sa_column=Column('name', Text))
    subtitle: str = Field(sa_column=Column('subtitle', Text))
    description: str = Field(sa_column=Column('description', Text))
    threshold: int = Field(sa_column=Column('threshold', Integer))

    templates: List['Templates'] = Relationship(back_populates='profile')
    chats: List['Chats'] = Relationship(back_populates='profile')


class Scenarios(_Base, table=True):
    __table_args__ = (
        PrimaryKeyConstraint('id', name='scenarios_pkey'),
    )

    id: UUID = Field(sa_column=Column('id', Uuid, primary_key=True, server_default=text('gen_random_uuid()')))
    created_at: datetime = Field(sa_column=Column('created_at', DateTime(True), server_default=text('now()')))
    name: str = Field(sa_column=Column('name', Text))
    description: str = Field(sa_column=Column('description', Text))

    chats: List['Chats'] = Relationship(back_populates='scenario')


class Users(_Base, table=True):
    __table_args__ = (
        PrimaryKeyConstraint('id', name='users_pkey'),
        UniqueConstraint('username', name='users_username_key')
    )

    id: UUID = Field(sa_column=Column('id', Uuid, primary_key=True, server_default=text('gen_random_uuid()')))
    viewed_intro: bool = Field(sa_column=Column('viewed_intro', Boolean, server_default=text('false')))
    created_at: datetime = Field(sa_column=Column('created_at', DateTime(True), server_default=text('now()')))
    role: str = Field(sa_column=Column('role', Enum('admin', 'instructional', 'instructor', 'ta', 'guest', name='user_role'), server_default=text("'guest'::user_role")))
    name: str = Field(sa_column=Column('name', Text))
    username: str = Field(sa_column=Column('username', Text))
    password: str = Field(sa_column=Column('password', Text))
    class_ids: list = Field(sa_column=Column('class_ids', ARRAY(Uuid()), server_default=text('ARRAY[]::uuid[]')))

    quizzes: List['Quizzes'] = Relationship(back_populates='user')
    chats: List['Chats'] = Relationship(back_populates='user')


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
    class_id: UUID = Field(sa_column=Column('class_id', Uuid))
    type: str = Field(sa_column=Column('type', Enum('homework', 'project', 'quiz', 'midterm', 'lab', name='document_type'), server_default=text("'homework'::document_type")))

    class_: Optional['Classes'] = Relationship(back_populates='documents')


class Quizzes(_Base, table=True):
    __table_args__ = (
        ForeignKeyConstraint(['class_id'], ['classes.id'], ondelete='CASCADE', name='quizzes_class_id_fkey'),
        ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE', name='quizzes_user_id_fkey'),
        PrimaryKeyConstraint('id', name='quizzes_pkey')
    )

    id: UUID = Field(sa_column=Column('id', Uuid, primary_key=True, server_default=text('gen_random_uuid()')))
    created_at: datetime = Field(sa_column=Column('created_at', DateTime(True), server_default=text('now()')))
    title: str = Field(sa_column=Column('title', Text))
    class_id: UUID = Field(sa_column=Column('class_id', Uuid))
    documents: list = Field(sa_column=Column('documents', ARRAY(Uuid()), server_default=text('ARRAY[]::uuid[]')))
    time_limit: int = Field(sa_column=Column('time_limit', Integer))
    user_id: UUID = Field(sa_column=Column('user_id', Uuid))
    active: bool = Field(sa_column=Column('active', Boolean, server_default=text('true')))
    template_ids: list = Field(sa_column=Column('template_ids', ARRAY(Uuid()), server_default=text('ARRAY[]::uuid[]')))

    class_: Optional['Classes'] = Relationship(back_populates='quizzes')
    user: Optional['Users'] = Relationship(back_populates='quizzes')
    chats: List['Chats'] = Relationship(back_populates='quiz')


class Templates(_Base, table=True):
    __table_args__ = (
        ForeignKeyConstraint(['profile_id'], ['profiles.id'], ondelete='CASCADE', name='templates_profile_id_fkey'),
        PrimaryKeyConstraint('id', name='templates_pkey')
    )

    id: UUID = Field(sa_column=Column('id', Uuid, primary_key=True, server_default=text('gen_random_uuid()')))
    created_at: datetime = Field(sa_column=Column('created_at', DateTime(True), server_default=text('now()')))
    profile_id: UUID = Field(sa_column=Column('profile_id', Uuid))
    crowdedness: int = Field(sa_column=Column('crowdedness', Integer))
    intensity: int = Field(sa_column=Column('intensity', Integer))
    seniority: str = Field(sa_column=Column('seniority', Enum('freshman', 'sophmore', 'junior', 'senior', name='seniority_levels'), server_default=text("'freshman'::seniority_levels")))

    profile: Optional['Profiles'] = Relationship(back_populates='templates')


class Chats(_Base, table=True):
    __table_args__ = (
        ForeignKeyConstraint(['class_id'], ['classes.id'], ondelete='CASCADE', name='chats_class_id_fkey'),
        ForeignKeyConstraint(['profile_id'], ['profiles.id'], ondelete='CASCADE', name='chats_profile_id_fkey'),
        ForeignKeyConstraint(['quiz_id'], ['quizzes.id'], ondelete='CASCADE', name='chats_quiz_id_fkey'),
        ForeignKeyConstraint(['scenario_id'], ['scenarios.id'], ondelete='CASCADE', name='chats_scenario_id_fkey'),
        ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE', name='chats_user_id_fkey'),
        PrimaryKeyConstraint('id', name='chats_pkey')
    )

    id: UUID = Field(sa_column=Column('id', Uuid, primary_key=True, server_default=text('gen_random_uuid()')))
    created_at: datetime = Field(sa_column=Column('created_at', DateTime(True), server_default=text('now()')))
    title: str = Field(sa_column=Column('title', Text))
    scenario_id: UUID = Field(sa_column=Column('scenario_id', Uuid))
    completed: bool = Field(sa_column=Column('completed', Boolean, server_default=text('false')))
    user_id: UUID = Field(sa_column=Column('user_id', Uuid))
    profile_id: UUID = Field(sa_column=Column('profile_id', Uuid))
    class_id: UUID = Field(sa_column=Column('class_id', Uuid))
    completed_at: Optional[datetime] = Field(default=None, sa_column=Column('completed_at', DateTime(True)))
    quiz_id: Optional[UUID] = Field(default=None, sa_column=Column('quiz_id', Uuid))

    class_: Optional['Classes'] = Relationship(back_populates='chats')
    profile: Optional['Profiles'] = Relationship(back_populates='chats')
    quiz: Optional['Quizzes'] = Relationship(back_populates='chats')
    scenario: Optional['Scenarios'] = Relationship(back_populates='chats')
    user: Optional['Users'] = Relationship(back_populates='chats')
    messages: List['Messages'] = Relationship(back_populates='chat')
    rubrics: List['Rubrics'] = Relationship(back_populates='chat')


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
