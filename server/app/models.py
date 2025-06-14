import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional

from sqlalchemy import (ARRAY, BigInteger, Boolean, Column, DateTime, Enum,
                        ForeignKeyConstraint, Integer, PrimaryKeyConstraint,
                        String, Text, Uuid, text)
from sqlalchemy.dialects.postgresql import JSONB
from sqlmodel import Field, Relationship, SQLModel


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


class Agents(_Base, table=True):
    __table_args__ = (
        PrimaryKeyConstraint('id', name='agents_pkey'),
    )

    id: uuid.UUID = Field(sa_column=Column('id', Uuid(as_uuid=True), primary_key=True, server_default=text('gen_random_uuid()')))
    created_at: datetime = Field(sa_column=Column('created_at', DateTime(True), server_default=text('now()')))
    name: str = Field(sa_column=Column('name', Text))
    subtitle: str = Field(sa_column=Column('subtitle', Text))
    description: str = Field(sa_column=Column('description', Text))
    system_prompt: str = Field(sa_column=Column('system_prompt', Text))
    agent_type: str = Field(sa_column=Column('agent_type', Enum('student', 'ta', name='agent_type'), server_default=text("'student'::agent_type")))
    temperature: int = Field(sa_column=Column('temperature', Integer))

    evals: List['Evals'] = Relationship(back_populates='base_agent')
    scenarios: List['Scenarios'] = Relationship(back_populates='agent')
    eval_runs: List['EvalRuns'] = Relationship(back_populates='agent')


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

    id: uuid.UUID = Field(sa_column=Column('id', Uuid(as_uuid=True), primary_key=True, server_default=text('gen_random_uuid()')))
    created_at: datetime = Field(sa_column=Column('created_at', DateTime(True), server_default=text('now()')))
    name: str = Field(sa_column=Column('name', Text))
    class_code: str = Field(sa_column=Column('class_code', Text))
    year: int = Field(sa_column=Column('year', Integer))
    term: str = Field(sa_column=Column('term', Enum('fall', 'spring', 'summer', name='class_term'), server_default=text("'fall'::class_term")))
    description: str = Field(sa_column=Column('description', Text))

    documents: List['Documents'] = Relationship(back_populates='class_')
    scenarios: List['Scenarios'] = Relationship(back_populates='class_')
    schedules: List['Schedules'] = Relationship(back_populates='class_')
    topics: List['Topics'] = Relationship(back_populates='class_')


class Rubrics(_Base, table=True):
    __table_args__ = (
        PrimaryKeyConstraint('id', name='rubrics_pkey'),
    )

    id: uuid.UUID = Field(sa_column=Column('id', Uuid(as_uuid=True), primary_key=True, server_default=text('gen_random_uuid()')))
    created_at: datetime = Field(sa_column=Column('created_at', DateTime(True), server_default=text('now()')))
    name: str = Field(sa_column=Column('name', Text))
    description: str = Field(sa_column=Column('description', Text))
    points: int = Field(sa_column=Column('points', Integer))
    pass_points: int = Field(sa_column=Column('pass_points', Integer))
    rubric_type: str = Field(sa_column=Column('rubric_type', Enum('simulation', 'eval', name='rubric_type'), server_default=text("'simulation'::rubric_type")))

    simulations: List['Simulations'] = Relationship(back_populates='rubric')
    standard_groups: List['StandardGroups'] = Relationship(back_populates='rubric')
    eval_runs: List['EvalRuns'] = Relationship(back_populates='rubric')
    eval_chat_grades: List['EvalChatGrades'] = Relationship(back_populates='rubric')
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


