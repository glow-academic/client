import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional

from sqlalchemy import (ARRAY, BigInteger, Boolean, Column, DateTime,
                        Enum, ForeignKeyConstraint, Integer,
                        PrimaryKeyConstraint, String, Text, Uuid, text, Double)
from sqlalchemy.dialects.postgresql import JSONB
from sqlmodel import Field, Relationship, SQLModel
from sqlalchemy.orm import Mapped

class _Base(SQLModel):
    """Shared config so Pydantic will accept SQLAlchemy types."""
    model_config = {"arbitrary_types_allowed": True}
class Accounts(_Base, table=True):
    __table_args__ = (
        PrimaryKeyConstraint('id', name='accounts_pkey'),
    )

    id: Optional[int] = Field(default=None, sa_column=Column('id', Integer, primary_key=True))
    userId: int = Field(sa_column=Column('userId', Integer))
    type: str = Field(sa_column=Column('type', String(255)))
    provider: str = Field(sa_column=Column('provider', String(255)))
    providerAccountId: str = Field(sa_column=Column('providerAccountId', String(255)))
    refresh_token: Optional[str] = Field(default=None, sa_column=Column('refresh_token', Text))
    access_token: Optional[str] = Field(default=None, sa_column=Column('access_token', Text))
    expires_at: Optional[int] = Field(default=None, sa_column=Column('expires_at', BigInteger))
    id_token: Optional[str] = Field(default=None, sa_column=Column('id_token', Text))
    scope: Optional[str] = Field(default=None, sa_column=Column('scope', Text))
    session_state: Optional[str] = Field(default=None, sa_column=Column('session_state', Text))
    token_type: Optional[str] = Field(default=None, sa_column=Column('token_type', Text))


class AppLogs(_Base, table=True):
    __tablename__ = 'app_logs'
    __table_args__ = (
        PrimaryKeyConstraint('id', name='app_logs_pkey'),
    )

    id: Optional[int] = Field(default=None, sa_column=Column('id', Integer, primary_key=True))
    level: str = Field(sa_column=Column('level', Text))
    message: Optional[str] = Field(default=None, sa_column=Column('message', Text))
    context: Optional[Dict[str, Any]] = Field(default=None, sa_column=Column('context', JSONB))
    created_at: Optional[datetime] = Field(default=None, sa_column=Column('created_at', DateTime(True), server_default=text('now()')))


class Classes(_Base, table=True):
    __table_args__ = (
        PrimaryKeyConstraint('id', name='classes_pkey'),
    )

    id: Mapped[uuid.UUID] = Field(sa_column=Column('id', Uuid, primary_key=True, server_default=text('gen_random_uuid()')))
    created_at: datetime = Field(sa_column=Column('created_at', DateTime(True), server_default=text('now()')))
    updated_at: datetime = Field(sa_column=Column('updated_at', DateTime(True), server_default=text('now()')))
    name: str = Field(sa_column=Column('name', Text))
    class_code: str = Field(sa_column=Column('class_code', Text))
    year: int = Field(sa_column=Column('year', Integer))
    term: str = Field(sa_column=Column('term', Enum('fall', 'spring', 'summer', name='class_term'), server_default=text("'fall'::class_term")))
    description: str = Field(sa_column=Column('description', Text))
    default_class: bool = Field(sa_column=Column('default_class', Boolean, server_default=text('false')))

    documents: List['Documents'] = Relationship(back_populates='class_')
    schedules: List['Schedules'] = Relationship(back_populates='class_')
    topics: List['Topics'] = Relationship(back_populates='class_')
    scenarios: List['Scenarios'] = Relationship(back_populates='class_')


class Cohorts(_Base, table=True):
    __table_args__ = (
        PrimaryKeyConstraint('id', name='cohorts_pkey'),
    )

    id: Mapped[uuid.UUID] = Field(sa_column=Column('id', Uuid, primary_key=True, server_default=text('gen_random_uuid()')))
    created_at: datetime = Field(sa_column=Column('created_at', DateTime(True), server_default=text('now()')))
    updated_at: datetime = Field(sa_column=Column('updated_at', DateTime(True), server_default=text('now()')))
    title: str = Field(sa_column=Column('title', Text))
    active: bool = Field(sa_column=Column('active', Boolean, server_default=text('true')))
    profile_ids: List[uuid.UUID] = Field(sa_column=Column('profile_ids', ARRAY(Uuid(as_uuid=True)), server_default=text('ARRAY[]::uuid[]')))
    description: Optional[str] = Field(default=None, sa_column=Column('description', Text))


