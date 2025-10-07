import uuid
from datetime import datetime, time, timezone
from typing import Any, Dict, List, Optional

from sqlalchemy import (ARRAY, BigInteger, Boolean, Column, DateTime,
                        Enum, ForeignKeyConstraint, Integer,
                        PrimaryKeyConstraint, String, Text, Uuid, text, Double, Time, REAL)
from sqlalchemy.dialects.postgresql import JSONB
from sqlmodel import Field, Relationship, SQLModel, Index
from sqlalchemy.orm import Mapped
class _Base(SQLModel):
    """Shared config so Pydantic will accept SQLAlchemy types."""
    model_config = {"arbitrary_types_allowed": True}
class Accounts(_Base, table=True):
    __table_args__ = (
        PrimaryKeyConstraint('id', name='accounts_pkey'),
    )

    id: int = Field(sa_column=Column('id', Integer, primary_key=True))
    userId: int = Field(sa_column=Column('userId', Integer, nullable=False))
    type: str = Field(sa_column=Column('type', String(255), nullable=False))
    provider: str = Field(sa_column=Column('provider', String(255), nullable=False))
    providerAccountId: str = Field(sa_column=Column('providerAccountId', String(255), nullable=False))
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

    id: int = Field(sa_column=Column('id', Integer, primary_key=True))
    event: str = Field(sa_column=Column('event', Text, nullable=False, server_default=text("'default.event'::text")))
    level: str = Field(sa_column=Column('level', Text, nullable=False, default=r'info'))
    message: Optional[str] = Field(default=None, sa_column=Column('message', Text, default=r'Default Message'))
    correlation_id: Optional[str] = Field(default=None, sa_column=Column('correlation_id', Text, server_default=text("'default.correlation'::text")))
    actor: Optional[Dict[str, Any]] = Field(default=None, sa_column=Column('actor', JSONB, server_default=text('\'{"userId": null, "profileId": null}\'::jsonb')))
    subject: Optional[Dict[str, Any]] = Field(default=None, sa_column=Column('subject', JSONB, server_default=text('\'{"entityId": null, "entityType": null}\'::jsonb')))
    metrics: Optional[Dict[str, Any]] = Field(default=None, sa_column=Column('metrics', JSONB, server_default=text('\'{"size": null, "count": null, "durationMs": null}\'::jsonb')))
    context: Optional[Dict[str, Any]] = Field(default=None, sa_column=Column('context', JSONB, server_default=text('\'{"route": null, "function": null, "component": null}\'::jsonb')))
    error: Optional[Dict[str, Any]] = Field(default=None, sa_column=Column('error', JSONB, server_default=text('\'{"code": null, "name": null, "stack": null, "message": null}\'::jsonb')))
    created_at: Optional[datetime] = Field(default_factory=lambda: datetime.now(timezone.utc), sa_column=Column('created_at', DateTime(True)))


class Departments(_Base, table=True):
    __table_args__ = (
        PrimaryKeyConstraint('id', name='departments_pkey'),
    )

    id: Mapped[uuid.UUID] = Field(default_factory=uuid.uuid4, sa_column=Column('id', Uuid, primary_key=True))
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), sa_column=Column('created_at', DateTime(True), nullable=False))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), sa_column=Column('updated_at', DateTime(True), nullable=False))
    title: str = Field(sa_column=Column('title', Text, nullable=False))
    description: str = Field(sa_column=Column('description', Text, nullable=False))
    active: bool = Field(sa_column=Column('active', Boolean, nullable=False, default=True))
    title_agent_id: Mapped[uuid.UUID] = Field(sa_column=Column('title_agent_id', Uuid, nullable=False))
    scenario_agent_id: Mapped[uuid.UUID] = Field(sa_column=Column('scenario_agent_id', Uuid, nullable=False))
    classify_agent_id: Mapped[uuid.UUID] = Field(sa_column=Column('classify_agent_id', Uuid, nullable=False))
    assistant_agent_id: Mapped[uuid.UUID] = Field(sa_column=Column('assistant_agent_id', Uuid, nullable=False))
    grade_agent_id: Mapped[uuid.UUID] = Field(sa_column=Column('grade_agent_id', Uuid, nullable=False))
    guardrail_agent_id: Mapped[uuid.UUID] = Field(sa_column=Column('guardrail_agent_id', Uuid, nullable=False))

    cohorts: list['Cohorts'] = Relationship(back_populates='department')
    documents: list['Documents'] = Relationship(back_populates='department')
    parameters: list['Parameters'] = Relationship(back_populates='department')
    profiles: list['Profiles'] = Relationship(back_populates='department')
    providers: list['Providers'] = Relationship(back_populates='department')
    rubrics: list['Rubrics'] = Relationship(back_populates='department')
    simulations: list['Simulations'] = Relationship(back_populates='department')
    personas: list['Personas'] = Relationship(back_populates='department')
    model_runs: list['ModelRuns'] = Relationship(back_populates='department')
    scenarios: list['Scenarios'] = Relationship(back_populates='department')


class Sessions(_Base, table=True):
    __table_args__ = (
        PrimaryKeyConstraint('id', name='sessions_pkey'),
    )

    id: int = Field(sa_column=Column('id', Integer, primary_key=True))
    userId: int = Field(sa_column=Column('userId', Integer, nullable=False))
    expires: datetime = Field(sa_column=Column('expires', DateTime(True), nullable=False))
    sessionToken: str = Field(sa_column=Column('sessionToken', String(255), nullable=False))


class Users(_Base, table=True):
    __table_args__ = (
        PrimaryKeyConstraint('id', name='users_pkey'),
    )

    id: int = Field(sa_column=Column('id', Integer, primary_key=True))
    name: Optional[str] = Field(default=None, sa_column=Column('name', String(255)))
    email: Optional[str] = Field(default=None, sa_column=Column('email', String(255)))
    emailVerified: Optional[datetime] = Field(default=None, sa_column=Column('emailVerified', DateTime(True)))
    image: Optional[str] = Field(default=None, sa_column=Column('image', Text))

    profiles: list['Profiles'] = Relationship(back_populates='user')