class Documents(_Base, table=True):
    __table_args__ = (
        ForeignKeyConstraint(['class_id'], ['classes.id'], ondelete='CASCADE', name='documents_class_id_fkey'),
        PrimaryKeyConstraint('id', name='documents_pkey')
    )

    id: uuid.UUID = Field(sa_column=Column('id', Uuid(as_uuid=True), primary_key=True, server_default=text('gen_random_uuid()')))
    created_at: datetime = Field(sa_column=Column('created_at', DateTime(True), server_default=text('now()')))
    name: str = Field(sa_column=Column('name', Text))
    file_path: str = Field(sa_column=Column('file_path', Text))
    mime_type: str = Field(sa_column=Column('mime_type', Text))
    class_id: uuid.UUID = Field(sa_column=Column('class_id', Uuid(as_uuid=True)))
    type: str = Field(sa_column=Column('type', Enum('homework', 'project', 'quiz', 'midterm', 'lab', 'lecture', 'syllabus', name='document_type'), server_default=text("'homework'::document_type")))
    classified: bool = Field(sa_column=Column('classified', Boolean, server_default=text('false')))

    class_: Optional['Classes'] = Relationship(back_populates='documents')


class Evals(_Base, table=True):
    __table_args__ = (
        ForeignKeyConstraint(['base_agent_id'], ['agents.id'], ondelete='CASCADE', name='evals_base_agent_id_fkey'),
        PrimaryKeyConstraint('id', name='evals_pkey')
    )

    id: uuid.UUID = Field(sa_column=Column('id', Uuid(as_uuid=True), primary_key=True, server_default=text('gen_random_uuid()')))
    created_at: datetime = Field(sa_column=Column('created_at', DateTime(True), server_default=text('now()')))
    name: str = Field(sa_column=Column('name', Text))
    description: str = Field(sa_column=Column('description', Text))
    base_agent_id: uuid.UUID = Field(sa_column=Column('base_agent_id', Uuid(as_uuid=True)))
    scenario_ids: List[uuid.UUID] = Field(sa_column=Column('scenario_ids', ARRAY(Uuid(as_uuid=True)), server_default=text('ARRAY[]::uuid[]')))
    agent_ids: List[uuid.UUID] = Field(sa_column=Column('agent_ids', ARRAY(Uuid(as_uuid=True)), server_default=text('ARRAY[]::uuid[]')))
    rubric_ids: List[uuid.UUID] = Field(sa_column=Column('rubric_ids', ARRAY(Uuid(as_uuid=True)), server_default=text('ARRAY[]::uuid[]')))
    eval_type: str = Field(sa_column=Column('eval_type', Enum('student', 'ta', name='eval_type'), server_default=text("'student'::eval_type")))
    max_turns: int = Field(sa_column=Column('max_turns', Integer))
    max_parallel_runs: int = Field(sa_column=Column('max_parallel_runs', Integer))

    base_agent: Optional['Agents'] = Relationship(back_populates='evals')
    eval_runs: List['EvalRuns'] = Relationship(back_populates='eval')


class Profiles(_Base, table=True):
    __table_args__ = (
        ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE', name='profiles_user_id_fkey'),
        PrimaryKeyConstraint('id', name='profiles_pkey')
    )

    id: uuid.UUID = Field(sa_column=Column('id', Uuid(as_uuid=True), primary_key=True, server_default=text('gen_random_uuid()')))
    user_id: int = Field(sa_column=Column('user_id', Integer))
    last_login: datetime = Field(sa_column=Column('last_login', DateTime(True), server_default=text('now()')))
    first_name: str = Field(sa_column=Column('first_name', Text))
    last_name: str = Field(sa_column=Column('last_name', Text))
    alias: str = Field(sa_column=Column('alias', Text))
    viewed_intro: bool = Field(sa_column=Column('viewed_intro', Boolean, server_default=text('false')))
    created_at: datetime = Field(sa_column=Column('created_at', DateTime(True), server_default=text('now()')))
    role: str = Field(sa_column=Column('role', Enum('admin', 'instructional', 'instructor', 'ta', name='profile_role'), server_default=text("'ta'::profile_role")))
    class_ids: List[uuid.UUID] = Field(sa_column=Column('class_ids', ARRAY(Uuid(as_uuid=True)), server_default=text('ARRAY[]::uuid[]')))

    user: Optional['Users'] = Relationship(back_populates='profiles')
    simulation_attempts: List['SimulationAttempts'] = Relationship(back_populates='profile')