class Components(_Base, table=True):
    __table_args__ = (
        PrimaryKeyConstraint('id', name='components_pkey'),
    )

    id: Mapped[uuid.UUID] = Field(sa_column=Column('id', Uuid, primary_key=True, server_default=text('gen_random_uuid()')))
    created_at: datetime = Field(sa_column=Column('created_at', DateTime(True), server_default=text('now()')))
    updated_at: datetime = Field(sa_column=Column('updated_at', DateTime(True), server_default=text('now()')))
    name: str = Field(sa_column=Column('name', Text))
    description: str = Field(sa_column=Column('description', Text))
    file_name: str = Field(sa_column=Column('file_name', Text))
    layout: Dict[str, Any] = Field(sa_column=Column('layout', JSONB, server_default=text("'{}'::jsonb")))
    stat: bool = Field(sa_column=Column('stat', Boolean, server_default=text('false')))
    default_component: bool = Field(sa_column=Column('default_component', Boolean, server_default=text('false')))


class Models(_Base, table=True):
    __table_args__ = (
        PrimaryKeyConstraint('id', name='models_pkey'),
    )

    id: Mapped[uuid.UUID] = Field(sa_column=Column('id', Uuid, primary_key=True, server_default=text('gen_random_uuid()')))
    created_at: datetime = Field(sa_column=Column('created_at', DateTime(True), server_default=text('now()')))
    updated_at: datetime = Field(sa_column=Column('updated_at', DateTime(True), server_default=text('now()')))
    name: str = Field(sa_column=Column('name', Text))
    description: str = Field(sa_column=Column('description', Text))
    provider_id: Mapped[uuid.UUID] = Field(sa_column=Column('provider_id', Uuid(as_uuid=True)))
    active: bool = Field(sa_column=Column('active', Boolean, server_default=text('true')))
    model_type: str = Field(sa_column=Column('model_type', Enum('ttt', 'tts', 'stt', name='model_type'), server_default=text("'ttt'::model_type")))

    agents: List['Agents'] = Relationship(back_populates='model')


class Providers(_Base, table=True):
    __table_args__ = (
        PrimaryKeyConstraint('id', name='providers_pkey'),
    )

    id: Mapped[uuid.UUID] = Field(sa_column=Column('id', Uuid, primary_key=True, server_default=text('gen_random_uuid()')))
    created_at: datetime = Field(sa_column=Column('created_at', DateTime(True), server_default=text('now()')))
    updated_at: datetime = Field(sa_column=Column('updated_at', DateTime(True), server_default=text('now()')))
    name: str = Field(sa_column=Column('name', Text))
    description: str = Field(sa_column=Column('description', Text))
    api_key: str = Field(sa_column=Column('api_key', Text))


class Rubrics(_Base, table=True):
    __table_args__ = (
        PrimaryKeyConstraint('id', name='rubrics_pkey'),
    )

    id: Mapped[uuid.UUID] = Field(sa_column=Column('id', Uuid, primary_key=True, server_default=text('gen_random_uuid()')))
    created_at: datetime = Field(sa_column=Column('created_at', DateTime(True), server_default=text('now()')))
    updated_at: datetime = Field(sa_column=Column('updated_at', DateTime(True), server_default=text('now()')))
    name: str = Field(sa_column=Column('name', Text))
    description: str = Field(sa_column=Column('description', Text))
    points: int = Field(sa_column=Column('points', Integer))
    pass_points: int = Field(sa_column=Column('pass_points', Integer))
    default_rubric: bool = Field(sa_column=Column('default_rubric', Boolean, server_default=text('false')))

    simulations: List['Simulations'] = Relationship(back_populates='rubric')
    standard_groups: List['StandardGroups'] = Relationship(back_populates='rubric')
    simulation_chat_grades: List['SimulationChatGrades'] = Relationship(back_populates='rubric')


class Sessions(_Base, table=True):
    __table_args__ = (
        PrimaryKeyConstraint('id', name='sessions_pkey'),
    )

    id: Optional[int] = Field(default=None, sa_column=Column('id', Integer, primary_key=True))
    userId: int = Field(sa_column=Column('userId', Integer))
    expires: datetime = Field(sa_column=Column('expires', DateTime(True)))
    sessionToken: str = Field(sa_column=Column('sessionToken', String(255)))


class Users(_Base, table=True):
    __table_args__ = (
        PrimaryKeyConstraint('id', name='users_pkey'),
    )

    id: Optional[int] = Field(default=None, sa_column=Column('id', Integer, primary_key=True))
    name: Optional[str] = Field(default=None, sa_column=Column('name', String(255)))
    email: Optional[str] = Field(default=None, sa_column=Column('email', String(255)))
    emailVerified: Optional[datetime] = Field(default=None, sa_column=Column('emailVerified', DateTime(True)))
    image: Optional[str] = Field(default=None, sa_column=Column('image', Text))

    profiles: List['Profiles'] = Relationship(back_populates='user')


