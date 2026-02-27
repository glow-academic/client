"""Handcrafted types for rubric artifact endpoints."""

from __future__ import annotations

from uuid import UUID

from pydantic import BaseModel

from app.api.v4.artifacts.types import InternalResponseBase
from app.api.v4.entries.runs.search import GetRunListViewResponse
from app.api.v4.types import BaseResourceSection, ListFilterSection
from app.sql.types import (
    QGetDepartmentsV4Item,
    QGetDescriptionsV4Item,
    QGetNamesV4Item,
    QGetPointsV4Item,
    QGetRubricDraftsEntriesV4Item,
    QGetStandardGroupsV4Item,
    QGetStandardsV4Item,
)


class RubricFlagConfig(BaseModel):
    """Enriched flag config for direct client consumption."""

    key: str
    label: str
    description: str | None = None
    icon_id: str | None = None
    flag_option_id: UUID | None = None
    show: bool = True
    required: bool = False
    generated: bool | None = None


class RubricNameSection(BaseResourceSection):
    resource: QGetNamesV4Item | None = None
    resources: list[QGetNamesV4Item] | None = None


class RubricDescriptionSection(BaseResourceSection):
    resource: QGetDescriptionsV4Item | None = None
    resources: list[QGetDescriptionsV4Item] | None = None


class RubricFlagSection(BaseResourceSection):
    current: list[RubricFlagConfig] | None = None
    resources: list[RubricFlagConfig] | None = None


class RubricDepartmentSection(BaseResourceSection):
    current: list[QGetDepartmentsV4Item] | None = None
    resources: list[QGetDepartmentsV4Item] | None = None


class RubricPointsSection(BaseResourceSection):
    resource: QGetPointsV4Item | None = None
    resources: list[QGetPointsV4Item] | None = None


class RubricPassPointsSection(BaseResourceSection):
    resource: QGetPointsV4Item | None = None
    resources: list[QGetPointsV4Item] | None = None


class RubricStandardGroupsSection(BaseResourceSection):
    current: list[QGetStandardGroupsV4Item] | None = None
    resources: list[QGetStandardGroupsV4Item] | None = None


class RubricStandardsSection(BaseResourceSection):
    current: list[QGetStandardsV4Item] | None = None
    resources: list[QGetStandardsV4Item] | None = None


class GetRubricApiRequest(BaseModel):
    rubric_id: UUID | None = None
    draft_id: UUID | None = None
    description_search: str | None = None
    standard_group_search: str | None = None


class GetRubricApiResponse(BaseModel):
    actor_name: str | None = None
    rubric_exists: bool | None = None
    can_edit: bool | None = None
    disabled_reason: str | None = None
    draft_version: int | None = None
    group_id: UUID | None = None

    basic_show_ai_generate: bool | None = None
    content_show_ai_generate: bool | None = None

    names: RubricNameSection | None = None
    descriptions: RubricDescriptionSection | None = None
    flags: RubricFlagSection | None = None
    departments: RubricDepartmentSection | None = None
    points: RubricPointsSection | None = None
    pass_points: RubricPassPointsSection | None = None
    standard_groups: RubricStandardGroupsSection | None = None
    standards: RubricStandardsSection | None = None


class RubricWebsocketEntries(BaseModel):
    draft_rubric: QGetRubricDraftsEntriesV4Item | None = None
    runs: GetRunListViewResponse | None = None


class RubricWebsocketResources(BaseModel):
    names: list[QGetNamesV4Item] | None = None
    descriptions: list[QGetDescriptionsV4Item] | None = None
    flags: list[RubricFlagConfig] | None = None
    departments: list[QGetDepartmentsV4Item] | None = None
    points: list[QGetPointsV4Item] | None = None
    pass_points: list[QGetPointsV4Item] | None = None
    standard_groups: list[QGetStandardGroupsV4Item] | None = None
    standards: list[QGetStandardsV4Item] | None = None


class GetRubricWebsocketResponse(InternalResponseBase):
    entries: RubricWebsocketEntries | None = None
    resources: RubricWebsocketResources


class RubricResourceAction(BaseModel):
    resource_id: UUID | None = None
    create_tool_id: UUID | None = None
    link_tool_id: UUID | None = None


class RubricMultiResourceAction(BaseModel):
    resource_ids: list[UUID] | None = None
    create_tool_id: UUID | None = None
    link_tool_id: UUID | None = None


class SaveRubricApiRequest(BaseModel):
    input_rubric_id: UUID | None = None
    name_id: UUID
    description_id: UUID | None = None
    flag_id: UUID | None = None
    department_ids: list[UUID] | None = None
    total_points_id: UUID | None = None
    pass_points_id: UUID | None = None
    standard_group_ids: list[UUID] | None = None
    standard_ids: list[UUID] | None = None


class SaveRubricApiResponse(BaseModel):
    success: bool
    rubric_id: UUID
    message: str