class VerificationToken(_Base, table=True):
    __tablename__ = 'verification_token'
    __table_args__ = (
        PrimaryKeyConstraint('identifier', 'token', name='verification_token_pkey'),
    )

    identifier: str = Field(sa_column=Column('identifier', Text, primary_key=True))
    expires: datetime = Field(sa_column=Column('expires', DateTime(True), nullable=False))
    token: str = Field(sa_column=Column('token', Text, primary_key=True))


class Cohorts(_Base, table=True):
    __table_args__ = (
        ForeignKeyConstraint(['department_id'], ['departments.id'], ondelete='CASCADE', name='cohorts_department_id_fkey'),
        PrimaryKeyConstraint('id', name='cohorts_pkey')
    )

    id: Mapped[uuid.UUID] = Field(default_factory=uuid.uuid4, sa_column=Column('id', Uuid, primary_key=True))
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), sa_column=Column('created_at', DateTime(True), nullable=False))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), sa_column=Column('updated_at', DateTime(True), nullable=False))
    title: str = Field(sa_column=Column('title', Text, nullable=False))
    active: bool = Field(sa_column=Column('active', Boolean, nullable=False, default=True))
    profile_ids: list[uuid.UUID] = Field(default_factory=list, sa_column=Column('profile_ids', ARRAY(Uuid(as_uuid=True)), nullable=False))
    default_cohort: bool = Field(sa_column=Column('default_cohort', Boolean, nullable=False, default=False))
    simulation_ids: list[uuid.UUID] = Field(default_factory=list, sa_column=Column('simulation_ids', ARRAY(Uuid(as_uuid=True)), nullable=False))
    department_id: Mapped[uuid.UUID] = Field(sa_column=Column('department_id', Uuid, nullable=False))
    description: Optional[str] = Field(default=None, sa_column=Column('description', Text))

    department: Optional['Departments'] = Relationship(back_populates='cohorts')


class Documents(_Base, table=True):
    __table_args__ = (
        ForeignKeyConstraint(['department_id'], ['departments.id'], ondelete='CASCADE', name='documents_department_id_fkey'),
        PrimaryKeyConstraint('id', name='documents_pkey')
    )

    id: Mapped[uuid.UUID] = Field(default_factory=uuid.uuid4, sa_column=Column('id', Uuid, primary_key=True))
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), sa_column=Column('created_at', DateTime(True), nullable=False))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), sa_column=Column('updated_at', DateTime(True), nullable=False))
    name: str = Field(sa_column=Column('name', Text, nullable=False))
    file_path: str = Field(sa_column=Column('file_path', Text, nullable=False))
    mime_type: str = Field(sa_column=Column('mime_type', Text, nullable=False))
    type: str = Field(sa_column=Column('type', Enum('homework', 'project', 'quiz', 'midterm', 'lab', 'lecture', 'syllabus', name='document_type'), nullable=False, default=r'homework'))
    classified: bool = Field(sa_column=Column('classified', Boolean, nullable=False, default=False))
    active: bool = Field(sa_column=Column('active', Boolean, nullable=False, default=True))
    tags: list[str] = Field(sa_column=Column('tags', ARRAY(Text()), nullable=False, server_default=text("'{}'::text[]")))
    department_id: Mapped[uuid.UUID] = Field(sa_column=Column('department_id', Uuid, nullable=False))
    file_id: Optional[str] = Field(default=None, sa_column=Column('file_id', Text))

    department: Optional['Departments'] = Relationship(back_populates='documents')


class Parameters(_Base, table=True):
    __table_args__ = (
        ForeignKeyConstraint(['department_id'], ['departments.id'], ondelete='CASCADE', name='parameters_department_id_fkey'),
        PrimaryKeyConstraint('id', name='parameters_pkey')
    )

    id: Mapped[uuid.UUID] = Field(default_factory=uuid.uuid4, sa_column=Column('id', Uuid, primary_key=True))
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), sa_column=Column('created_at', DateTime(True), nullable=False))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), sa_column=Column('updated_at', DateTime(True), nullable=False))
    name: str = Field(sa_column=Column('name', Text, nullable=False))
    description: str = Field(sa_column=Column('description', Text, nullable=False))
    numerical: bool = Field(sa_column=Column('numerical', Boolean, nullable=False, default=False))
    active: bool = Field(sa_column=Column('active', Boolean, nullable=False, default=False))
    default_parameter: bool = Field(sa_column=Column('default_parameter', Boolean, nullable=False, default=False))
    department_id: Mapped[uuid.UUID] = Field(sa_column=Column('department_id', Uuid, nullable=False))

    department: Optional['Departments'] = Relationship(back_populates='parameters')
    parameter_items: list['ParameterItems'] = Relationship(back_populates='parameter')


class Profiles(_Base, table=True):
    __table_args__ = (
        ForeignKeyConstraint(['department_id'], ['departments.id'], ondelete='SET NULL', name='profiles_department_id_fkey'),
        ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE', name='profiles_user_id_fkey'),
        PrimaryKeyConstraint('id', name='profiles_pkey')
    )

    id: Mapped[uuid.UUID] = Field(default_factory=uuid.uuid4, sa_column=Column('id', Uuid, primary_key=True))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), sa_column=Column('updated_at', DateTime(True), nullable=False))
    last_login: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), sa_column=Column('last_login', DateTime(True), nullable=False))
    first_name: str = Field(sa_column=Column('first_name', Text, nullable=False))
    last_name: str = Field(sa_column=Column('last_name', Text, nullable=False))
    alias: str = Field(sa_column=Column('alias', Text, nullable=False))
    viewed_intro: bool = Field(sa_column=Column('viewed_intro', Boolean, nullable=False, default=False))
    viewed_chat: bool = Field(sa_column=Column('viewed_chat', Boolean, nullable=False, default=False))
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), sa_column=Column('created_at', DateTime(True), nullable=False))
    role: str = Field(sa_column=Column('role', Enum('superadmin', 'admin', 'instructional', 'ta', 'guest', name='profile_role'), nullable=False, default=r'guest'))
    default_profile: bool = Field(sa_column=Column('default_profile', Boolean, nullable=False, default=False))
    active: bool = Field(sa_column=Column('active', Boolean, nullable=False, default=False))
    user_id: Optional[int] = Field(default=None, sa_column=Column('user_id', Integer))
    last_active: Optional[datetime] = Field(default=None, sa_column=Column('last_active', DateTime(True)))
    req_per_day: Optional[int] = Field(default=None, sa_column=Column('req_per_day', Integer))
    department_id: Optional[uuid.UUID] = Field(default=None, sa_column=Column('department_id', Uuid(as_uuid=True)))

    department: Optional['Departments'] = Relationship(back_populates='profiles')
    user: Optional['Users'] = Relationship(back_populates='profiles')
    app_feedback: list['AppFeedback'] = Relationship(back_populates='profile')
    assistant_chats: list['AssistantChats'] = Relationship(back_populates='profile')
    simulation_attempts: list['SimulationAttempts'] = Relationship(back_populates='profile')
    model_runs: list['ModelRuns'] = Relationship(back_populates='profile')
    simulation_crowdsourced_messages: list['SimulationCrowdsourcedMessages'] = Relationship(back_populates='profile')
    simulation_chat_crowdsourced_feedbacks: list['SimulationChatCrowdsourcedFeedbacks'] = Relationship(back_populates='profile')