class VerificationToken(_Base, table=True):
    __tablename__ = 'verification_token'
    __table_args__ = (
        PrimaryKeyConstraint('identifier', 'token', name='verification_token_pkey'),
    )

    identifier: str = Field(sa_column=Column('identifier', Text, primary_key=True))
    expires: datetime = Field(sa_column=Column('expires', DateTime(True)))
    token: str = Field(sa_column=Column('token', Text, primary_key=True))


class Agents(_Base, table=True):
    __table_args__ = (
        ForeignKeyConstraint(['model_id'], ['models.id'], name='agents_model_id_fkey'),
        PrimaryKeyConstraint('id', name='agents_pkey')
    )

    id: Mapped[uuid.UUID] = Field(sa_column=Column('id', Uuid, primary_key=True, server_default=text('gen_random_uuid()')))
    created_at: datetime = Field(sa_column=Column('created_at', DateTime(True), server_default=text('now()')))
    updated_at: datetime = Field(sa_column=Column('updated_at', DateTime(True), server_default=text('now()')))
    name: str = Field(sa_column=Column('name', Text))
    description: str = Field(sa_column=Column('description', Text))
    system_prompt: str = Field(sa_column=Column('system_prompt', Text))
    temperature: int = Field(sa_column=Column('temperature', Integer))
    default_agent: bool = Field(sa_column=Column('default_agent', Boolean, server_default=text('false')))
    voice_agent: bool = Field(sa_column=Column('voice_agent', Boolean, server_default=text('false')))
    editable: bool = Field(sa_column=Column('editable', Boolean, server_default=text('false')))
    model_id: Optional[uuid.UUID] = Field(default=None, sa_column=Column('model_id', Uuid(as_uuid=True)))
    stt_model_id: Optional[uuid.UUID] = Field(default=None, sa_column=Column('stt_model_id', Uuid(as_uuid=True)))
    tts_model_id: Optional[uuid.UUID] = Field(default=None, sa_column=Column('tts_model_id', Uuid(as_uuid=True)))
    reasoning: Optional[str] = Field(default=None, sa_column=Column('reasoning', Enum('low', 'medium', 'high', name='reasoning_effort')))

    model: Optional['Models'] = Relationship(back_populates='agents')
    scenarios: List['Scenarios'] = Relationship(back_populates='agent')


class Documents(_Base, table=True):
    __table_args__ = (
        ForeignKeyConstraint(['class_id'], ['classes.id'], ondelete='CASCADE', name='documents_class_id_fkey'),
        PrimaryKeyConstraint('id', name='documents_pkey')
    )

    id: Mapped[uuid.UUID] = Field(sa_column=Column('id', Uuid, primary_key=True, server_default=text('gen_random_uuid()')))
    created_at: datetime = Field(sa_column=Column('created_at', DateTime(True), server_default=text('now()')))
    updated_at: datetime = Field(sa_column=Column('updated_at', DateTime(True), server_default=text('now()')))
    name: str = Field(sa_column=Column('name', Text))
    file_path: str = Field(sa_column=Column('file_path', Text))
    mime_type: str = Field(sa_column=Column('mime_type', Text))
    class_id: Mapped[uuid.UUID] = Field(sa_column=Column('class_id', Uuid(as_uuid=True)))
    type: str = Field(sa_column=Column('type', Enum('homework', 'project', 'quiz', 'midterm', 'lab', 'lecture', 'syllabus', name='document_type'), server_default=text("'homework'::document_type")))
    classified: bool = Field(sa_column=Column('classified', Boolean, server_default=text('false')))
    file_id: Optional[str] = Field(default=None, sa_column=Column('file_id', Text))

    class_: Optional['Classes'] = Relationship(back_populates='documents')


class Profiles(_Base, table=True):
    __table_args__ = (
        ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE', name='profiles_user_id_fkey'),
        PrimaryKeyConstraint('id', name='profiles_pkey')
    )

    id: Mapped[uuid.UUID] = Field(sa_column=Column('id', Uuid, primary_key=True, server_default=text('gen_random_uuid()')))
    updated_at: datetime = Field(sa_column=Column('updated_at', DateTime(True), server_default=text('now()')))
    last_login: datetime = Field(sa_column=Column('last_login', DateTime(True), server_default=text('now()')))
    first_name: str = Field(sa_column=Column('first_name', Text))
    last_name: str = Field(sa_column=Column('last_name', Text))
    alias: str = Field(sa_column=Column('alias', Text))
    viewed_intro: bool = Field(sa_column=Column('viewed_intro', Boolean, server_default=text('false')))
    created_at: datetime = Field(sa_column=Column('created_at', DateTime(True), server_default=text('now()')))
    role: str = Field(sa_column=Column('role', Enum('admin', 'instructional', 'instructor', 'ta', name='profile_role'), server_default=text("'ta'::profile_role")))
    class_ids: List[uuid.UUID] = Field(sa_column=Column('class_ids', ARRAY(Uuid(as_uuid=True)), server_default=text('ARRAY[]::uuid[]')))
    user_id: Optional[int] = Field(default=None, sa_column=Column('user_id', Integer))

    user: Optional['Users'] = Relationship(back_populates='profiles')
    assistant_chats: List['AssistantChats'] = Relationship(back_populates='profile')
    dashboards: List['Dashboards'] = Relationship(back_populates='profile')
    simulation_attempts: List['SimulationAttempts'] = Relationship(back_populates='profile')


