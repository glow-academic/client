import uuid
from datetime import datetime, time, timezone
from typing import Any, Dict, List, Optional

from sqlalchemy import (ARRAY, BigInteger, Boolean, Column, DateTime,
                        Enum, ForeignKeyConstraint, Integer,
                        PrimaryKeyConstraint, String, Text, Uuid, text, Double, Time)
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
    created_at: Optional[datetime] = Field(default_factory=lambda: datetime.now(timezone.utc), sa_column=Column('created_at', DateTime(True)))


class Cohorts(_Base, table=True):
    __table_args__ = (
        PrimaryKeyConstraint('id', name='cohorts_pkey'),
    )

    id: Mapped[uuid.UUID] = Field(default_factory=uuid.uuid4, sa_column=Column('id', Uuid, primary_key=True))
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), sa_column=Column('created_at', DateTime(True)))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), sa_column=Column('updated_at', DateTime(True)))
    title: str = Field(sa_column=Column('title', Text))
    active: bool = Field(sa_column=Column('active', Boolean, default=True))
    profile_ids: List[uuid.UUID] = Field(default_factory=list, sa_column=Column('profile_ids', ARRAY(Uuid(as_uuid=True))))
    default_cohort: bool = Field(sa_column=Column('default_cohort', Boolean, default=False))
    simulation_ids: List[uuid.UUID] = Field(default_factory=list, sa_column=Column('simulation_ids', ARRAY(Uuid(as_uuid=True))))
    description: Optional[str] = Field(default=None, sa_column=Column('description', Text))


class Documents(_Base, table=True):
    __table_args__ = (
        PrimaryKeyConstraint('id', name='documents_pkey'),
    )

    id: Mapped[uuid.UUID] = Field(default_factory=uuid.uuid4, sa_column=Column('id', Uuid, primary_key=True))
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), sa_column=Column('created_at', DateTime(True)))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), sa_column=Column('updated_at', DateTime(True)))
    name: str = Field(sa_column=Column('name', Text))
    file_path: str = Field(sa_column=Column('file_path', Text))
    mime_type: str = Field(sa_column=Column('mime_type', Text))
    type: str = Field(sa_column=Column('type', Enum('homework', 'project', 'quiz', 'midterm', 'lab', 'lecture', 'syllabus', name='document_type'), default=r'homework'))
    classified: bool = Field(sa_column=Column('classified', Boolean, default=False))
    active: bool = Field(sa_column=Column('active', Boolean, default=True))
    file_id: Optional[str] = Field(default=None, sa_column=Column('file_id', Text))


class Models(_Base, table=True):
    __table_args__ = (
        PrimaryKeyConstraint('id', name='models_pkey'),
    )

    id: Mapped[uuid.UUID] = Field(default_factory=uuid.uuid4, sa_column=Column('id', Uuid, primary_key=True))
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), sa_column=Column('created_at', DateTime(True)))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), sa_column=Column('updated_at', DateTime(True)))
    name: str = Field(sa_column=Column('name', Text))
    description: str = Field(sa_column=Column('description', Text))
    provider_id: Mapped[uuid.UUID] = Field(sa_column=Column('provider_id', Uuid(as_uuid=True)))
    active: bool = Field(sa_column=Column('active', Boolean, default=True))

    agents: List['Agents'] = Relationship(back_populates='model')
    personas: List['Personas'] = Relationship(back_populates='model')


class Parameters(_Base, table=True):
    __table_args__ = (
        PrimaryKeyConstraint('id', name='parameters_pkey'),
    )

    id: Mapped[uuid.UUID] = Field(default_factory=uuid.uuid4, sa_column=Column('id', Uuid, primary_key=True))
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), sa_column=Column('created_at', DateTime(True)))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), sa_column=Column('updated_at', DateTime(True)))
    name: str = Field(sa_column=Column('name', Text))
    description: str = Field(sa_column=Column('description', Text))
    numerical: bool = Field(sa_column=Column('numerical', Boolean, default=False))
    active: bool = Field(sa_column=Column('active', Boolean, default=False))

    parameter_items: List['ParameterItems'] = Relationship(back_populates='parameter')


