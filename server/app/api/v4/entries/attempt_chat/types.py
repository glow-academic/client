"""Canonical attempt chat entry type — single source of truth for entry fields."""

from uuid import UUID

from pydantic import BaseModel


class AttemptChatEntryData(BaseModel):
    """Canonical attempt chat entry fields. All optional for streaming support."""

    id: str | None = None
    attempt_id: str | None = None
    created_at: str | None = None
    title: str | None = None
    group_id: str | None = None
    attempt_chat_id: str | None = None


class CreateAttemptChatEntryRequest(BaseModel):
    run_id: UUID
    title: str = ""
    group_id: UUID | None = None
    chat_id: UUID | None = None
    position: int = 0
    time_limit: int | None = None
    negative_time: bool = False
    audio_enabled: bool = True
    text_enabled: bool = True
    hints_enabled: bool = False
    copy_paste_allowed: bool = True
    show_images: bool = True
    show_objectives: bool = True
    show_problem_statement: bool = True
    analyses_enabled: bool = True
    improvements_enabled: bool = True
    replacements_enabled: bool = True
    strengths_enabled: bool = True
    use_custom: bool = False
    use_previous: bool = False
    problem_statement_enabled: bool = True
    objectives_enabled: bool = True
    video_enabled: bool = False
    images_enabled: bool = False
    questions_enabled: bool = False
    assistant_persona_ids: list[UUID] | None = None
    # Optional connection ID arrays
    rubrics_ids: list[UUID] | None = None
    standards_ids: list[UUID] | None = None
    standard_groups_ids: list[UUID] | None = None
    departments_ids: list[UUID] | None = None
    personas_ids: list[UUID] | None = None
    problem_statements_ids: list[UUID] | None = None
    objectives_ids: list[UUID] | None = None
    questions_ids: list[UUID] | None = None
    options_ids: list[UUID] | None = None
    videos_ids: list[UUID] | None = None
    images_ids: list[UUID] | None = None
    documents_ids: list[UUID] | None = None
    parameter_fields_ids: list[UUID] | None = None


class CreateAttemptChatEntryResponse(BaseModel):
    id: UUID
    call_id: UUID
    message_id: UUID


class CreateAttemptChatEntrySqlParams(BaseModel):
    run_id: UUID
    title: str = ""
    group_id: UUID | None = None
    chat_id: UUID | None = None
    position: int = 0
    time_limit: int | None = None
    negative_time: bool = False
    audio_enabled: bool = True
    text_enabled: bool = True
    hints_enabled: bool = False
    copy_paste_allowed: bool = True
    show_images: bool = True
    show_objectives: bool = True
    show_problem_statement: bool = True
    analyses_enabled: bool = True
    improvements_enabled: bool = True
    replacements_enabled: bool = True
    strengths_enabled: bool = True
    use_custom: bool = False
    use_previous: bool = False
    problem_statement_enabled: bool = True
    objectives_enabled: bool = True
    video_enabled: bool = False
    images_enabled: bool = False
    questions_enabled: bool = False
    assistant_persona_ids: list[UUID] | None = None
    # Optional connection ID arrays
    rubrics_ids: list[UUID] | None = None
    standards_ids: list[UUID] | None = None
    standard_groups_ids: list[UUID] | None = None
    departments_ids: list[UUID] | None = None
    personas_ids: list[UUID] | None = None
    problem_statements_ids: list[UUID] | None = None
    objectives_ids: list[UUID] | None = None
    questions_ids: list[UUID] | None = None
    options_ids: list[UUID] | None = None
    videos_ids: list[UUID] | None = None
    images_ids: list[UUID] | None = None
    documents_ids: list[UUID] | None = None
    parameter_fields_ids: list[UUID] | None = None
    tool_id: UUID | None = None
    upload_id: UUID | None = None
    mcp: bool = False

    def to_tuple(self) -> tuple:
        return (
            self.run_id,
            self.title,
            self.group_id,
            self.chat_id,
            self.position,
            self.time_limit,
            self.negative_time,
            self.audio_enabled,
            self.text_enabled,
            self.hints_enabled,
            self.copy_paste_allowed,
            self.show_images,
            self.show_objectives,
            self.show_problem_statement,
            self.analyses_enabled,
            self.improvements_enabled,
            self.replacements_enabled,
            self.strengths_enabled,
            self.use_custom,
            self.use_previous,
            self.problem_statement_enabled,
            self.objectives_enabled,
            self.video_enabled,
            self.images_enabled,
            self.questions_enabled,
            self.assistant_persona_ids,
            self.rubrics_ids,
            self.standards_ids,
            self.standard_groups_ids,
            self.departments_ids,
            self.personas_ids,
            self.problem_statements_ids,
            self.objectives_ids,
            self.questions_ids,
            self.options_ids,
            self.videos_ids,
            self.images_ids,
            self.documents_ids,
            self.parameter_fields_ids,
            self.tool_id,
            self.upload_id,
            self.mcp,
        )


class CreateAttemptChatEntrySqlRow(BaseModel):
    id: UUID
    call_id: UUID
    message_id: UUID