class Schedules(_Base, table=True):
    __table_args__ = (
        ForeignKeyConstraint(['class_id'], ['classes.id'], ondelete='CASCADE', name='schedules_class_id_fkey'),
        PrimaryKeyConstraint('id', name='schedules_pkey')
    )

    id: Mapped[uuid.UUID] = Field(sa_column=Column('id', Uuid, primary_key=True, server_default=text('gen_random_uuid()')))
    created_at: datetime = Field(sa_column=Column('created_at', DateTime(True), server_default=text('now()')))
    updated_at: datetime = Field(sa_column=Column('updated_at', DateTime(True), server_default=text('now()')))
    name: str = Field(sa_column=Column('name', Text))
    description: str = Field(sa_column=Column('description', Text))
    class_id: Mapped[uuid.UUID] = Field(sa_column=Column('class_id', Uuid(as_uuid=True)))

    class_: Optional['Classes'] = Relationship(back_populates='schedules')
    events: List['Events'] = Relationship(back_populates='schedule')


class Simulations(_Base, table=True):
    __table_args__ = (
        ForeignKeyConstraint(['rubric_id'], ['rubrics.id'], ondelete='CASCADE', name='simulations_rubric_id_fkey'),
        PrimaryKeyConstraint('id', name='simulations_pkey')
    )

    id: Mapped[uuid.UUID] = Field(sa_column=Column('id', Uuid, primary_key=True, server_default=text('gen_random_uuid()')))
    created_at: datetime = Field(sa_column=Column('created_at', DateTime(True), server_default=text('now()')))
    updated_at: datetime = Field(sa_column=Column('updated_at', DateTime(True), server_default=text('now()')))
    title: str = Field(sa_column=Column('title', Text))
    active: bool = Field(sa_column=Column('active', Boolean, server_default=text('true')))
    scenario_ids: List[uuid.UUID] = Field(sa_column=Column('scenario_ids', ARRAY(Uuid(as_uuid=True)), server_default=text('ARRAY[]::uuid[]')))
    cohort_ids: List[uuid.UUID] = Field(sa_column=Column('cohort_ids', ARRAY(Uuid(as_uuid=True)), server_default=text('ARRAY[]::uuid[]')))
    rubric_id: Mapped[uuid.UUID] = Field(sa_column=Column('rubric_id', Uuid(as_uuid=True)))
    default_simulation: bool = Field(sa_column=Column('default_simulation', Boolean, server_default=text('false')))
    time_limit: Optional[int] = Field(default=None, sa_column=Column('time_limit', Integer))

    rubric: Optional['Rubrics'] = Relationship(back_populates='simulations')
    simulation_attempts: List['SimulationAttempts'] = Relationship(back_populates='simulation')


class StandardGroups(_Base, table=True):
    __tablename__ = 'standard_groups'
    __table_args__ = (
        ForeignKeyConstraint(['rubric_id'], ['rubrics.id'], ondelete='CASCADE', name='standard_groups_rubric_id_fkey'),
        PrimaryKeyConstraint('id', name='standard_groups_pkey')
    )

    id: Mapped[uuid.UUID] = Field(sa_column=Column('id', Uuid, primary_key=True, server_default=text('gen_random_uuid()')))
    created_at: datetime = Field(sa_column=Column('created_at', DateTime(True), server_default=text('now()')))
    name: str = Field(sa_column=Column('name', Text))
    short_name: str = Field(sa_column=Column('short_name', Text))
    description: str = Field(sa_column=Column('description', Text))
    points: int = Field(sa_column=Column('points', Integer))
    pass_points: int = Field(sa_column=Column('pass_points', Integer))
    rubric_id: Mapped[uuid.UUID] = Field(sa_column=Column('rubric_id', Uuid(as_uuid=True)))

    rubric: Optional['Rubrics'] = Relationship(back_populates='standard_groups')
    standards: List['Standards'] = Relationship(back_populates='standard_group')