class Providers(_Base, table=True):
    __table_args__ = (
        PrimaryKeyConstraint('id', name='providers_pkey'),
    )

    id: Mapped[uuid.UUID] = Field(default_factory=uuid.uuid4, sa_column=Column('id', Uuid, primary_key=True))
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), sa_column=Column('created_at', DateTime(True)))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), sa_column=Column('updated_at', DateTime(True)))
    name: str = Field(sa_column=Column('name', Text))
    description: str = Field(sa_column=Column('description', Text))
    api_key: str = Field(sa_column=Column('api_key', Text))
    base_url: Optional[str] = Field(default=None, sa_column=Column('base_url', Text))


class Rubrics(_Base, table=True):
    __table_args__ = (
        PrimaryKeyConstraint('id', name='rubrics_pkey'),
    )

    id: Mapped[uuid.UUID] = Field(default_factory=uuid.uuid4, sa_column=Column('id', Uuid, primary_key=True))
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), sa_column=Column('created_at', DateTime(True)))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), sa_column=Column('updated_at', DateTime(True)))
    name: str = Field(sa_column=Column('name', Text))
    description: str = Field(sa_column=Column('description', Text))
    points: int = Field(sa_column=Column('points', Integer))
    pass_points: int = Field(sa_column=Column('pass_points', Integer))
    default_rubric: bool = Field(sa_column=Column('default_rubric', Boolean, default=False))
    active: bool = Field(sa_column=Column('active', Boolean, default=True))

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

    id: Mapped[uuid.UUID] = Field(default_factory=uuid.uuid4, sa_column=Column('id', Uuid, primary_key=True))
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), sa_column=Column('created_at', DateTime(True)))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), sa_column=Column('updated_at', DateTime(True)))
    name: str = Field(sa_column=Column('name', Text))
    description: str = Field(sa_column=Column('description', Text))
    system_prompt: str = Field(sa_column=Column('system_prompt', Text))
    temperature: int = Field(sa_column=Column('temperature', Integer))
    model_id: Optional[uuid.UUID] = Field(default=None, sa_column=Column('model_id', Uuid(as_uuid=True)))
    reasoning: Optional[str] = Field(default=None, sa_column=Column('reasoning', Enum('low', 'medium', 'high', name='reasoning_effort')))

    model: Optional['Models'] = Relationship(back_populates='agents')


class ParameterItems(_Base, table=True):
    __tablename__ = 'parameter_items'
    __table_args__ = (
        ForeignKeyConstraint(['parameter_id'], ['parameters.id'], ondelete='CASCADE', name='parameter_items_parameter_id_fkey'),
        PrimaryKeyConstraint('id', name='parameter_items_pkey')
    )

    id: Mapped[uuid.UUID] = Field(default_factory=uuid.uuid4, sa_column=Column('id', Uuid, primary_key=True))
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), sa_column=Column('created_at', DateTime(True)))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), sa_column=Column('updated_at', DateTime(True)))
    name: str = Field(sa_column=Column('name', Text))
    description: str = Field(sa_column=Column('description', Text))
    value: str = Field(sa_column=Column('value', Text))
    parameter_id: Mapped[uuid.UUID] = Field(sa_column=Column('parameter_id', Uuid(as_uuid=True)))
    default_item: bool = Field(sa_column=Column('default_item', Boolean, default=False))

    parameter: Optional['Parameters'] = Relationship(back_populates='parameter_items')