class Providers(_Base, table=True):
    __table_args__ = (
        ForeignKeyConstraint(['department_id'], ['departments.id'], ondelete='CASCADE', name='providers_department_id_fkey'),
        PrimaryKeyConstraint('id', name='providers_pkey')
    )

    id: Mapped[uuid.UUID] = Field(default_factory=uuid.uuid4, sa_column=Column('id', Uuid, primary_key=True))
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), sa_column=Column('created_at', DateTime(True), nullable=False))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), sa_column=Column('updated_at', DateTime(True), nullable=False))
    name: str = Field(sa_column=Column('name', Text, nullable=False))
    description: str = Field(sa_column=Column('description', Text, nullable=False))
    api_key: str = Field(sa_column=Column('api_key', Text, nullable=False))
    department_id: Mapped[uuid.UUID] = Field(sa_column=Column('department_id', Uuid, nullable=False))
    base_url: Optional[str] = Field(default=None, sa_column=Column('base_url', Text))

    department: Optional['Departments'] = Relationship(back_populates='providers')
    models: list['Models'] = Relationship(back_populates='provider')


class Rubrics(_Base, table=True):
    __table_args__ = (
        ForeignKeyConstraint(['department_id'], ['departments.id'], ondelete='CASCADE', name='rubrics_department_id_fkey'),
        PrimaryKeyConstraint('id', name='rubrics_pkey'),
        Index('rubrics_id_idx', 'id')
    )

    id: Mapped[uuid.UUID] = Field(default_factory=uuid.uuid4, sa_column=Column('id', Uuid, primary_key=True))
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), sa_column=Column('created_at', DateTime(True), nullable=False))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), sa_column=Column('updated_at', DateTime(True), nullable=False))
    name: str = Field(sa_column=Column('name', Text, nullable=False))
    description: str = Field(sa_column=Column('description', Text, nullable=False))
    points: int = Field(sa_column=Column('points', Integer, nullable=False))
    pass_points: int = Field(sa_column=Column('pass_points', Integer, nullable=False))
    default_rubric: bool = Field(sa_column=Column('default_rubric', Boolean, nullable=False, default=False))
    active: bool = Field(sa_column=Column('active', Boolean, nullable=False, default=True))
    department_id: Mapped[uuid.UUID] = Field(sa_column=Column('department_id', Uuid, nullable=False))

    department: Optional['Departments'] = Relationship(back_populates='rubrics')
    simulations: list['Simulations'] = Relationship(back_populates='rubric')
    standard_groups: list['StandardGroups'] = Relationship(back_populates='rubric')
    simulation_chat_grades: list['SimulationChatGrades'] = Relationship(back_populates='rubric')


class AppFeedback(_Base, table=True):
    __tablename__ = 'app_feedback'
    __table_args__ = (
        ForeignKeyConstraint(['profile_id'], ['profiles.id'], ondelete='CASCADE', name='app_feedback_profile_id_fkey'),
        PrimaryKeyConstraint('id', name='app_feedback_pkey')
    )

    id: int = Field(sa_column=Column('id', Integer, primary_key=True))
    type: str = Field(sa_column=Column('type', Enum('feature', 'bug', 'question', 'other', name='feedback_type'), nullable=False))
    created_at: Optional[datetime] = Field(default_factory=lambda: datetime.now(timezone.utc), sa_column=Column('created_at', DateTime(True)))
    profile_id: Optional[uuid.UUID] = Field(default=None, sa_column=Column('profile_id', Uuid(as_uuid=True)))
    message: Optional[str] = Field(default=None, sa_column=Column('message', Text))

    profile: Optional['Profiles'] = Relationship(back_populates='app_feedback')


class AssistantChats(_Base, table=True):
    __tablename__ = 'assistant_chats'
    __table_args__ = (
        ForeignKeyConstraint(['profile_id'], ['profiles.id'], ondelete='CASCADE', name='assistant_chats_profile_id_fkey'),
        PrimaryKeyConstraint('id', name='assistant_chats_pkey')
    )

    id: Mapped[uuid.UUID] = Field(default_factory=uuid.uuid4, sa_column=Column('id', Uuid, primary_key=True))
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), sa_column=Column('created_at', DateTime(True), nullable=False))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), sa_column=Column('updated_at', DateTime(True), nullable=False))
    title: str = Field(sa_column=Column('title', Text, nullable=False))
    profile_id: Mapped[uuid.UUID] = Field(sa_column=Column('profile_id', Uuid, nullable=False))
    trace_id: Optional[str] = Field(default=None, sa_column=Column('trace_id', Text))

    profile: Optional['Profiles'] = Relationship(back_populates='assistant_chats')
    assistant_messages: list['AssistantMessages'] = Relationship(back_populates='chat')
    assistant_tool_calls: list['AssistantToolCalls'] = Relationship(back_populates='chat')


