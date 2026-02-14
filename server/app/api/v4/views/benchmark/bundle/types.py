"""Types for benchmark bundle view."""

from uuid import UUID

from pydantic import BaseModel, Field


class GetBenchmarkBundleViewResponse(BaseModel):
    """Thin MV-backed view response for a single benchmark bundle."""

    profile_has_access: bool = False
    benchmark_bundle_entry_id: UUID | None = None
    benchmark_id: UUID | None = None
    # 12 bundle-level resource ID arrays
    department_ids: list[UUID] = Field(default_factory=list)
    model_ids: list[UUID] = Field(default_factory=list)
    prompt_ids: list[UUID] = Field(default_factory=list)
    instruction_ids: list[UUID] = Field(default_factory=list)
    voice_ids: list[UUID] = Field(default_factory=list)
    temperature_level_ids: list[UUID] = Field(default_factory=list)
    reasoning_level_ids: list[UUID] = Field(default_factory=list)
    tool_ids: list[UUID] = Field(default_factory=list)
    key_ids: list[UUID] = Field(default_factory=list)
    flag_ids: list[UUID] = Field(default_factory=list)
    name_ids: list[UUID] = Field(default_factory=list)
    description_ids: list[UUID] = Field(default_factory=list)