class Personas(_Base, table=True):
    __table_args__ = (
        ForeignKeyConstraint(['model_id'], ['models.id'], name='personas_model_id_fkey'),
        PrimaryKeyConstraint('id', name='personas_pkey')
    )

    id: Mapped[uuid.UUID] = Field(default_factory=uuid.uuid4, sa_column=Column('id', Uuid, primary_key=True))
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), sa_column=Column('created_at', DateTime(True)))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), sa_column=Column('updated_at', DateTime(True)))
    name: str = Field(sa_column=Column('name', Text))
    description: str = Field(sa_column=Column('description', Text))
    system_prompt: str = Field(sa_column=Column('system_prompt', Text))
    temperature: int = Field(sa_column=Column('temperature', Integer))
    default_persona: bool = Field(sa_column=Column('default_persona', Boolean, default=False))
    color: str = Field(sa_column=Column('color', Text))
    icon: str = Field(sa_column=Column('icon', Text))
    active: bool = Field(sa_column=Column('active', Boolean, default=False))
    model_id: Optional[uuid.UUID] = Field(default=None, sa_column=Column('model_id', Uuid(as_uuid=True)))
    reasoning: Optional[str] = Field(default=None, sa_column=Column('reasoning', Enum('low', 'medium', 'high', name='reasoning_effort')))

    model: Optional['Models'] = Relationship(back_populates='personas')
    scenarios: List['Scenarios'] = Relationship(back_populates='persona')


class Profiles(_Base, table=True):
    __table_args__ = (
        ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE', name='profiles_user_id_fkey'),
        PrimaryKeyConstraint('id', name='profiles_pkey')
    )

    id: Mapped[uuid.UUID] = Field(default_factory=uuid.uuid4, sa_column=Column('id', Uuid, primary_key=True))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), sa_column=Column('updated_at', DateTime(True)))
    last_login: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), sa_column=Column('last_login', DateTime(True)))
    first_name: str = Field(sa_column=Column('first_name', Text))
    last_name: str = Field(sa_column=Column('last_name', Text))
    alias: str = Field(sa_column=Column('alias', Text))
    viewed_intro: bool = Field(sa_column=Column('viewed_intro', Boolean, default=False))
    viewed_chat: bool = Field(sa_column=Column('viewed_chat', Boolean, default=False))
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), sa_column=Column('created_at', DateTime(True)))
    role: str = Field(sa_column=Column('role', Enum('superadmin', 'admin', 'instructional', 'ta', 'guest', name='profile_role'), default=r'guest'))
    default_profile: bool = Field(sa_column=Column('default_profile', Boolean, default=False))
    active: bool = Field(sa_column=Column('active', Boolean, default=False))
    last_active: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), sa_column=Column('last_active', DateTime(True)))
    user_id: Optional[int] = Field(default=None, sa_column=Column('user_id', Integer))

    user: Optional['Users'] = Relationship(back_populates='profiles')
    app_feedback: List['AppFeedback'] = Relationship(back_populates='profile')
    assistant_chats: List['AssistantChats'] = Relationship(back_populates='profile')
    simulation_attempts: List['SimulationAttempts'] = Relationship(back_populates='profile')


class Simulations(_Base, table=True):
    __table_args__ = (
        ForeignKeyConstraint(['rubric_id'], ['rubrics.id'], ondelete='CASCADE', name='simulations_rubric_id_fkey'),
        PrimaryKeyConstraint('id', name='simulations_pkey')
    )

    id: Mapped[uuid.UUID] = Field(default_factory=uuid.uuid4, sa_column=Column('id', Uuid, primary_key=True))
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), sa_column=Column('created_at', DateTime(True)))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), sa_column=Column('updated_at', DateTime(True)))
    title: str = Field(sa_column=Column('title', Text))
    active: bool = Field(sa_column=Column('active', Boolean, default=True))
    scenario_ids: List[uuid.UUID] = Field(default_factory=list, sa_column=Column('scenario_ids', ARRAY(Uuid(as_uuid=True))))
    rubric_id: Mapped[uuid.UUID] = Field(sa_column=Column('rubric_id', Uuid(as_uuid=True)))
    default_simulation: bool = Field(sa_column=Column('default_simulation', Boolean, default=False))
    practice_simulation: bool = Field(sa_column=Column('practice_simulation', Boolean, default=False))
    time_limit: Optional[int] = Field(default=None, sa_column=Column('time_limit', Integer))

    rubric: Optional['Rubrics'] = Relationship(back_populates='simulations')
    simulation_attempts: List['SimulationAttempts'] = Relationship(back_populates='simulation')