class SaveRubricSqlParams(BaseModel):
    profile_id: UUID
    group_id: UUID
    input_rubric_id: UUID | None = None
    names: RubricResourceAction
    descriptions: RubricResourceAction
    flags: RubricResourceAction
    departments: RubricMultiResourceAction
    points: RubricResourceAction
    pass_points: RubricResourceAction
    standard_groups: RubricMultiResourceAction
    standards: RubricMultiResourceAction

    @classmethod
    def from_request(
        cls,
        request: SaveRubricApiRequest,
        profile_id: UUID,
        group_id: UUID | None,
    ) -> SaveRubricSqlParams:
        return cls(
            profile_id=profile_id,
            group_id=group_id,
            input_rubric_id=request.input_rubric_id,
            names=RubricResourceAction(resource_id=request.name_id),
            descriptions=RubricResourceAction(resource_id=request.description_id),
            flags=RubricResourceAction(resource_id=request.flag_id),
            departments=RubricMultiResourceAction(resource_ids=request.department_ids),
            points=RubricResourceAction(resource_id=request.total_points_id),
            pass_points=RubricResourceAction(resource_id=request.pass_points_id),
            standard_groups=RubricMultiResourceAction(
                resource_ids=request.standard_group_ids
            ),
            standards=RubricMultiResourceAction(resource_ids=request.standard_ids),
        )

    def to_tuple(self) -> tuple:
        return (
            self.profile_id,
            self.group_id,
            self.input_rubric_id,
            self.names.model_dump(),
            self.descriptions.model_dump(),
            self.flags.model_dump(),
            self.departments.model_dump(),
            self.points.model_dump(),
            self.pass_points.model_dump(),
            self.standard_groups.model_dump(),
            self.standards.model_dump(),
        )


class SaveRubricSqlRow(BaseModel):
    rubric_id: UUID | None = None
    actor_name: str | None = None


class DeleteRubricApiRequest(BaseModel):
    rubric_id: UUID


class DeleteRubricApiResponse(BaseModel):
    success: bool
    message: str


class DuplicateRubricApiRequest(BaseModel):
    rubric_id: UUID


class DuplicateRubricApiResponse(BaseModel):
    success: bool
    rubric_id: UUID
    message: str


class PatchRubricDraftApiRequest(BaseModel):
    input_draft_id: UUID | None = None
    group_id: UUID | None = None
    name_id: UUID | None = None
    description_id: UUID | None = None
    flag_id: UUID | None = None
    department_ids: list[UUID] | None = None
    total_points_id: UUID | None = None
    pass_points_id: UUID | None = None
    standard_group_ids: list[UUID] | None = None
    standard_ids: list[UUID] | None = None
    expected_version: int = 0


class PatchRubricDraftApiResponse(BaseModel):
    success: bool
    draft_id: UUID
    new_version: int
    message: str


class PatchRubricDraftSqlParams(BaseModel):
    profile_id: UUID
    input_draft_id: UUID | None = None
    group_id: UUID | None = None
    names: RubricResourceAction
    descriptions: RubricResourceAction
    flags: RubricResourceAction
    departments: RubricMultiResourceAction
    points: RubricResourceAction
    pass_points: RubricResourceAction
    standard_groups: RubricMultiResourceAction
    standards: RubricMultiResourceAction
    expected_version: int = 0

    @classmethod
    def from_request(
        cls, request: PatchRubricDraftApiRequest, profile_id: UUID
    ) -> PatchRubricDraftSqlParams:
        return cls(
            profile_id=profile_id,
            input_draft_id=request.input_draft_id,
            group_id=request.group_id,
            names=RubricResourceAction(resource_id=request.name_id),
            descriptions=RubricResourceAction(resource_id=request.description_id),
            flags=RubricResourceAction(resource_id=request.flag_id),
            departments=RubricMultiResourceAction(resource_ids=request.department_ids),
            points=RubricResourceAction(resource_id=request.total_points_id),
            pass_points=RubricResourceAction(resource_id=request.pass_points_id),
            standard_groups=RubricMultiResourceAction(
                resource_ids=request.standard_group_ids
            ),
            standards=RubricMultiResourceAction(resource_ids=request.standard_ids),
            expected_version=request.expected_version,
        )

    def to_tuple(self) -> tuple:
        return (
            self.profile_id,
            self.input_draft_id,
            self.group_id,
            self.names.model_dump(),
            self.descriptions.model_dump(),
            self.flags.model_dump(),
            self.departments.model_dump(),
            self.points.model_dump(),
            self.pass_points.model_dump(),
            self.standard_groups.model_dump(),
            self.standards.model_dump(),
            self.expected_version,
        )


class PatchRubricDraftSqlRow(BaseModel):
    draft_id: UUID | None = None
    new_version: int | None = None
    draft_exists: bool | None = None


# ========== List Endpoint Types ==========


class ListRubricApiRubric(BaseModel):
    rubric_id: UUID | None = None
    name: str | None = None
    description: str | None = None
    points: int | None = None
    pass_points: int | None = None
    pass_percentage: int | None = None
    department_ids: list[str] | None = None
    simulation_ids: list[str] | None = None
    active_simulation_count: int | None = None
    can_edit: bool | None = None
    can_delete: bool | None = None
    can_duplicate: bool | None = None
    standard_group_ids: list[UUID] | None = None


class ListRubricApiStandardGroup(BaseModel):
    standard_group_id: UUID | None = None
    rubric_id: UUID | None = None
    name: str | None = None
    description: str | None = None
    points: int | None = None
    pass_points: int | None = None


class ListRubricApiStandard(BaseModel):
    standard_id: UUID | None = None
    standard_group_id: UUID | None = None
    name: str | None = None
    description: str | None = None
    points: int | None = None


class ListRubricApiResponse(BaseModel):
    actor_name: str | None = None
    rubrics: list[ListRubricApiRubric] | None = None
    standard_groups: list[ListRubricApiStandardGroup] | None = None
    standards: list[ListRubricApiStandard] | None = None
    department_filter: ListFilterSection | None = None
    simulation_filter: ListFilterSection | None = None
    total_count: int | None = None