class Topics(_Base, table=True):
    __table_args__ = (
        ForeignKeyConstraint(['class_id'], ['classes.id'], ondelete='CASCADE', name='topics_class_id_fkey'),
        PrimaryKeyConstraint('id', name='topics_pkey')
    )

    id: Mapped[uuid.UUID] = Field(sa_column=Column('id', Uuid, primary_key=True, server_default=text('gen_random_uuid()')))
    created_at: datetime = Field(sa_column=Column('created_at', DateTime(True), server_default=text('now()')))
    updated_at: datetime = Field(sa_column=Column('updated_at', DateTime(True), server_default=text('now()')))
    name: str = Field(sa_column=Column('name', Text))
    description: str = Field(sa_column=Column('description', Text))
    prerequisite: bool = Field(sa_column=Column('prerequisite', Boolean, server_default=text('false')))
    class_id: Mapped[uuid.UUID] = Field(sa_column=Column('class_id', Uuid(as_uuid=True)))

    class_: Optional['Classes'] = Relationship(back_populates='topics')


class AssistantChats(_Base, table=True):
    __tablename__ = 'assistant_chats'
    __table_args__ = (
        ForeignKeyConstraint(['profile_id'], ['profiles.id'], name='assistant_chats_profile_id_fkey'),
        PrimaryKeyConstraint('id', name='assistant_chats_pkey')
    )

    id: Mapped[uuid.UUID] = Field(sa_column=Column('id', Uuid, primary_key=True, server_default=text('gen_random_uuid()')))
    created_at: datetime = Field(sa_column=Column('created_at', DateTime(True), server_default=text('now()')))
    updated_at: datetime = Field(sa_column=Column('updated_at', DateTime(True), server_default=text('now()')))
    title: str = Field(sa_column=Column('title', Text))
    profile_id: Mapped[uuid.UUID] = Field(sa_column=Column('profile_id', Uuid(as_uuid=True)))
    trace_id: Optional[str] = Field(default=None, sa_column=Column('trace_id', Text))

    profile: Optional['Profiles'] = Relationship(back_populates='assistant_chats')
    assistant_messages: List['AssistantMessages'] = Relationship(back_populates='chat')
    assistant_tool_calls: List['AssistantToolCalls'] = Relationship(back_populates='chat')


class Dashboards(_Base, table=True):
    __table_args__ = (
        ForeignKeyConstraint(['profile_id'], ['profiles.id'], ondelete='CASCADE', name='dashboards_profile_id_fkey'),
        PrimaryKeyConstraint('id', name='dashboards_pkey')
    )

    id: Mapped[uuid.UUID] = Field(sa_column=Column('id', Uuid, primary_key=True, server_default=text('gen_random_uuid()')))
    created_at: datetime = Field(sa_column=Column('created_at', DateTime(True), server_default=text('now()')))
    updated_at: datetime = Field(sa_column=Column('updated_at', DateTime(True), server_default=text('now()')))
    header_component_ids: List[uuid.UUID] = Field(sa_column=Column('header_component_ids', ARRAY(Uuid(as_uuid=True)), server_default=text('ARRAY[]::uuid[]')))
    primary_component_ids: List[uuid.UUID] = Field(sa_column=Column('primary_component_ids', ARRAY(Uuid(as_uuid=True)), server_default=text('ARRAY[]::uuid[]')))
    secondary_component_ids: List[uuid.UUID] = Field(sa_column=Column('secondary_component_ids', ARRAY(Uuid(as_uuid=True)), server_default=text('ARRAY[]::uuid[]')))
    footer_component_ids: List[uuid.UUID] = Field(sa_column=Column('footer_component_ids', ARRAY(Uuid(as_uuid=True)), server_default=text('ARRAY[]::uuid[]')))
    auto_scroll: bool = Field(sa_column=Column('auto_scroll', Boolean, server_default=text('true')))
    show_indicators: bool = Field(sa_column=Column('show_indicators', Boolean, server_default=text('true')))
    header_components: int = Field(sa_column=Column('header_components', Integer, server_default=text('4')))
    main_split: float = Field(sa_column=Column('main_split', Double(53), server_default=text('0.65')))
    footer_split: float = Field(sa_column=Column('footer_split', Double(53), server_default=text('0.5')))
    profile_id: Optional[uuid.UUID] = Field(default=None, sa_column=Column('profile_id', Uuid(as_uuid=True)))

    profile: Optional['Profiles'] = Relationship(back_populates='dashboards')