class StandardGroups(_Base, table=True):
    __tablename__ = 'standard_groups'
    __table_args__ = (
        ForeignKeyConstraint(['rubric_id'], ['rubrics.id'], ondelete='CASCADE', name='standard_groups_rubric_id_fkey'),
        PrimaryKeyConstraint('id', name='standard_groups_pkey')
    )

    id: Mapped[uuid.UUID] = Field(default_factory=uuid.uuid4, sa_column=Column('id', Uuid, primary_key=True))
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), sa_column=Column('created_at', DateTime(True)))
    name: str = Field(sa_column=Column('name', Text))
    short_name: str = Field(sa_column=Column('short_name', Text))
    description: str = Field(sa_column=Column('description', Text))
    points: int = Field(sa_column=Column('points', Integer))
    pass_points: int = Field(sa_column=Column('pass_points', Integer))
    rubric_id: Mapped[uuid.UUID] = Field(sa_column=Column('rubric_id', Uuid(as_uuid=True)))

    rubric: Optional['Rubrics'] = Relationship(back_populates='standard_groups')
    standards: List['Standards'] = Relationship(back_populates='standard_group')


class AppFeedback(_Base, table=True):
    __tablename__ = 'app_feedback'
    __table_args__ = (
        ForeignKeyConstraint(['profile_id'], ['profiles.id'], ondelete='CASCADE', name='app_feedback_profile_id_fkey'),
        PrimaryKeyConstraint('id', name='app_feedback_pkey')
    )

    id: Optional[int] = Field(default=None, sa_column=Column('id', Integer, primary_key=True))
    type: str = Field(sa_column=Column('type', Enum('feature', 'bug', 'question', 'other', name='feedback_type')))
    created_at: Optional[datetime] = Field(default_factory=lambda: datetime.now(timezone.utc), sa_column=Column('created_at', DateTime(True)))
    profile_id: Optional[uuid.UUID] = Field(default=None, sa_column=Column('profile_id', Uuid(as_uuid=True)))
    message: Optional[str] = Field(default=None, sa_column=Column('message', Text))

    profile: Optional['Profiles'] = Relationship(back_populates='app_feedback')


class AssistantChats(_Base, table=True):
    __tablename__ = 'assistant_chats'
    __table_args__ = (
        ForeignKeyConstraint(['profile_id'], ['profiles.id'], name='assistant_chats_profile_id_fkey'),
        PrimaryKeyConstraint('id', name='assistant_chats_pkey')
    )

    id: Mapped[uuid.UUID] = Field(default_factory=uuid.uuid4, sa_column=Column('id', Uuid, primary_key=True))
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), sa_column=Column('created_at', DateTime(True)))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), sa_column=Column('updated_at', DateTime(True)))
    title: str = Field(sa_column=Column('title', Text))
    profile_id: Mapped[uuid.UUID] = Field(sa_column=Column('profile_id', Uuid(as_uuid=True)))
    trace_id: Optional[str] = Field(default=None, sa_column=Column('trace_id', Text))

    profile: Optional['Profiles'] = Relationship(back_populates='assistant_chats')
    assistant_messages: List['AssistantMessages'] = Relationship(back_populates='chat')
    assistant_tool_calls: List['AssistantToolCalls'] = Relationship(back_populates='chat')