class Models(_Base, table=True):
    __table_args__ = (
        ForeignKeyConstraint(['provider_id'], ['providers.id'], ondelete='CASCADE', name='models_provider_id_fkey'),
        PrimaryKeyConstraint('id', name='models_pkey')
    )

    id: Mapped[uuid.UUID] = Field(default_factory=uuid.uuid4, sa_column=Column('id', Uuid, primary_key=True))
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), sa_column=Column('created_at', DateTime(True), nullable=False))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), sa_column=Column('updated_at', DateTime(True), nullable=False))
    name: str = Field(sa_column=Column('name', Text, nullable=False))
    description: str = Field(sa_column=Column('description', Text, nullable=False))
    provider_id: Mapped[uuid.UUID] = Field(sa_column=Column('provider_id', Uuid, nullable=False))
    active: bool = Field(sa_column=Column('active', Boolean, nullable=False, default=True))
    input_ppm: float = Field(sa_column=Column('input_ppm', Double(53), nullable=False, default=0.0))
    output_ppm: float = Field(sa_column=Column('output_ppm', Double(53), nullable=False, default=0.0))
    custom_model: bool = Field(sa_column=Column('custom_model', Boolean, nullable=False, default=False))

    provider: Optional['Providers'] = Relationship(back_populates='models')
    agents: list['Agents'] = Relationship(back_populates='model')
    personas: list['Personas'] = Relationship(back_populates='model')
    model_runs: list['ModelRuns'] = Relationship(back_populates='model')


class ParameterItems(_Base, table=True):
    __tablename__ = 'parameter_items'
    __table_args__ = (
        ForeignKeyConstraint(['parameter_id'], ['parameters.id'], ondelete='CASCADE', name='parameter_items_parameter_id_fkey'),
        PrimaryKeyConstraint('id', name='parameter_items_pkey')
    )

    id: Mapped[uuid.UUID] = Field(default_factory=uuid.uuid4, sa_column=Column('id', Uuid, primary_key=True))
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), sa_column=Column('created_at', DateTime(True), nullable=False))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), sa_column=Column('updated_at', DateTime(True), nullable=False))
    name: str = Field(sa_column=Column('name', Text, nullable=False))
    description: str = Field(sa_column=Column('description', Text, nullable=False))
    value: str = Field(sa_column=Column('value', Text, nullable=False))
    parameter_id: Mapped[uuid.UUID] = Field(sa_column=Column('parameter_id', Uuid, nullable=False))
    default_item: bool = Field(sa_column=Column('default_item', Boolean, nullable=False, default=False))

    parameter: Optional['Parameters'] = Relationship(back_populates='parameter_items')


class Simulations(_Base, table=True):
    __table_args__ = (
        ForeignKeyConstraint(['department_id'], ['departments.id'], ondelete='CASCADE', name='simulations_department_id_fkey'),
        ForeignKeyConstraint(['rubric_id'], ['rubrics.id'], ondelete='CASCADE', name='simulations_rubric_id_fkey'),
        PrimaryKeyConstraint('id', name='simulations_pkey'),
        Index('simulations_id_active_idx', 'id', 'active')
    )

    id: Mapped[uuid.UUID] = Field(default_factory=uuid.uuid4, sa_column=Column('id', Uuid, primary_key=True))
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), sa_column=Column('created_at', DateTime(True), nullable=False))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), sa_column=Column('updated_at', DateTime(True), nullable=False))
    title: str = Field(sa_column=Column('title', Text, nullable=False))
    description: str = Field(sa_column=Column('description', Text, nullable=False, default=r'No description provided'))
    active: bool = Field(sa_column=Column('active', Boolean, nullable=False, default=True))
    scenario_ids: list[uuid.UUID] = Field(default_factory=list, sa_column=Column('scenario_ids', ARRAY(Uuid(as_uuid=True)), nullable=False))
    rubric_id: Mapped[uuid.UUID] = Field(sa_column=Column('rubric_id', Uuid, nullable=False))
    default_simulation: bool = Field(sa_column=Column('default_simulation', Boolean, nullable=False, default=False))
    practice_simulation: bool = Field(sa_column=Column('practice_simulation', Boolean, nullable=False, default=False))
    department_id: Mapped[uuid.UUID] = Field(sa_column=Column('department_id', Uuid, nullable=False))
    time_limit: Optional[int] = Field(default=None, sa_column=Column('time_limit', Integer))

    department: Optional['Departments'] = Relationship(back_populates='simulations')
    rubric: Optional['Rubrics'] = Relationship(back_populates='simulations')
    simulation_attempts: list['SimulationAttempts'] = Relationship(back_populates='simulation')


class StandardGroups(_Base, table=True):
    __tablename__ = 'standard_groups'
    __table_args__ = (
        ForeignKeyConstraint(['rubric_id'], ['rubrics.id'], ondelete='CASCADE', name='standard_groups_rubric_id_fkey'),
        PrimaryKeyConstraint('id', name='standard_groups_pkey'),
        Index('standard_groups_id_rubric_idx', 'id', 'rubric_id'),
        Index('standard_groups_rubric_idx', 'id', 'rubric_id')
    )

    id: Mapped[uuid.UUID] = Field(default_factory=uuid.uuid4, sa_column=Column('id', Uuid, primary_key=True))
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), sa_column=Column('created_at', DateTime(True), nullable=False))
    name: str = Field(sa_column=Column('name', Text, nullable=False))
    short_name: str = Field(sa_column=Column('short_name', Text, nullable=False))
    description: str = Field(sa_column=Column('description', Text, nullable=False))
    points: int = Field(sa_column=Column('points', Integer, nullable=False))
    pass_points: int = Field(sa_column=Column('pass_points', Integer, nullable=False))
    rubric_id: Mapped[uuid.UUID] = Field(sa_column=Column('rubric_id', Uuid, nullable=False))

    rubric: Optional['Rubrics'] = Relationship(back_populates='standard_groups')
    standards: list['Standards'] = Relationship(back_populates='standard_group')


