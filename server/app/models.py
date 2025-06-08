from datetime import datetime
from typing import List, Optional

from sqlalchemy import ARRAY, Boolean, Column, DateTime, Enum, ForeignKeyConstraint, Integer, PrimaryKeyConstraint, Text, UUID, UniqueConstraint, Uuid, text
from sqlmodel import Field, Relationship, SQLModel



class _Base(SQLModel):
    """Shared config so Pydantic will accept SQLAlchemy types."""
    model_config = {"arbitrary_types_allowed": True}
class Agents(_Base, table=True):
    __table_args__ = (
        PrimaryKeyConstraint('id', name='agents_pkey'),
    )

    id: UUID = Field(sa_column=Column('id', Uuid, primary_key=True, server_default=text('gen_random_uuid()')))
    created_at: datetime = Field(sa_column=Column('created_at', DateTime(True), server_default=text('now()')))
    name: str = Field(sa_column=Column('name', Text))
    subtitle: str = Field(sa_column=Column('subtitle', Text))
    description: str = Field(sa_column=Column('description', Text))
    prompt: str = Field(sa_column=Column('prompt', Text))
    threshold: int = Field(sa_column=Column('threshold', Integer))

    interactions: List['Interactions'] = Relationship(back_populates='agent')
    chats: List['Chats'] = Relationship(back_populates='agent')


class Classes(_Base, table=True):
    __table_args__ = (
        PrimaryKeyConstraint('id', name='classes_pkey'),
    )

    id: UUID = Field(sa_column=Column('id', Uuid, primary_key=True, server_default=text('gen_random_uuid()')))
    created_at: datetime = Field(sa_column=Column('created_at', DateTime(True), server_default=text('now()')))
    name: str = Field(sa_column=Column('name', Text))
    class_code: str = Field(sa_column=Column('class_code', Text))
    year: int = Field(sa_column=Column('year', Integer))
    term: str = Field(sa_column=Column('term', Enum('fall', 'spring', 'summer', name='class_term'), server_default=text("'fall'::class_term")))
    description: str = Field(sa_column=Column('description', Text))

    documents: List['Documents'] = Relationship(back_populates='class_')
    schedules: List['Schedules'] = Relationship(back_populates='class_')
    simulations: List['Simulations'] = Relationship(back_populates='class_')
    topics: List['Topics'] = Relationship(back_populates='class_')
    attempts: List['Attempts'] = Relationship(back_populates='class_')


class Scenarios(_Base, table=True):
    __table_args__ = (
        PrimaryKeyConstraint('id', name='scenarios_pkey'),
    )

    id: UUID = Field(sa_column=Column('id', Uuid, primary_key=True, server_default=text('gen_random_uuid()')))
    created_at: datetime = Field(sa_column=Column('created_at', DateTime(True), server_default=text('now()')))
    name: str = Field(sa_column=Column('name', Text))
    description: str = Field(sa_column=Column('description', Text))

    interactions: List['Interactions'] = Relationship(back_populates='scenario')
    chats: List['Chats'] = Relationship(back_populates='scenario')


class Users(_Base, table=True):
    __table_args__ = (
        PrimaryKeyConstraint('id', name='users_pkey'),
        UniqueConstraint('username', name='users_username_key')
    )

    id: UUID = Field(sa_column=Column('id', Uuid, primary_key=True, server_default=text('gen_random_uuid()')))
    viewed_intro: bool = Field(sa_column=Column('viewed_intro', Boolean, server_default=text('false')))
    created_at: datetime = Field(sa_column=Column('created_at', DateTime(True), server_default=text('now()')))
    role: str = Field(sa_column=Column('role', Enum('admin', 'instructional', 'instructor', 'ta', name='user_role'), server_default=text("'ta'::user_role")))
    name: str = Field(sa_column=Column('name', Text))
    username: str = Field(sa_column=Column('username', Text))
    password: str = Field(sa_column=Column('password', Text))
    class_ids: list = Field(sa_column=Column('class_ids', ARRAY(Uuid()), server_default=text('ARRAY[]::uuid[]')))

    attempts: List['Attempts'] = Relationship(back_populates='user')


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
    type: str = Field(sa_column=Column('type', Enum('homework', 'project', 'quiz', 'midterm', 'lab', 'lecture', 'syllabus', name='document_type'), server_default=text("'homework'::document_type")))
    classified: bool = Field(sa_column=Column('classified', Boolean, server_default=text('false')))

    class_: Optional['Classes'] = Relationship(back_populates='documents')