class Scenarios(_Base, table=True):
    __table_args__ = (
        ForeignKeyConstraint(['persona_id'], ['personas.id'], ondelete='SET NULL', name='scenarios_persona_id_fkey'),
        PrimaryKeyConstraint('id', name='scenarios_pkey')
    )

    id: Mapped[uuid.UUID] = Field(default_factory=uuid.uuid4, sa_column=Column('id', Uuid, primary_key=True))
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), sa_column=Column('created_at', DateTime(True)))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), sa_column=Column('updated_at', DateTime(True)))
    name: str = Field(sa_column=Column('name', Text))
    description: str = Field(sa_column=Column('description', Text))
    default_scenario: bool = Field(sa_column=Column('default_scenario', Boolean, default=False))
    practice_scenario: bool = Field(sa_column=Column('practice_scenario', Boolean, default=False))
    generated: bool = Field(sa_column=Column('generated', Boolean, default=False))
    active: bool = Field(sa_column=Column('active', Boolean, default=True))
    persona_id: Optional[uuid.UUID] = Field(default=None, sa_column=Column('persona_id', Uuid(as_uuid=True)))
    parameter_item_ids: Optional[List[uuid.UUID]] = Field(default=None, sa_column=Column('parameter_item_ids', ARRAY(Uuid(as_uuid=True))))
    document_ids: Optional[List[uuid.UUID]] = Field(default=None, sa_column=Column('document_ids', ARRAY(Uuid(as_uuid=True))))
    parent_id: Optional[uuid.UUID] = Field(default=None, sa_column=Column('parent_id', Uuid(as_uuid=True)))

    persona: Optional['Personas'] = Relationship(back_populates='scenarios')
    simulation_chats: List['SimulationChats'] = Relationship(back_populates='scenario')


class SimulationAttempts(_Base, table=True):
    __tablename__ = 'simulation_attempts'
    __table_args__ = (
        ForeignKeyConstraint(['profile_id'], ['profiles.id'], ondelete='CASCADE', name='simulation_attempts_profile_id_fkey'),
        ForeignKeyConstraint(['simulation_id'], ['simulations.id'], ondelete='CASCADE', name='simulation_attempts_simulation_id_fkey'),
        PrimaryKeyConstraint('id', name='simulation_attempts_pkey')
    )

    id: Mapped[uuid.UUID] = Field(default_factory=uuid.uuid4, sa_column=Column('id', Uuid, primary_key=True))
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), sa_column=Column('created_at', DateTime(True)))
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

    id: Mapped[uuid.UUID] = Field(default_factory=uuid.uuid4, sa_column=Column('id', Uuid, primary_key=True))
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), sa_column=Column('created_at', DateTime(True)))
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

    id: Mapped[uuid.UUID] = Field(default_factory=uuid.uuid4, sa_column=Column('id', Uuid, primary_key=True))
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), sa_column=Column('created_at', DateTime(True)))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), sa_column=Column('updated_at', DateTime(True)))
    chat_id: Mapped[uuid.UUID] = Field(sa_column=Column('chat_id', Uuid(as_uuid=True)))
    role: str = Field(sa_column=Column('role', Enum('user', 'assistant', name='assistant_message_type')))
    content: str = Field(sa_column=Column('content', Text))
    completed: bool = Field(sa_column=Column('completed', Boolean, default=False))
    completed_at: Optional[datetime] = Field(default=None, sa_column=Column('completed_at', DateTime(True)))

    chat: Optional['AssistantChats'] = Relationship(back_populates='assistant_messages')


class AssistantToolCalls(_Base, table=True):
    __tablename__ = 'assistant_tool_calls'
    __table_args__ = (
        ForeignKeyConstraint(['chat_id'], ['assistant_chats.id'], name='assistant_tool_calls_chat_id_fkey'),
        PrimaryKeyConstraint('id', name='assistant_tool_calls_pkey')
    )

    id: Mapped[uuid.UUID] = Field(default_factory=uuid.uuid4, sa_column=Column('id', Uuid, primary_key=True))
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), sa_column=Column('created_at', DateTime(True)))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), sa_column=Column('updated_at', DateTime(True)))
    chat_id: Mapped[uuid.UUID] = Field(sa_column=Column('chat_id', Uuid(as_uuid=True)))
    tool_name: str = Field(sa_column=Column('tool_name', Text))
    tool_type: str = Field(sa_column=Column('tool_type', Enum('create', 'read', 'update', 'delete', name='assistant_tool_type')))
    tool_arguments: Dict[str, Any] = Field(sa_column=Column('tool_arguments', JSONB))
    tool_result: Dict[str, Any] = Field(sa_column=Column('tool_result', JSONB))
    completed: bool = Field(sa_column=Column('completed', Boolean, default=False))
    completed_at: Optional[datetime] = Field(default=None, sa_column=Column('completed_at', DateTime(True)))

    chat: Optional['AssistantChats'] = Relationship(back_populates='assistant_tool_calls')