class Agents(_Base, table=True):
    __table_args__ = (
        ForeignKeyConstraint(['model_id'], ['models.id'], ondelete='SET NULL', name='agents_model_id_fkey'),
        PrimaryKeyConstraint('id', name='agents_pkey')
    )

    id: Mapped[uuid.UUID] = Field(default_factory=uuid.uuid4, sa_column=Column('id', Uuid, primary_key=True))
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), sa_column=Column('created_at', DateTime(True), nullable=False))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), sa_column=Column('updated_at', DateTime(True), nullable=False))
    name: str = Field(sa_column=Column('name', Text, nullable=False))
    description: str = Field(sa_column=Column('description', Text, nullable=False))
    system_prompt: str = Field(sa_column=Column('system_prompt', Text, nullable=False))
    temperature: float = Field(sa_column=Column('temperature', REAL, nullable=False))
    model_id: Optional[uuid.UUID] = Field(default=None, sa_column=Column('model_id', Uuid(as_uuid=True)))
    reasoning: Optional[str] = Field(default=None, sa_column=Column('reasoning', Enum('minimal', 'low', 'medium', 'high', name='reasoning_effort')))

    model: Optional['Models'] = Relationship(back_populates='agents')
    model_runs: list['ModelRuns'] = Relationship(back_populates='agent')


class AssistantMessages(_Base, table=True):
    __tablename__ = 'assistant_messages'
    __table_args__ = (
        ForeignKeyConstraint(['chat_id'], ['assistant_chats.id'], ondelete='CASCADE', name='assistant_messages_chat_id_fkey'),
        PrimaryKeyConstraint('id', name='assistant_messages_pkey')
    )

    id: Mapped[uuid.UUID] = Field(default_factory=uuid.uuid4, sa_column=Column('id', Uuid, primary_key=True))
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), sa_column=Column('created_at', DateTime(True), nullable=False))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), sa_column=Column('updated_at', DateTime(True), nullable=False))
    chat_id: Mapped[uuid.UUID] = Field(sa_column=Column('chat_id', Uuid, nullable=False))
    role: str = Field(sa_column=Column('role', Enum('user', 'assistant', name='assistant_message_type'), nullable=False))
    content: str = Field(sa_column=Column('content', Text, nullable=False))
    completed: bool = Field(sa_column=Column('completed', Boolean, nullable=False, default=False))
    completed_at: Optional[datetime] = Field(default=None, sa_column=Column('completed_at', DateTime(True)))

    chat: Optional['AssistantChats'] = Relationship(back_populates='assistant_messages')


class AssistantToolCalls(_Base, table=True):
    __tablename__ = 'assistant_tool_calls'
    __table_args__ = (
        ForeignKeyConstraint(['chat_id'], ['assistant_chats.id'], ondelete='CASCADE', name='assistant_tool_calls_chat_id_fkey'),
        PrimaryKeyConstraint('id', name='assistant_tool_calls_pkey')
    )

    id: Mapped[uuid.UUID] = Field(default_factory=uuid.uuid4, sa_column=Column('id', Uuid, primary_key=True))
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), sa_column=Column('created_at', DateTime(True), nullable=False))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), sa_column=Column('updated_at', DateTime(True), nullable=False))
    chat_id: Mapped[uuid.UUID] = Field(sa_column=Column('chat_id', Uuid, nullable=False))
    tool_name: str = Field(sa_column=Column('tool_name', Text, nullable=False))
    tool_type: str = Field(sa_column=Column('tool_type', Enum('create', 'read', 'update', 'delete', name='assistant_tool_type'), nullable=False))
    tool_arguments: Dict[str, Any] = Field(sa_column=Column('tool_arguments', JSONB, nullable=False))
    tool_result: Dict[str, Any] = Field(sa_column=Column('tool_result', JSONB, nullable=False))
    completed: bool = Field(sa_column=Column('completed', Boolean, nullable=False, default=False))
    completed_at: Optional[datetime] = Field(default=None, sa_column=Column('completed_at', DateTime(True)))

    chat: Optional['AssistantChats'] = Relationship(back_populates='assistant_tool_calls')


class Personas(_Base, table=True):
    __table_args__ = (
        ForeignKeyConstraint(['department_id'], ['departments.id'], ondelete='CASCADE', name='personas_department_id_fkey'),
        ForeignKeyConstraint(['model_id'], ['models.id'], name='personas_model_id_fkey'),
        PrimaryKeyConstraint('id', name='personas_pkey'),
        Index('personas_id_idx', 'id')
    )

    id: Mapped[uuid.UUID] = Field(default_factory=uuid.uuid4, sa_column=Column('id', Uuid, primary_key=True))
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), sa_column=Column('created_at', DateTime(True), nullable=False))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), sa_column=Column('updated_at', DateTime(True), nullable=False))
    name: str = Field(sa_column=Column('name', Text, nullable=False))
    description: str = Field(sa_column=Column('description', Text, nullable=False))
    system_prompt: str = Field(sa_column=Column('system_prompt', Text, nullable=False))
    temperature: float = Field(sa_column=Column('temperature', REAL, nullable=False))
    default_persona: bool = Field(sa_column=Column('default_persona', Boolean, nullable=False, default=False))
    color: str = Field(sa_column=Column('color', Text, nullable=False))
    icon: str = Field(sa_column=Column('icon', Text, nullable=False))
    active: bool = Field(sa_column=Column('active', Boolean, nullable=False, default=False))
    guardrail_active: bool = Field(sa_column=Column('guardrail_active', Boolean, nullable=False, default=False))
    image_input_active: bool = Field(sa_column=Column('image_input_active', Boolean, nullable=False, default=False))
    department_id: Mapped[uuid.UUID] = Field(sa_column=Column('department_id', Uuid, nullable=False))
    model_id: Optional[uuid.UUID] = Field(default=None, sa_column=Column('model_id', Uuid(as_uuid=True)))
    reasoning: Optional[str] = Field(default=None, sa_column=Column('reasoning', Enum('minimal', 'low', 'medium', 'high', name='reasoning_effort')))

    department: Optional['Departments'] = Relationship(back_populates='personas')
    model: Optional['Models'] = Relationship(back_populates='personas')
    model_runs: list['ModelRuns'] = Relationship(back_populates='persona')
    scenarios: list['Scenarios'] = Relationship(back_populates='persona')