class Interactions(_Base, table=True):
    __table_args__ = (
        ForeignKeyConstraint(['agent_id'], ['agents.id'], ondelete='SET NULL', name='interactions_agent_id_fkey'),
        ForeignKeyConstraint(['scenario_id'], ['scenarios.id'], ondelete='SET NULL', name='interactions_scenario_id_fkey'),
        PrimaryKeyConstraint('id', name='interactions_pkey')
    )

    id: UUID = Field(sa_column=Column('id', Uuid, primary_key=True, server_default=text('gen_random_uuid()')))
    created_at: datetime = Field(sa_column=Column('created_at', DateTime(True), server_default=text('now()')))
    crowdedness: int = Field(sa_column=Column('crowdedness', Integer))
    intensity: int = Field(sa_column=Column('intensity', Integer))
    seniority: str = Field(sa_column=Column('seniority', Enum('freshman', 'sophomore', 'junior', 'senior', name='seniority_levels'), server_default=text("'freshman'::seniority_levels")))
    agent_id: Optional[UUID] = Field(default=None, sa_column=Column('agent_id', Uuid))
    scenario_id: Optional[UUID] = Field(default=None, sa_column=Column('scenario_id', Uuid))

    agent: Optional['Agents'] = Relationship(back_populates='interactions')
    scenario: Optional['Scenarios'] = Relationship(back_populates='interactions')
    chats: List['Chats'] = Relationship(back_populates='interaction')


class Schedules(_Base, table=True):
    __table_args__ = (
        ForeignKeyConstraint(['class_id'], ['classes.id'], ondelete='CASCADE', name='schedules_class_id_fkey'),
        PrimaryKeyConstraint('id', name='schedules_pkey')
    )

    id: UUID = Field(sa_column=Column('id', Uuid, primary_key=True, server_default=text('gen_random_uuid()')))
    created_at: datetime = Field(sa_column=Column('created_at', DateTime(True), server_default=text('now()')))
    name: str = Field(sa_column=Column('name', Text))
    description: str = Field(sa_column=Column('description', Text))
    class_id: UUID = Field(sa_column=Column('class_id', Uuid))

    class_: Optional['Classes'] = Relationship(back_populates='schedules')
    events: List['Events'] = Relationship(back_populates='schedule')


class Simulations(_Base, table=True):
    __table_args__ = (
        ForeignKeyConstraint(['class_id'], ['classes.id'], ondelete='SET NULL', name='simulations_class_id_fkey'),
        PrimaryKeyConstraint('id', name='simulations_pkey')
    )

    id: UUID = Field(sa_column=Column('id', Uuid, primary_key=True, server_default=text('gen_random_uuid()')))
    created_at: datetime = Field(sa_column=Column('created_at', DateTime(True), server_default=text('now()')))
    title: str = Field(sa_column=Column('title', Text))
    documents: list = Field(sa_column=Column('documents', ARRAY(Uuid()), server_default=text('ARRAY[]::uuid[]')))
    active: bool = Field(sa_column=Column('active', Boolean, server_default=text('true')))
    interaction_ids: list = Field(sa_column=Column('interaction_ids', ARRAY(Uuid()), server_default=text('ARRAY[]::uuid[]')))
    class_id: Optional[UUID] = Field(default=None, sa_column=Column('class_id', Uuid))
    time_limit: Optional[int] = Field(default=None, sa_column=Column('time_limit', Integer))

    class_: Optional['Classes'] = Relationship(back_populates='simulations')
    attempts: List['Attempts'] = Relationship(back_populates='simulation')


class Topics(_Base, table=True):
    __table_args__ = (
        ForeignKeyConstraint(['class_id'], ['classes.id'], ondelete='CASCADE', name='topics_class_id_fkey'),
        PrimaryKeyConstraint('id', name='topics_pkey')
    )

    id: UUID = Field(sa_column=Column('id', Uuid, primary_key=True, server_default=text('gen_random_uuid()')))
    created_at: datetime = Field(sa_column=Column('created_at', DateTime(True), server_default=text('now()')))
    name: str = Field(sa_column=Column('name', Text))
    description: str = Field(sa_column=Column('description', Text))
    prerequisite: bool = Field(sa_column=Column('prerequisite', Boolean, server_default=text('false')))
    class_id: UUID = Field(sa_column=Column('class_id', Uuid))

    class_: Optional['Classes'] = Relationship(back_populates='topics')