class Scenarios(_Base, table=True):
    __table_args__ = (
        ForeignKeyConstraint(['agent_id'], ['agents.id'], ondelete='SET NULL', name='scenarios_agent_id_fkey'),
        ForeignKeyConstraint(['class_id'], ['classes.id'], ondelete='SET NULL', name='scenarios_class_id_fkey'),
        PrimaryKeyConstraint('id', name='scenarios_pkey')
    )

    id: uuid.UUID = Field(sa_column=Column('id', Uuid(as_uuid=True), primary_key=True, server_default=text('gen_random_uuid()')))
    created_at: datetime = Field(sa_column=Column('created_at', DateTime(True), server_default=text('now()')))
    updated_at: datetime = Field(sa_column=Column('updated_at', DateTime(True), server_default=text('now()')))
    name: str = Field(sa_column=Column('name', Text))
    description: str = Field(sa_column=Column('description', Text))
    agent_id: Optional[uuid.UUID] = Field(default=None, sa_column=Column('agent_id', Uuid(as_uuid=True)))
    class_id: Optional[uuid.UUID] = Field(default=None, sa_column=Column('class_id', Uuid(as_uuid=True)))
    crowdedness: Optional[int] = Field(default=None, sa_column=Column('crowdedness', Integer))
    intensity: Optional[int] = Field(default=None, sa_column=Column('intensity', Integer))
    seniority: Optional[str] = Field(default=None, sa_column=Column('seniority', Enum('freshman', 'sophomore', 'junior', 'senior', name='seniority_levels')))
    documents: Optional[List[uuid.UUID]] = Field(default=None, sa_column=Column('documents', ARRAY(Uuid(as_uuid=True))))

    agent: Optional['Agents'] = Relationship(back_populates='scenarios')
    class_: Optional['Classes'] = Relationship(back_populates='scenarios')
    eval_chats: List['EvalChats'] = Relationship(back_populates='scenario')
    simulation_chats: List['SimulationChats'] = Relationship(back_populates='scenario')


class Schedules(_Base, table=True):
    __table_args__ = (
        ForeignKeyConstraint(['class_id'], ['classes.id'], ondelete='CASCADE', name='schedules_class_id_fkey'),
        PrimaryKeyConstraint('id', name='schedules_pkey')
    )

    id: uuid.UUID = Field(sa_column=Column('id', Uuid(as_uuid=True), primary_key=True, server_default=text('gen_random_uuid()')))
    created_at: datetime = Field(sa_column=Column('created_at', DateTime(True), server_default=text('now()')))
    name: str = Field(sa_column=Column('name', Text))
    description: str = Field(sa_column=Column('description', Text))
    class_id: uuid.UUID = Field(sa_column=Column('class_id', Uuid(as_uuid=True)))

    class_: Optional['Classes'] = Relationship(back_populates='schedules')
    events: List['Events'] = Relationship(back_populates='schedule')


class Simulations(_Base, table=True):
    __table_args__ = (
        ForeignKeyConstraint(['rubric_id'], ['rubrics.id'], ondelete='CASCADE', name='simulations_rubric_id_fkey'),
        PrimaryKeyConstraint('id', name='simulations_pkey')
    )

    id: uuid.UUID = Field(sa_column=Column('id', Uuid(as_uuid=True), primary_key=True, server_default=text('gen_random_uuid()')))
    created_at: datetime = Field(sa_column=Column('created_at', DateTime(True), server_default=text('now()')))
    title: str = Field(sa_column=Column('title', Text))
    active: bool = Field(sa_column=Column('active', Boolean, server_default=text('true')))
    scenario_ids: List[uuid.UUID] = Field(sa_column=Column('scenario_ids', ARRAY(Uuid(as_uuid=True)), server_default=text('ARRAY[]::uuid[]')))
    rubric_id: uuid.UUID = Field(sa_column=Column('rubric_id', Uuid(as_uuid=True)))
    time_limit: Optional[int] = Field(default=None, sa_column=Column('time_limit', Integer))

    rubric: Optional['Rubrics'] = Relationship(back_populates='simulations')
    simulation_attempts: List['SimulationAttempts'] = Relationship(back_populates='simulation')