class SimulationAttempts(_Base, table=True):
    __tablename__ = 'simulation_attempts'
    __table_args__ = (
        ForeignKeyConstraint(['profile_id'], ['profiles.id'], ondelete='CASCADE', name='simulation_attempts_profile_id_fkey'),
        ForeignKeyConstraint(['simulation_id'], ['simulations.id'], ondelete='CASCADE', name='simulation_attempts_simulation_id_fkey'),
        PrimaryKeyConstraint('id', name='simulation_attempts_pkey'),
        Index('simulation_attempts_archived_idx', 'archived'),
        Index('simulation_attempts_id_profile_archived_idx', 'id', 'profile_id', 'archived', 'infinite_mode'),
        Index('simulation_attempts_profile_sim_idx', 'profile_id', 'simulation_id')
    )

    id: Mapped[uuid.UUID] = Field(default_factory=uuid.uuid4, sa_column=Column('id', Uuid, primary_key=True))
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), sa_column=Column('created_at', DateTime(True), nullable=False))
    simulation_id: Mapped[uuid.UUID] = Field(sa_column=Column('simulation_id', Uuid, nullable=False))
    infinite_mode: bool = Field(sa_column=Column('infinite_mode', Boolean, nullable=False, default=False))
    archived: bool = Field(sa_column=Column('archived', Boolean, nullable=False, default=False))
    profile_id: Optional[uuid.UUID] = Field(default=None, sa_column=Column('profile_id', Uuid(as_uuid=True)))
    infinite_mode_time_limit: Optional[int] = Field(default=None, sa_column=Column('infinite_mode_time_limit', Integer))

    profile: Optional['Profiles'] = Relationship(back_populates='simulation_attempts')
    simulation: Optional['Simulations'] = Relationship(back_populates='simulation_attempts')
    simulation_chats: list['SimulationChats'] = Relationship(back_populates='attempt')


class Standards(_Base, table=True):
    __table_args__ = (
        ForeignKeyConstraint(['standard_group_id'], ['standard_groups.id'], ondelete='CASCADE', name='standards_standard_group_id_fkey'),
        PrimaryKeyConstraint('id', name='standards_pkey'),
        Index('standards_group_idx', 'standard_group_id')
    )

    id: Mapped[uuid.UUID] = Field(default_factory=uuid.uuid4, sa_column=Column('id', Uuid, primary_key=True))
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), sa_column=Column('created_at', DateTime(True), nullable=False))
    name: str = Field(sa_column=Column('name', Text, nullable=False))
    description: str = Field(sa_column=Column('description', Text, nullable=False))
    points: int = Field(sa_column=Column('points', Integer, nullable=False))
    standard_group_id: Mapped[uuid.UUID] = Field(sa_column=Column('standard_group_id', Uuid, nullable=False))

    standard_group: Optional['StandardGroups'] = Relationship(back_populates='standards')
    simulation_chat_feedbacks: list['SimulationChatFeedbacks'] = Relationship(back_populates='standard')


class ModelRuns(_Base, table=True):
    __tablename__ = 'model_runs'
    __table_args__ = (
        ForeignKeyConstraint(['agent_id'], ['agents.id'], name='model_runs_agent_id_fkey'),
        ForeignKeyConstraint(['department_id'], ['departments.id'], ondelete='CASCADE', name='model_runs_department_id_fkey'),
        ForeignKeyConstraint(['model_id'], ['models.id'], ondelete='SET NULL', name='model_runs_model_id_fkey'),
        ForeignKeyConstraint(['persona_id'], ['personas.id'], name='model_runs_persona_id_fkey'),
        ForeignKeyConstraint(['profile_id'], ['profiles.id'], name='model_runs_profile_id_fkey'),
        PrimaryKeyConstraint('id', name='model_runs_pkey')
    )

    id: Mapped[uuid.UUID] = Field(default_factory=uuid.uuid4, sa_column=Column('id', Uuid, primary_key=True))
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), sa_column=Column('created_at', DateTime(True), nullable=False))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), sa_column=Column('updated_at', DateTime(True), nullable=False))
    input_tokens: int = Field(sa_column=Column('input_tokens', Integer, nullable=False, default=0))
    output_tokens: int = Field(sa_column=Column('output_tokens', Integer, nullable=False, default=0))
    department_id: Mapped[uuid.UUID] = Field(sa_column=Column('department_id', Uuid, nullable=False))
    model_id: Optional[uuid.UUID] = Field(default=None, sa_column=Column('model_id', Uuid(as_uuid=True)))
    persona_id: Optional[uuid.UUID] = Field(default=None, sa_column=Column('persona_id', Uuid(as_uuid=True)))
    agent_id: Optional[uuid.UUID] = Field(default=None, sa_column=Column('agent_id', Uuid(as_uuid=True)))
    profile_id: Optional[uuid.UUID] = Field(default=None, sa_column=Column('profile_id', Uuid(as_uuid=True)))

    agent: Optional['Agents'] = Relationship(back_populates='model_runs')
    department: Optional['Departments'] = Relationship(back_populates='model_runs')
    model: Optional['Models'] = Relationship(back_populates='model_runs')
    persona: Optional['Personas'] = Relationship(back_populates='model_runs')
    profile: Optional['Profiles'] = Relationship(back_populates='model_runs')
    debug_info: list['DebugInfo'] = Relationship(back_populates='model_run')