class Events(_Base, table=True):
    __table_args__ = (
        ForeignKeyConstraint(['schedule_id'], ['schedules.id'], ondelete='CASCADE', name='events_schedule_id_fkey'),
        PrimaryKeyConstraint('id', name='events_pkey')
    )

    id: Mapped[uuid.UUID] = Field(sa_column=Column('id', Uuid, primary_key=True, server_default=text('gen_random_uuid()')))
    created_at: datetime = Field(sa_column=Column('created_at', DateTime(True), server_default=text('now()')))
    updated_at: datetime = Field(sa_column=Column('updated_at', DateTime(True), server_default=text('now()')))
    name: str = Field(sa_column=Column('name', Text))
    description: str = Field(sa_column=Column('description', Text))
    time: datetime = Field(sa_column=Column('time', DateTime(True)))
    schedule_id: Mapped[uuid.UUID] = Field(sa_column=Column('schedule_id', Uuid(as_uuid=True)))
    document_type: Optional[str] = Field(default=None, sa_column=Column('document_type', Enum('homework', 'project', 'quiz', 'midterm', 'lab', 'lecture', 'syllabus', name='document_type')))

    schedule: Optional['Schedules'] = Relationship(back_populates='events')


class Scenarios(_Base, table=True):
    __table_args__ = (
        ForeignKeyConstraint(['agent_id'], ['agents.id'], ondelete='SET NULL', name='scenarios_agent_id_fkey'),
        ForeignKeyConstraint(['class_id'], ['classes.id'], ondelete='SET NULL', name='scenarios_class_id_fkey'),
        PrimaryKeyConstraint('id', name='scenarios_pkey')
    )

    id: Mapped[uuid.UUID] = Field(sa_column=Column('id', Uuid, primary_key=True, server_default=text('gen_random_uuid()')))
    created_at: datetime = Field(sa_column=Column('created_at', DateTime(True), server_default=text('now()')))
    updated_at: datetime = Field(sa_column=Column('updated_at', DateTime(True), server_default=text('now()')))
    name: str = Field(sa_column=Column('name', Text))
    description: str = Field(sa_column=Column('description', Text))
    default_scenario: bool = Field(sa_column=Column('default_scenario', Boolean, server_default=text('false')))
    agent_id: Optional[uuid.UUID] = Field(default=None, sa_column=Column('agent_id', Uuid(as_uuid=True)))
    class_id: Optional[uuid.UUID] = Field(default=None, sa_column=Column('class_id', Uuid(as_uuid=True)))
    crowdedness: Optional[int] = Field(default=None, sa_column=Column('crowdedness', Integer))
    intensity: Optional[int] = Field(default=None, sa_column=Column('intensity', Integer))
    seniority: Optional[str] = Field(default=None, sa_column=Column('seniority', Enum('freshman', 'sophomore', 'junior', 'senior', name='seniority_levels')))
    documents: Optional[List[uuid.UUID]] = Field(default=None, sa_column=Column('documents', ARRAY(Uuid(as_uuid=True))))

    agent: Optional['Agents'] = Relationship(back_populates='scenarios')
    class_: Optional['Classes'] = Relationship(back_populates='scenarios')
    simulation_chats: List['SimulationChats'] = Relationship(back_populates='scenario')


class SimulationAttempts(_Base, table=True):
    __tablename__ = 'simulation_attempts'
    __table_args__ = (
        ForeignKeyConstraint(['profile_id'], ['profiles.id'], ondelete='CASCADE', name='simulation_attempts_profile_id_fkey'),
        ForeignKeyConstraint(['simulation_id'], ['simulations.id'], ondelete='CASCADE', name='simulation_attempts_simulation_id_fkey'),
        PrimaryKeyConstraint('id', name='simulation_attempts_pkey')
    )

    id: Mapped[uuid.UUID] = Field(sa_column=Column('id', Uuid, primary_key=True, server_default=text('gen_random_uuid()')))
    created_at: datetime = Field(sa_column=Column('created_at', DateTime(True), server_default=text('now()')))
    simulation_id: Mapped[uuid.UUID] = Field(sa_column=Column('simulation_id', Uuid(as_uuid=True)))
    profile_id: Optional[uuid.UUID] = Field(default=None, sa_column=Column('profile_id', Uuid(as_uuid=True)))

    profile: Optional['Profiles'] = Relationship(back_populates='simulation_attempts')
    simulation: Optional['Simulations'] = Relationship(back_populates='simulation_attempts')
    simulation_chats: List['SimulationChats'] = Relationship(back_populates='attempt')


class Standards(_Base, table=True):
    __table_args__ = (
        ForeignKeyConstraint(['standard_group_id'], ['standard_groups.id'], ondelete='CASCADE', name='standards_standard_group_id_fkey'),
        PrimaryKeyConstraint('id', name='standards_pkey')
    )

    id: Mapped[uuid.UUID] = Field(sa_column=Column('id', Uuid, primary_key=True, server_default=text('gen_random_uuid()')))
    created_at: datetime = Field(sa_column=Column('created_at', DateTime(True), server_default=text('now()')))
    name: str = Field(sa_column=Column('name', Text))
    description: str = Field(sa_column=Column('description', Text))
    points: int = Field(sa_column=Column('points', Integer))
    standard_group_id: Mapped[uuid.UUID] = Field(sa_column=Column('standard_group_id', Uuid(as_uuid=True)))

    standard_group: Optional['StandardGroups'] = Relationship(back_populates='standards')
    simulation_chat_feedbacks: List['SimulationChatFeedbacks'] = Relationship(back_populates='standard')