class StandardGroups(_Base, table=True):
    __tablename__ = 'standard_groups'
    __table_args__ = (
        ForeignKeyConstraint(['rubric_id'], ['rubrics.id'], ondelete='CASCADE', name='standard_groups_rubric_id_fkey'),
        PrimaryKeyConstraint('id', name='standard_groups_pkey')
    )

    id: uuid.UUID = Field(sa_column=Column('id', Uuid(as_uuid=True), primary_key=True, server_default=text('gen_random_uuid()')))
    created_at: datetime = Field(sa_column=Column('created_at', DateTime(True), server_default=text('now()')))
    name: str = Field(sa_column=Column('name', Text))
    short_name: str = Field(sa_column=Column('short_name', Text))
    description: str = Field(sa_column=Column('description', Text))
    points: int = Field(sa_column=Column('points', Integer))
    pass_points: int = Field(sa_column=Column('pass_points', Integer))
    rubric_id: uuid.UUID = Field(sa_column=Column('rubric_id', Uuid(as_uuid=True)))

    rubric: Optional['Rubrics'] = Relationship(back_populates='standard_groups')
    standards: List['Standards'] = Relationship(back_populates='standard_group')


class Topics(_Base, table=True):
    __table_args__ = (
        ForeignKeyConstraint(['class_id'], ['classes.id'], ondelete='CASCADE', name='topics_class_id_fkey'),
        PrimaryKeyConstraint('id', name='topics_pkey')
    )

    id: uuid.UUID = Field(sa_column=Column('id', Uuid(as_uuid=True), primary_key=True, server_default=text('gen_random_uuid()')))
    created_at: datetime = Field(sa_column=Column('created_at', DateTime(True), server_default=text('now()')))
    name: str = Field(sa_column=Column('name', Text))
    description: str = Field(sa_column=Column('description', Text))
    prerequisite: bool = Field(sa_column=Column('prerequisite', Boolean, server_default=text('false')))
    class_id: uuid.UUID = Field(sa_column=Column('class_id', Uuid(as_uuid=True)))

    class_: Optional['Classes'] = Relationship(back_populates='topics')


class EvalRuns(_Base, table=True):
    __tablename__ = 'eval_runs'
    __table_args__ = (
        ForeignKeyConstraint(['agent_id'], ['agents.id'], ondelete='CASCADE', name='eval_runs_agent_id_fkey'),
        ForeignKeyConstraint(['eval_id'], ['evals.id'], ondelete='CASCADE', name='eval_runs_eval_id_fkey'),
        ForeignKeyConstraint(['rubric_id'], ['rubrics.id'], ondelete='CASCADE', name='eval_runs_rubric_id_fkey'),
        PrimaryKeyConstraint('id', name='eval_runs_pkey')
    )

    id: uuid.UUID = Field(sa_column=Column('id', Uuid(as_uuid=True), primary_key=True, server_default=text('gen_random_uuid()')))
    created_at: datetime = Field(sa_column=Column('created_at', DateTime(True), server_default=text('now()')))
    eval_id: uuid.UUID = Field(sa_column=Column('eval_id', Uuid(as_uuid=True)))
    agent_id: uuid.UUID = Field(sa_column=Column('agent_id', Uuid(as_uuid=True)))
    rubric_id: uuid.UUID = Field(sa_column=Column('rubric_id', Uuid(as_uuid=True)))

    agent: Optional['Agents'] = Relationship(back_populates='eval_runs')
    eval: Optional['Evals'] = Relationship(back_populates='eval_runs')
    rubric: Optional['Rubrics'] = Relationship(back_populates='eval_runs')
    eval_chats: List['EvalChats'] = Relationship(back_populates='eval_run')