class Scenarios(_Base, table=True):
    __table_args__ = (
        ForeignKeyConstraint(['department_id'], ['departments.id'], ondelete='CASCADE', name='scenarios_department_id_fkey'),
        ForeignKeyConstraint(['persona_id'], ['personas.id'], ondelete='SET NULL', name='scenarios_persona_id_fkey'),
        PrimaryKeyConstraint('id', name='scenarios_pkey'),
        Index('scenarios_id_active_idx', 'id', 'active')
    )

    id: Mapped[uuid.UUID] = Field(default_factory=uuid.uuid4, sa_column=Column('id', Uuid, primary_key=True))
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), sa_column=Column('created_at', DateTime(True), nullable=False))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), sa_column=Column('updated_at', DateTime(True), nullable=False))
    name: str = Field(sa_column=Column('name', Text, nullable=False))
    description: str = Field(sa_column=Column('description', Text, nullable=False))
    default_scenario: bool = Field(sa_column=Column('default_scenario', Boolean, nullable=False, default=False))
    practice_scenario: bool = Field(sa_column=Column('practice_scenario', Boolean, nullable=False, default=False))
    generated: bool = Field(sa_column=Column('generated', Boolean, nullable=False, default=False))
    active: bool = Field(sa_column=Column('active', Boolean, nullable=False, default=True))
    department_id: Mapped[uuid.UUID] = Field(sa_column=Column('department_id', Uuid, nullable=False))
    persona_id: Optional[uuid.UUID] = Field(default=None, sa_column=Column('persona_id', Uuid(as_uuid=True)))
    parameter_item_ids: Optional[list[uuid.UUID]] = Field(default=None, sa_column=Column('parameter_item_ids', ARRAY(Uuid(as_uuid=True))))
    document_ids: Optional[list[uuid.UUID]] = Field(default=None, sa_column=Column('document_ids', ARRAY(Uuid(as_uuid=True))))
    parent_id: Optional[uuid.UUID] = Field(default=None, sa_column=Column('parent_id', Uuid(as_uuid=True)))

    department: Optional['Departments'] = Relationship(back_populates='scenarios')
    persona: Optional['Personas'] = Relationship(back_populates='scenarios')
    simulation_chats: list['SimulationChats'] = Relationship(back_populates='scenario')


class DebugInfo(_Base, table=True):
    __tablename__ = 'debug_info'
    __table_args__ = (
        ForeignKeyConstraint(['model_run_id'], ['model_runs.id'], name='debug_info_model_run_id_fkey'),
        PrimaryKeyConstraint('id', name='debug_info_pkey')
    )

    id: Mapped[uuid.UUID] = Field(default_factory=uuid.uuid4, sa_column=Column('id', Uuid, primary_key=True))
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), sa_column=Column('created_at', DateTime(True), nullable=False))
    model_run_id: Mapped[uuid.UUID] = Field(sa_column=Column('model_run_id', Uuid, nullable=False))
    content: str = Field(sa_column=Column('content', Text, nullable=False))

    model_run: Optional['ModelRuns'] = Relationship(back_populates='debug_info')


class SimulationChats(_Base, table=True):
    __tablename__ = 'simulation_chats'
    __table_args__ = (
        ForeignKeyConstraint(['attempt_id'], ['simulation_attempts.id'], ondelete='CASCADE', name='simulation_chats_attempt_id_fkey'),
        ForeignKeyConstraint(['scenario_id'], ['scenarios.id'], ondelete='CASCADE', name='simulation_chats_scenario_id_fkey'),
        PrimaryKeyConstraint('id', name='simulation_chats_pkey'),
        Index('simulation_chats_id_created_idx', 'id', 'created_at')
    )

    id: Mapped[uuid.UUID] = Field(default_factory=uuid.uuid4, sa_column=Column('id', Uuid, primary_key=True))
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), sa_column=Column('created_at', DateTime(True), nullable=False))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), sa_column=Column('updated_at', DateTime(True), nullable=False))
    title: str = Field(sa_column=Column('title', Text, nullable=False))
    scenario_id: Mapped[uuid.UUID] = Field(sa_column=Column('scenario_id', Uuid, nullable=False))
    attempt_id: Mapped[uuid.UUID] = Field(sa_column=Column('attempt_id', Uuid, nullable=False))
    completed: bool = Field(sa_column=Column('completed', Boolean, nullable=False, default=False))
    completed_at: Optional[datetime] = Field(default=None, sa_column=Column('completed_at', DateTime(True)))
    trace_id: Optional[str] = Field(default=None, sa_column=Column('trace_id', Text))

    attempt: Optional['SimulationAttempts'] = Relationship(back_populates='simulation_chats')
    scenario: Optional['Scenarios'] = Relationship(back_populates='simulation_chats')
    simulation_chat_grades: list['SimulationChatGrades'] = Relationship(back_populates='simulation_chat')
    simulation_messages: list['SimulationMessages'] = Relationship(back_populates='chat')


class SimulationChatGrades(_Base, table=True):
    __tablename__ = 'simulation_chat_grades'
    __table_args__ = (
        ForeignKeyConstraint(['rubric_id'], ['rubrics.id'], ondelete='CASCADE', name='simulation_chat_grades_rubric_id_fkey'),
        ForeignKeyConstraint(['simulation_chat_id'], ['simulation_chats.id'], ondelete='CASCADE', name='simulation_chat_grades_simulation_chat_id_fkey'),
        PrimaryKeyConstraint('id', name='simulation_chat_grades_pkey'),
        Index('scg_chat_created_idx', 'simulation_chat_id', 'created_at'),
        Index('scg_chat_rubric_created_idx', 'simulation_chat_id', 'rubric_id', 'created_at'),
        Index('simulation_chat_grades_latest_idx', 'simulation_chat_id', 'created_at')
    )

    id: Mapped[uuid.UUID] = Field(default_factory=uuid.uuid4, sa_column=Column('id', Uuid, primary_key=True))
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), sa_column=Column('created_at', DateTime(True), nullable=False))
    description: str = Field(sa_column=Column('description', Text, nullable=False, default=r'No description provided'))
    passed: bool = Field(sa_column=Column('passed', Boolean, nullable=False))
    score: int = Field(sa_column=Column('score', Integer, nullable=False))
    time_taken: int = Field(sa_column=Column('time_taken', Integer, nullable=False))
    rubric_id: Mapped[uuid.UUID] = Field(sa_column=Column('rubric_id', Uuid, nullable=False))
    simulation_chat_id: Mapped[uuid.UUID] = Field(sa_column=Column('simulation_chat_id', Uuid, nullable=False))

    rubric: Optional['Rubrics'] = Relationship(back_populates='simulation_chat_grades')
    simulation_chat: Optional['SimulationChats'] = Relationship(back_populates='simulation_chat_grades')
    simulation_chat_feedbacks: list['SimulationChatFeedbacks'] = Relationship(back_populates='simulation_chat_grade')