class AssistantMessages(_Base, table=True):
    __tablename__ = 'assistant_messages'
    __table_args__ = (
        ForeignKeyConstraint(['chat_id'], ['assistant_chats.id'], name='assistant_messages_chat_id_fkey'),
        PrimaryKeyConstraint('id', name='assistant_messages_pkey')
    )

    id: Mapped[uuid.UUID] = Field(sa_column=Column('id', Uuid, primary_key=True, server_default=text('gen_random_uuid()')))
    created_at: datetime = Field(sa_column=Column('created_at', DateTime(True), server_default=text('now()')))
    updated_at: datetime = Field(sa_column=Column('updated_at', DateTime(True), server_default=text('now()')))
    chat_id: Mapped[uuid.UUID] = Field(sa_column=Column('chat_id', Uuid(as_uuid=True)))
    role: str = Field(sa_column=Column('role', Enum('user', 'assistant', name='assistant_message_type')))
    content: str = Field(sa_column=Column('content', Text))
    completed: bool = Field(sa_column=Column('completed', Boolean, server_default=text('false')))
    completed_at: Optional[datetime] = Field(default=None, sa_column=Column('completed_at', DateTime(True)))

    chat: Optional['AssistantChats'] = Relationship(back_populates='assistant_messages')


class AssistantToolCalls(_Base, table=True):
    __tablename__ = 'assistant_tool_calls'
    __table_args__ = (
        ForeignKeyConstraint(['chat_id'], ['assistant_chats.id'], name='assistant_tool_calls_chat_id_fkey'),
        PrimaryKeyConstraint('id', name='assistant_tool_calls_pkey')
    )

    id: Mapped[uuid.UUID] = Field(sa_column=Column('id', Uuid, primary_key=True, server_default=text('gen_random_uuid()')))
    created_at: datetime = Field(sa_column=Column('created_at', DateTime(True), server_default=text('now()')))
    updated_at: datetime = Field(sa_column=Column('updated_at', DateTime(True), server_default=text('now()')))
    chat_id: Mapped[uuid.UUID] = Field(sa_column=Column('chat_id', Uuid(as_uuid=True)))
    tool_name: str = Field(sa_column=Column('tool_name', Text))
    tool_type: str = Field(sa_column=Column('tool_type', Enum('create', 'read', 'update', 'delete', name='assistant_tool_type')))
    tool_arguments: Dict[str, Any] = Field(sa_column=Column('tool_arguments', JSONB))
    tool_result: Dict[str, Any] = Field(sa_column=Column('tool_result', JSONB))
    completed: bool = Field(sa_column=Column('completed', Boolean, server_default=text('false')))
    completed_at: Optional[datetime] = Field(default=None, sa_column=Column('completed_at', DateTime(True)))

    chat: Optional['AssistantChats'] = Relationship(back_populates='assistant_tool_calls')


class SimulationChats(_Base, table=True):
    __tablename__ = 'simulation_chats'
    __table_args__ = (
        ForeignKeyConstraint(['attempt_id'], ['simulation_attempts.id'], ondelete='CASCADE', name='simulation_chats_attempt_id_fkey'),
        ForeignKeyConstraint(['scenario_id'], ['scenarios.id'], ondelete='CASCADE', name='simulation_chats_scenario_id_fkey'),
        PrimaryKeyConstraint('id', name='simulation_chats_pkey')
    )

    id: Mapped[uuid.UUID] = Field(sa_column=Column('id', Uuid, primary_key=True, server_default=text('gen_random_uuid()')))
    created_at: datetime = Field(sa_column=Column('created_at', DateTime(True), server_default=text('now()')))
    updated_at: datetime = Field(sa_column=Column('updated_at', DateTime(True), server_default=text('now()')))
    title: str = Field(sa_column=Column('title', Text))
    scenario_id: Mapped[uuid.UUID] = Field(sa_column=Column('scenario_id', Uuid(as_uuid=True)))
    attempt_id: Mapped[uuid.UUID] = Field(sa_column=Column('attempt_id', Uuid(as_uuid=True)))
    completed: bool = Field(sa_column=Column('completed', Boolean, server_default=text('false')))
    completed_at: Optional[datetime] = Field(default=None, sa_column=Column('completed_at', DateTime(True)))
    trace_id: Optional[str] = Field(default=None, sa_column=Column('trace_id', Text))

    attempt: Optional['SimulationAttempts'] = Relationship(back_populates='simulation_chats')
    scenario: Optional['Scenarios'] = Relationship(back_populates='simulation_chats')
    simulation_chat_grades: List['SimulationChatGrades'] = Relationship(back_populates='simulation_chat')
    simulation_messages: List['SimulationMessages'] = Relationship(back_populates='chat')