class Attempts(_Base, table=True):
    __table_args__ = (
        ForeignKeyConstraint(['class_id'], ['classes.id'], ondelete='CASCADE', name='attempts_class_id_fkey'),
        ForeignKeyConstraint(['simulation_id'], ['simulations.id'], ondelete='CASCADE', name='attempts_simulation_id_fkey'),
        ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE', name='attempts_user_id_fkey'),
        PrimaryKeyConstraint('id', name='attempts_pkey')
    )

    id: UUID = Field(sa_column=Column('id', Uuid, primary_key=True, server_default=text('gen_random_uuid()')))
    created_at: datetime = Field(sa_column=Column('created_at', DateTime(True), server_default=text('now()')))
    class_id: UUID = Field(sa_column=Column('class_id', Uuid))
    simulation_id: UUID = Field(sa_column=Column('simulation_id', Uuid))
    user_id: Optional[UUID] = Field(default=None, sa_column=Column('user_id', Uuid))

    class_: Optional['Classes'] = Relationship(back_populates='attempts')
    simulation: Optional['Simulations'] = Relationship(back_populates='attempts')
    user: Optional['Users'] = Relationship(back_populates='attempts')
    chats: List['Chats'] = Relationship(back_populates='attempt')


class Events(_Base, table=True):
    __table_args__ = (
        ForeignKeyConstraint(['schedule_id'], ['schedules.id'], ondelete='CASCADE', name='events_schedule_id_fkey'),
        PrimaryKeyConstraint('id', name='events_pkey')
    )

    id: UUID = Field(sa_column=Column('id', Uuid, primary_key=True, server_default=text('gen_random_uuid()')))
    created_at: datetime = Field(sa_column=Column('created_at', DateTime(True), server_default=text('now()')))
    name: str = Field(sa_column=Column('name', Text))
    description: str = Field(sa_column=Column('description', Text))
    time: datetime = Field(sa_column=Column('time', DateTime(True)))
    schedule_id: UUID = Field(sa_column=Column('schedule_id', Uuid))
    document_type: Optional[str] = Field(default=None, sa_column=Column('document_type', Enum('homework', 'project', 'quiz', 'midterm', 'lab', 'lecture', 'syllabus', name='document_type')))

    schedule: Optional['Schedules'] = Relationship(back_populates='events')


class Chats(_Base, table=True):
    __table_args__ = (
        ForeignKeyConstraint(['agent_id'], ['agents.id'], ondelete='CASCADE', name='chats_agent_id_fkey'),
        ForeignKeyConstraint(['attempt_id'], ['attempts.id'], ondelete='CASCADE', name='chats_attempt_id_fkey'),
        ForeignKeyConstraint(['interaction_id'], ['interactions.id'], ondelete='CASCADE', name='chats_interaction_id_fkey'),
        ForeignKeyConstraint(['scenario_id'], ['scenarios.id'], ondelete='CASCADE', name='chats_scenario_id_fkey'),
        PrimaryKeyConstraint('id', name='chats_pkey')
    )

    id: UUID = Field(sa_column=Column('id', Uuid, primary_key=True, server_default=text('gen_random_uuid()')))
    created_at: datetime = Field(sa_column=Column('created_at', DateTime(True), server_default=text('now()')))
    title: str = Field(sa_column=Column('title', Text))
    scenario_id: UUID = Field(sa_column=Column('scenario_id', Uuid))
    agent_id: UUID = Field(sa_column=Column('agent_id', Uuid))
    interaction_id: UUID = Field(sa_column=Column('interaction_id', Uuid))
    completed: bool = Field(sa_column=Column('completed', Boolean, server_default=text('false')))
    attempt_id: UUID = Field(sa_column=Column('attempt_id', Uuid))
    completed_at: Optional[datetime] = Field(default=None, sa_column=Column('completed_at', DateTime(True)))

    agent: Optional['Agents'] = Relationship(back_populates='chats')
    attempt: Optional['Attempts'] = Relationship(back_populates='chats')
    interaction: Optional['Interactions'] = Relationship(back_populates='chats')
    scenario: Optional['Scenarios'] = Relationship(back_populates='chats')
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