class SimulationChats(_Base, table=True):
    __tablename__ = 'simulation_chats'
    __table_args__ = (
        ForeignKeyConstraint(['attempt_id'], ['simulation_attempts.id'], ondelete='CASCADE', name='simulation_chats_attempt_id_fkey'),
        ForeignKeyConstraint(['scenario_id'], ['scenarios.id'], ondelete='CASCADE', name='simulation_chats_scenario_id_fkey'),
        PrimaryKeyConstraint('id', name='simulation_chats_pkey')
    )

    id: Mapped[uuid.UUID] = Field(default_factory=uuid.uuid4, sa_column=Column('id', Uuid, primary_key=True))
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), sa_column=Column('created_at', DateTime(True)))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), sa_column=Column('updated_at', DateTime(True)))
    title: str = Field(sa_column=Column('title', Text))
    scenario_id: Mapped[uuid.UUID] = Field(sa_column=Column('scenario_id', Uuid(as_uuid=True)))
    attempt_id: Mapped[uuid.UUID] = Field(sa_column=Column('attempt_id', Uuid(as_uuid=True)))
    completed: bool = Field(sa_column=Column('completed', Boolean, default=False))
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

    id: Mapped[uuid.UUID] = Field(default_factory=uuid.uuid4, sa_column=Column('id', Uuid, primary_key=True))
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), sa_column=Column('created_at', DateTime(True)))
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

    id: Mapped[uuid.UUID] = Field(default_factory=uuid.uuid4, sa_column=Column('id', Uuid, primary_key=True))
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), sa_column=Column('created_at', DateTime(True)))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), sa_column=Column('updated_at', DateTime(True)))
    chat_id: Mapped[uuid.UUID] = Field(sa_column=Column('chat_id', Uuid(as_uuid=True)))
    content: str = Field(sa_column=Column('content', Text))
    type: str = Field(sa_column=Column('type', Enum('query', 'response', name='simulation_message_type')))
    completed: bool = Field(sa_column=Column('completed', Boolean, default=False))

    chat: Optional['SimulationChats'] = Relationship(back_populates='simulation_messages')


class SimulationChatFeedbacks(_Base, table=True):
    __tablename__ = 'simulation_chat_feedbacks'
    __table_args__ = (
        ForeignKeyConstraint(['simulation_chat_grade_id'], ['simulation_chat_grades.id'], ondelete='CASCADE', name='simulation_chat_feedbacks_simulation_chat_grade_id_fkey'),
        ForeignKeyConstraint(['standard_id'], ['standards.id'], ondelete='CASCADE', name='simulation_chat_feedbacks_standard_id_fkey'),
        PrimaryKeyConstraint('id', name='simulation_chat_feedbacks_pkey')
    )

    id: Mapped[uuid.UUID] = Field(default_factory=uuid.uuid4, sa_column=Column('id', Uuid, primary_key=True))
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), sa_column=Column('created_at', DateTime(True)))
    standard_id: Mapped[uuid.UUID] = Field(sa_column=Column('standard_id', Uuid(as_uuid=True)))
    simulation_chat_grade_id: Mapped[uuid.UUID] = Field(sa_column=Column('simulation_chat_grade_id', Uuid(as_uuid=True)))
    total: int = Field(sa_column=Column('total', Integer))
    feedback: Optional[str] = Field(default=None, sa_column=Column('feedback', Text))

    simulation_chat_grade: Optional['SimulationChatGrades'] = Relationship(back_populates='simulation_chat_feedbacks')
    standard: Optional['Standards'] = Relationship(back_populates='simulation_chat_feedbacks')