class SimulationChatGrades(_Base, table=True):
    __tablename__ = 'simulation_chat_grades'
    __table_args__ = (
        ForeignKeyConstraint(['rubric_id'], ['rubrics.id'], ondelete='CASCADE', name='simulation_chat_grades_rubric_id_fkey'),
        ForeignKeyConstraint(['simulation_chat_id'], ['simulation_chats.id'], ondelete='CASCADE', name='simulation_chat_grades_simulation_chat_id_fkey'),
        PrimaryKeyConstraint('id', name='simulation_chat_grades_pkey')
    )

    id: Mapped[uuid.UUID] = Field(sa_column=Column('id', Uuid, primary_key=True, server_default=text('gen_random_uuid()')))
    created_at: datetime = Field(sa_column=Column('created_at', DateTime(True), server_default=text('now()')))
    passed: bool = Field(sa_column=Column('passed', Boolean))
    score: int = Field(sa_column=Column('score', Integer))
    time_taken: int = Field(sa_column=Column('time_taken', Integer))
    rubric_id: Mapped[uuid.UUID] = Field(sa_column=Column('rubric_id', Uuid(as_uuid=True)))
    simulation_chat_id: Mapped[uuid.UUID] = Field(sa_column=Column('simulation_chat_id', Uuid(as_uuid=True)))

    rubric: Optional['Rubrics'] = Relationship(back_populates='simulation_chat_grades')
    simulation_chat: Optional['SimulationChats'] = Relationship(back_populates='simulation_chat_grades')
    simulation_chat_feedbacks: List['SimulationChatFeedbacks'] = Relationship(back_populates='simulation_chat_grade')


class SimulationMessages(_Base, table=True):
    __tablename__ = 'simulation_messages'
    __table_args__ = (
        ForeignKeyConstraint(['chat_id'], ['simulation_chats.id'], ondelete='CASCADE', name='simulation_messages_chat_id_fkey'),
        PrimaryKeyConstraint('id', name='simulation_messages_pkey')
    )

    id: Mapped[uuid.UUID] = Field(sa_column=Column('id', Uuid, primary_key=True, server_default=text('gen_random_uuid()')))
    created_at: datetime = Field(sa_column=Column('created_at', DateTime(True), server_default=text('now()')))
    updated_at: datetime = Field(sa_column=Column('updated_at', DateTime(True), server_default=text('now()')))
    chat_id: Mapped[uuid.UUID] = Field(sa_column=Column('chat_id', Uuid(as_uuid=True)))
    content: str = Field(sa_column=Column('content', Text))
    audio: bool = Field(sa_column=Column('audio', Boolean, server_default=text('false')))
    type: str = Field(sa_column=Column('type', Enum('query', 'response', name='simulation_message_type')))
    completed: bool = Field(sa_column=Column('completed', Boolean, server_default=text('false')))
    file_path: Optional[str] = Field(default=None, sa_column=Column('file_path', Text))

    chat: Optional['SimulationChats'] = Relationship(back_populates='simulation_messages')


class SimulationChatFeedbacks(_Base, table=True):
    __tablename__ = 'simulation_chat_feedbacks'
    __table_args__ = (
        ForeignKeyConstraint(['simulation_chat_grade_id'], ['simulation_chat_grades.id'], ondelete='CASCADE', name='simulation_chat_feedbacks_simulation_chat_grade_id_fkey'),
        ForeignKeyConstraint(['standard_id'], ['standards.id'], ondelete='CASCADE', name='simulation_chat_feedbacks_standard_id_fkey'),
        PrimaryKeyConstraint('id', name='simulation_chat_feedbacks_pkey')
    )

    id: Mapped[uuid.UUID] = Field(sa_column=Column('id', Uuid, primary_key=True, server_default=text('gen_random_uuid()')))
    created_at: datetime = Field(sa_column=Column('created_at', DateTime(True), server_default=text('now()')))
    standard_id: Mapped[uuid.UUID] = Field(sa_column=Column('standard_id', Uuid(as_uuid=True)))
    simulation_chat_grade_id: Mapped[uuid.UUID] = Field(sa_column=Column('simulation_chat_grade_id', Uuid(as_uuid=True)))
    total: int = Field(sa_column=Column('total', Integer))
    feedback: Optional[str] = Field(default=None, sa_column=Column('feedback', Text))

    simulation_chat_grade: Optional['SimulationChatGrades'] = Relationship(back_populates='simulation_chat_feedbacks')
    standard: Optional['Standards'] = Relationship(back_populates='simulation_chat_feedbacks')