class Events(_Base, table=True):
    __table_args__ = (
        ForeignKeyConstraint(['schedule_id'], ['schedules.id'], ondelete='CASCADE', name='events_schedule_id_fkey'),
        PrimaryKeyConstraint('id', name='events_pkey')
    )

    id: uuid.UUID = Field(sa_column=Column('id', Uuid(as_uuid=True), primary_key=True, server_default=text('gen_random_uuid()')))
    created_at: datetime = Field(sa_column=Column('created_at', DateTime(True), server_default=text('now()')))
    name: str = Field(sa_column=Column('name', Text))
    description: str = Field(sa_column=Column('description', Text))
    time: datetime = Field(sa_column=Column('time', DateTime(True)))
    schedule_id: uuid.UUID = Field(sa_column=Column('schedule_id', Uuid(as_uuid=True)))
    document_type: Optional[str] = Field(default=None, sa_column=Column('document_type', Enum('homework', 'project', 'quiz', 'midterm', 'lab', 'lecture', 'syllabus', name='document_type')))

    schedule: Optional['Schedules'] = Relationship(back_populates='events')


class SimulationAttempts(_Base, table=True):
    __tablename__ = 'simulation_attempts'
    __table_args__ = (
        ForeignKeyConstraint(['profile_id'], ['profiles.id'], ondelete='CASCADE', name='simulation_attempts_profile_id_fkey'),
        ForeignKeyConstraint(['simulation_id'], ['simulations.id'], ondelete='CASCADE', name='simulation_attempts_simulation_id_fkey'),
        PrimaryKeyConstraint('id', name='simulation_attempts_pkey')
    )

    id: uuid.UUID = Field(sa_column=Column('id', Uuid(as_uuid=True), primary_key=True, server_default=text('gen_random_uuid()')))
    created_at: datetime = Field(sa_column=Column('created_at', DateTime(True), server_default=text('now()')))
    simulation_id: uuid.UUID = Field(sa_column=Column('simulation_id', Uuid(as_uuid=True)))
    profile_id: Optional[uuid.UUID] = Field(default=None, sa_column=Column('profile_id', Uuid(as_uuid=True)))

    profile: Optional['Profiles'] = Relationship(back_populates='simulation_attempts')
    simulation: Optional['Simulations'] = Relationship(back_populates='simulation_attempts')
    simulation_chats: List['SimulationChats'] = Relationship(back_populates='attempt')


class Standards(_Base, table=True):
    __table_args__ = (
        ForeignKeyConstraint(['standard_group_id'], ['standard_groups.id'], ondelete='CASCADE', name='standards_standard_group_id_fkey'),
        PrimaryKeyConstraint('id', name='standards_pkey')
    )

    id: uuid.UUID = Field(sa_column=Column('id', Uuid(as_uuid=True), primary_key=True, server_default=text('gen_random_uuid()')))
    created_at: datetime = Field(sa_column=Column('created_at', DateTime(True), server_default=text('now()')))
    name: str = Field(sa_column=Column('name', Text))
    description: str = Field(sa_column=Column('description', Text))
    points: int = Field(sa_column=Column('points', Integer))
    standard_group_id: uuid.UUID = Field(sa_column=Column('standard_group_id', Uuid(as_uuid=True)))

    standard_group: Optional['StandardGroups'] = Relationship(back_populates='standards')
    eval_chat_feedbacks: List['EvalChatFeedbacks'] = Relationship(back_populates='standard')
    simulation_chat_feedbacks: List['SimulationChatFeedbacks'] = Relationship(back_populates='standard')