class SimulationMessages(_Base, table=True):
    __tablename__ = 'simulation_messages'
    __table_args__ = (
        ForeignKeyConstraint(['chat_id'], ['simulation_chats.id'], ondelete='CASCADE', name='simulation_messages_chat_id_fkey'),
        PrimaryKeyConstraint('id', name='simulation_messages_pkey'),
        Index('simulation_messages_chat_created_type_idx', 'chat_id', 'created_at', 'type')
    )

    id: Mapped[uuid.UUID] = Field(default_factory=uuid.uuid4, sa_column=Column('id', Uuid, primary_key=True))
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), sa_column=Column('created_at', DateTime(True), nullable=False))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), sa_column=Column('updated_at', DateTime(True), nullable=False))
    chat_id: Mapped[uuid.UUID] = Field(sa_column=Column('chat_id', Uuid, nullable=False))
    content: str = Field(sa_column=Column('content', Text, nullable=False))
    type: str = Field(sa_column=Column('type', Enum('query', 'response', name='simulation_message_type'), nullable=False))
    completed: bool = Field(sa_column=Column('completed', Boolean, nullable=False, default=False))

    chat: Optional['SimulationChats'] = Relationship(back_populates='simulation_messages')
    simulation_crowdsourced_messages: list['SimulationCrowdsourcedMessages'] = Relationship(back_populates='simulation_message')


class SimulationChatFeedbacks(_Base, table=True):
    __tablename__ = 'simulation_chat_feedbacks'
    __table_args__ = (
        ForeignKeyConstraint(['simulation_chat_grade_id'], ['simulation_chat_grades.id'], ondelete='CASCADE', name='simulation_chat_feedbacks_simulation_chat_grade_id_fkey'),
        ForeignKeyConstraint(['standard_id'], ['standards.id'], ondelete='CASCADE', name='simulation_chat_feedbacks_standard_id_fkey'),
        PrimaryKeyConstraint('id', name='simulation_chat_feedbacks_pkey'),
        Index('scf_grade_idx', 'simulation_chat_grade_id')
    )

    id: Mapped[uuid.UUID] = Field(default_factory=uuid.uuid4, sa_column=Column('id', Uuid, primary_key=True))
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), sa_column=Column('created_at', DateTime(True), nullable=False))
    standard_id: Mapped[uuid.UUID] = Field(sa_column=Column('standard_id', Uuid, nullable=False))
    simulation_chat_grade_id: Mapped[uuid.UUID] = Field(sa_column=Column('simulation_chat_grade_id', Uuid, nullable=False))
    total: int = Field(sa_column=Column('total', Integer, nullable=False))
    feedback: Optional[str] = Field(default=None, sa_column=Column('feedback', Text))

    simulation_chat_grade: Optional['SimulationChatGrades'] = Relationship(back_populates='simulation_chat_feedbacks')
    standard: Optional['Standards'] = Relationship(back_populates='simulation_chat_feedbacks')
    simulation_chat_crowdsourced_feedbacks: list['SimulationChatCrowdsourcedFeedbacks'] = Relationship(back_populates='simulation_chat_feedback')


class SimulationCrowdsourcedMessages(_Base, table=True):
    __tablename__ = 'simulation_crowdsourced_messages'
    __table_args__ = (
        ForeignKeyConstraint(['profile_id'], ['profiles.id'], ondelete='CASCADE', name='simulation_crowdsourced_messages_profile_id_fkey'),
        ForeignKeyConstraint(['simulation_message_id'], ['simulation_messages.id'], ondelete='CASCADE', name='simulation_crowdsourced_messages_simulation_message_id_fkey'),
        PrimaryKeyConstraint('id', name='simulation_crowdsourced_messages_pkey')
    )

    id: Mapped[uuid.UUID] = Field(default_factory=uuid.uuid4, sa_column=Column('id', Uuid, primary_key=True))
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), sa_column=Column('created_at', DateTime(True), nullable=False))
    simulation_message_id: Mapped[uuid.UUID] = Field(sa_column=Column('simulation_message_id', Uuid, nullable=False))
    profile_id: Mapped[uuid.UUID] = Field(sa_column=Column('profile_id', Uuid, nullable=False))
    response: bool = Field(sa_column=Column('response', Boolean, nullable=False))

    profile: Optional['Profiles'] = Relationship(back_populates='simulation_crowdsourced_messages')
    simulation_message: Optional['SimulationMessages'] = Relationship(back_populates='simulation_crowdsourced_messages')


class SimulationChatCrowdsourcedFeedbacks(_Base, table=True):
    __tablename__ = 'simulation_chat_crowdsourced_feedbacks'
    __table_args__ = (
        ForeignKeyConstraint(['profile_id'], ['profiles.id'], ondelete='CASCADE', name='simulation_chat_crowdsourced_feedbacks_profile_id_fkey'),
        ForeignKeyConstraint(['simulation_chat_feedback_id'], ['simulation_chat_feedbacks.id'], ondelete='CASCADE', name='simulation_chat_crowdsourced_f_simulation_chat_feedback_id_fkey'),
        PrimaryKeyConstraint('id', name='simulation_chat_crowdsourced_feedbacks_pkey')
    )

    id: Mapped[uuid.UUID] = Field(default_factory=uuid.uuid4, sa_column=Column('id', Uuid, primary_key=True))
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), sa_column=Column('created_at', DateTime(True), nullable=False))
    profile_id: Mapped[uuid.UUID] = Field(sa_column=Column('profile_id', Uuid, nullable=False))
    simulation_chat_feedback_id: Mapped[uuid.UUID] = Field(sa_column=Column('simulation_chat_feedback_id', Uuid, nullable=False))
    total: int = Field(sa_column=Column('total', Integer, nullable=False))
    feedback: Optional[str] = Field(default=None, sa_column=Column('feedback', Text))

    profile: Optional['Profiles'] = Relationship(back_populates='simulation_chat_crowdsourced_feedbacks')
    simulation_chat_feedback: Optional['SimulationChatFeedbacks'] = Relationship(back_populates='simulation_chat_crowdsourced_feedbacks')