class EvalChats(_Base, table=True):
    __tablename__ = 'eval_chats'
    __table_args__ = (
        ForeignKeyConstraint(['eval_run_id'], ['eval_runs.id'], ondelete='CASCADE', name='eval_chats_eval_run_id_fkey'),
        ForeignKeyConstraint(['scenario_id'], ['scenarios.id'], ondelete='CASCADE', name='eval_chats_scenario_id_fkey'),
        PrimaryKeyConstraint('id', name='eval_chats_pkey')
    )

    id: uuid.UUID = Field(sa_column=Column('id', Uuid(as_uuid=True), primary_key=True, server_default=text('gen_random_uuid()')))
    created_at: datetime = Field(sa_column=Column('created_at', DateTime(True), server_default=text('now()')))
    title: str = Field(sa_column=Column('title', Text))
    scenario_id: uuid.UUID = Field(sa_column=Column('scenario_id', Uuid(as_uuid=True)))
    eval_run_id: uuid.UUID = Field(sa_column=Column('eval_run_id', Uuid(as_uuid=True)))
    completed: bool = Field(sa_column=Column('completed', Boolean, server_default=text('false')))
    completed_at: Optional[datetime] = Field(default=None, sa_column=Column('completed_at', DateTime(True)))

    eval_run: Optional['EvalRuns'] = Relationship(back_populates='eval_chats')
    scenario: Optional['Scenarios'] = Relationship(back_populates='eval_chats')
    eval_chat_grades: List['EvalChatGrades'] = Relationship(back_populates='eval_chat')
    eval_messages: List['EvalMessages'] = Relationship(back_populates='chat')


class SimulationChats(_Base, table=True):
    __tablename__ = 'simulation_chats'
    __table_args__ = (
        ForeignKeyConstraint(['attempt_id'], ['simulation_attempts.id'], ondelete='CASCADE', name='simulation_chats_attempt_id_fkey'),
        ForeignKeyConstraint(['scenario_id'], ['scenarios.id'], ondelete='CASCADE', name='simulation_chats_scenario_id_fkey'),
        PrimaryKeyConstraint('id', name='simulation_chats_pkey')
    )

    id: uuid.UUID = Field(sa_column=Column('id', Uuid(as_uuid=True), primary_key=True, server_default=text('gen_random_uuid()')))
    created_at: datetime = Field(sa_column=Column('created_at', DateTime(True), server_default=text('now()')))
    title: str = Field(sa_column=Column('title', Text))
    scenario_id: uuid.UUID = Field(sa_column=Column('scenario_id', Uuid(as_uuid=True)))
    attempt_id: uuid.UUID = Field(sa_column=Column('attempt_id', Uuid(as_uuid=True)))
    completed: bool = Field(sa_column=Column('completed', Boolean, server_default=text('false')))
    completed_at: Optional[datetime] = Field(default=None, sa_column=Column('completed_at', DateTime(True)))

    attempt: Optional['SimulationAttempts'] = Relationship(back_populates='simulation_chats')
    scenario: Optional['Scenarios'] = Relationship(back_populates='simulation_chats')
    simulation_chat_grades: List['SimulationChatGrades'] = Relationship(back_populates='simulation_chat')
    simulation_messages: List['SimulationMessages'] = Relationship(back_populates='chat')


class EvalChatGrades(_Base, table=True):
    __tablename__ = 'eval_chat_grades'
    __table_args__ = (
        ForeignKeyConstraint(['eval_chat_id'], ['eval_chats.id'], ondelete='CASCADE', name='eval_chat_grades_eval_chat_id_fkey'),
        ForeignKeyConstraint(['rubric_id'], ['rubrics.id'], ondelete='CASCADE', name='eval_chat_grades_rubric_id_fkey'),
        PrimaryKeyConstraint('id', name='eval_chat_grades_pkey')
    )

    id: uuid.UUID = Field(sa_column=Column('id', Uuid(as_uuid=True), primary_key=True, server_default=text('gen_random_uuid()')))
    created_at: datetime = Field(sa_column=Column('created_at', DateTime(True), server_default=text('now()')))
    passed: bool = Field(sa_column=Column('passed', Boolean))
    score: int = Field(sa_column=Column('score', Integer))
    time_taken: int = Field(sa_column=Column('time_taken', Integer))
    rubric_id: uuid.UUID = Field(sa_column=Column('rubric_id', Uuid(as_uuid=True)))
    eval_chat_id: uuid.UUID = Field(sa_column=Column('eval_chat_id', Uuid(as_uuid=True)))

    eval_chat: Optional['EvalChats'] = Relationship(back_populates='eval_chat_grades')
    rubric: Optional['Rubrics'] = Relationship(back_populates='eval_chat_grades')
    eval_chat_feedbacks: List['EvalChatFeedbacks'] = Relationship(back_populates='eval_chat_grade')


class EvalMessages(_Base, table=True):
    __tablename__ = 'eval_messages'
    __table_args__ = (
        ForeignKeyConstraint(['chat_id'], ['eval_chats.id'], ondelete='CASCADE', name='eval_messages_chat_id_fkey'),
        PrimaryKeyConstraint('id', name='eval_messages_pkey')
    )

    id: uuid.UUID = Field(sa_column=Column('id', Uuid(as_uuid=True), primary_key=True, server_default=text('gen_random_uuid()')))
    created_at: datetime = Field(sa_column=Column('created_at', DateTime(True), server_default=text('now()')))
    chat_id: uuid.UUID = Field(sa_column=Column('chat_id', Uuid(as_uuid=True)))
    content: str = Field(sa_column=Column('content', Text))
    type: str = Field(sa_column=Column('type', Enum('query', 'response', name='eval_message_type')))
    completed: bool = Field(sa_column=Column('completed', Boolean, server_default=text('false')))

    chat: Optional['EvalChats'] = Relationship(back_populates='eval_messages')


class SimulationChatGrades(_Base, table=True):
    __tablename__ = 'simulation_chat_grades'
    __table_args__ = (
        ForeignKeyConstraint(['rubric_id'], ['rubrics.id'], ondelete='CASCADE', name='simulation_chat_grades_rubric_id_fkey'),
        ForeignKeyConstraint(['simulation_chat_id'], ['simulation_chats.id'], ondelete='CASCADE', name='simulation_chat_grades_simulation_chat_id_fkey'),
        PrimaryKeyConstraint('id', name='simulation_chat_grades_pkey')
    )

    id: uuid.UUID = Field(sa_column=Column('id', Uuid(as_uuid=True), primary_key=True, server_default=text('gen_random_uuid()')))
    created_at: datetime = Field(sa_column=Column('created_at', DateTime(True), server_default=text('now()')))
    passed: bool = Field(sa_column=Column('passed', Boolean))
    score: int = Field(sa_column=Column('score', Integer))
    time_taken: int = Field(sa_column=Column('time_taken', Integer))
    rubric_id: uuid.UUID = Field(sa_column=Column('rubric_id', Uuid(as_uuid=True)))
    simulation_chat_id: uuid.UUID = Field(sa_column=Column('simulation_chat_id', Uuid(as_uuid=True)))

    rubric: Optional['Rubrics'] = Relationship(back_populates='simulation_chat_grades')
    simulation_chat: Optional['SimulationChats'] = Relationship(back_populates='simulation_chat_grades')
    simulation_chat_feedbacks: List['SimulationChatFeedbacks'] = Relationship(back_populates='simulation_chat_grade')


class SimulationMessages(_Base, table=True):
    __tablename__ = 'simulation_messages'
    __table_args__ = (
        ForeignKeyConstraint(['chat_id'], ['simulation_chats.id'], ondelete='CASCADE', name='simulation_messages_chat_id_fkey'),
        PrimaryKeyConstraint('id', name='simulation_messages_pkey')
    )

    id: uuid.UUID = Field(sa_column=Column('id', Uuid(as_uuid=True), primary_key=True, server_default=text('gen_random_uuid()')))
    created_at: datetime = Field(sa_column=Column('created_at', DateTime(True), server_default=text('now()')))
    chat_id: uuid.UUID = Field(sa_column=Column('chat_id', Uuid(as_uuid=True)))
    query: str = Field(sa_column=Column('query', Text))
    response: str = Field(sa_column=Column('response', Text))
    completed: bool = Field(sa_column=Column('completed', Boolean, server_default=text('false')))

    chat: Optional['SimulationChats'] = Relationship(back_populates='simulation_messages')


class EvalChatFeedbacks(_Base, table=True):
    __tablename__ = 'eval_chat_feedbacks'
    __table_args__ = (
        ForeignKeyConstraint(['eval_chat_grade_id'], ['eval_chat_grades.id'], ondelete='CASCADE', name='eval_chat_feedbacks_eval_chat_grade_id_fkey'),
        ForeignKeyConstraint(['standard_id'], ['standards.id'], ondelete='CASCADE', name='eval_chat_feedbacks_standard_id_fkey'),
        PrimaryKeyConstraint('id', name='eval_chat_feedbacks_pkey')
    )

    id: uuid.UUID = Field(sa_column=Column('id', Uuid(as_uuid=True), primary_key=True, server_default=text('gen_random_uuid()')))
    created_at: datetime = Field(sa_column=Column('created_at', DateTime(True), server_default=text('now()')))
    standard_id: uuid.UUID = Field(sa_column=Column('standard_id', Uuid(as_uuid=True)))
    eval_chat_grade_id: uuid.UUID = Field(sa_column=Column('eval_chat_grade_id', Uuid(as_uuid=True)))
    total: int = Field(sa_column=Column('total', Integer))
    feedback: Optional[str] = Field(default=None, sa_column=Column('feedback', Text))

    eval_chat_grade: Optional['EvalChatGrades'] = Relationship(back_populates='eval_chat_feedbacks')
    standard: Optional['Standards'] = Relationship(back_populates='eval_chat_feedbacks')


class SimulationChatFeedbacks(_Base, table=True):
    __tablename__ = 'simulation_chat_feedbacks'
    __table_args__ = (
        ForeignKeyConstraint(['simulation_chat_grade_id'], ['simulation_chat_grades.id'], ondelete='CASCADE', name='simulation_chat_feedbacks_simulation_chat_grade_id_fkey'),
        ForeignKeyConstraint(['standard_id'], ['standards.id'], ondelete='CASCADE', name='simulation_chat_feedbacks_standard_id_fkey'),
        PrimaryKeyConstraint('id', name='simulation_chat_feedbacks_pkey')
    )

    id: uuid.UUID = Field(sa_column=Column('id', Uuid(as_uuid=True), primary_key=True, server_default=text('gen_random_uuid()')))
    created_at: datetime = Field(sa_column=Column('created_at', DateTime(True), server_default=text('now()')))
    standard_id: uuid.UUID = Field(sa_column=Column('standard_id', Uuid(as_uuid=True)))
    simulation_chat_grade_id: uuid.UUID = Field(sa_column=Column('simulation_chat_grade_id', Uuid(as_uuid=True)))
    total: int = Field(sa_column=Column('total', Integer))
    feedback: Optional[str] = Field(default=None, sa_column=Column('feedback', Text))

    simulation_chat_grade: Optional['SimulationChatGrades'] = Relationship(back_populates='simulation_chat_feedbacks')
    standard: Optional['Standards'] = Relationship(back_populates='simulation_chat_feedbacks')
