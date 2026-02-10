"""Handcrafted types for auth artifact endpoints."""

from __future__ import annotations

from uuid import UUID

from pydantic import BaseModel

from app.api.v4.views.drafts.types import DraftAuthViewItem
from app.sql.types import (
    QGetAgentsV4Item,
    QGetDescriptionsV4Item,
    QGetModelsV4Item,
    QGetNamesV4Item,
    QGetProtocolsV4Item,
    QGetProvidersV4Item,
    QGetSlugsV4Item,
    QGetToolsV4Item,
)


class AuthFlagConfig(BaseModel):
    """Enriched flag config for direct client consumption."""

    key: str
    label: str
    description: str | None = None
    icon_id: str | None = None
    flag_option_id: UUID | None = None
    show: bool = True
    required: bool = False
    generated: bool | None = None


class AuthItemResource(BaseModel):
    """Auth item resource shape for client/editing."""

    auth_item_id: UUID | None = None
    name: str | None = None
    description: str | None = None
    position: int | None = None
    active: bool | None = None
    value_masked: str | None = None
    key_id: UUID | None = None
    encrypted: bool | None = None
    generated: bool | None = None


class BaseResourceSection(BaseModel):
    """Common metadata fields for all auth resource sections."""

    show: bool = False
    required: bool = False
    suggestions: list[UUID] | None = None
    show_ai_generate: bool = False
    create_tool_id: UUID | None = None
    link_tool_id: UUID | None = None


class AuthNameSection(BaseResourceSection):
    resource: QGetNamesV4Item | None = None
    resources: list[QGetNamesV4Item] | None = None


class AuthDescriptionSection(BaseResourceSection):
    resource: QGetDescriptionsV4Item | None = None
    resources: list[QGetDescriptionsV4Item] | None = None


class AuthFlagSection(BaseResourceSection):
    current: list[AuthFlagConfig] | None = None
    resources: list[AuthFlagConfig] | None = None


class AuthProtocolSection(BaseResourceSection):
    current: list[QGetProtocolsV4Item] | None = None
    resources: list[QGetProtocolsV4Item] | None = None


class AuthSlugSection(BaseResourceSection):
    current: list[QGetSlugsV4Item] | None = None
    resources: list[QGetSlugsV4Item] | None = None


class AuthItemSection(BaseResourceSection):
    current: list[AuthItemResource] | None = None
    resources: list[AuthItemResource] | None = None


class GetAuthApiRequest(BaseModel):
    """Request model for get auth endpoint."""

    auth_id: UUID | None = None
    draft_id: UUID | None = None


class GetAuthApiResponse(BaseModel):
    """Response model for get auth endpoint."""

    actor_name: str | None = None
    auth_exists: bool | None = None
    can_edit: bool | None = None
    disabled_reason: str | None = None
    draft_version: int | None = None
    group_id: UUID | None = None

    basic_show_ai_generate: bool | None = None

    names: AuthNameSection | None = None
    descriptions: AuthDescriptionSection | None = None
    flags: AuthFlagSection | None = None
    protocols: AuthProtocolSection | None = None
    slugs: AuthSlugSection | None = None
    items: AuthItemSection | None = None


class AuthWebsocketViews(BaseModel):
    draft_auth: DraftAuthViewItem | None = None


class AuthWebsocketResources(BaseModel):
    names: list[QGetNamesV4Item] | None = None
    descriptions: list[QGetDescriptionsV4Item] | None = None
    flags: list[AuthFlagConfig] | None = None
    protocols: list[QGetProtocolsV4Item] | None = None
    slugs: list[QGetSlugsV4Item] | None = None
    items: list[AuthItemResource] | None = None
    agents: list[QGetAgentsV4Item] | None = None
    models: list[QGetModelsV4Item] | None = None
    providers: list[QGetProvidersV4Item] | None = None
    tools: list[QGetToolsV4Item] | None = None


class GetAuthWebsocketResponse(BaseModel):
    """Minimal response for WebSocket handlers."""

    views: AuthWebsocketViews | None = None
    resources: AuthWebsocketResources
    resource_agent_ids: dict[str, UUID | None] | None = None
    group_id: UUID | None = None


class AuthResourceAction(BaseModel):
    resource_id: UUID | None = None
    create_tool_id: UUID | None = None
    link_tool_id: UUID | None = None


class AuthMultiResourceAction(BaseModel):
    resource_ids: list[UUID] | None = None
    create_tool_id: UUID | None = None
    link_tool_id: UUID | None = None


class SaveAuthItemInput(BaseModel):
    """Auth item input for save/draft endpoints."""

    name: str
    description: str | None = None
    encrypted: bool = True
    position: int | None = None
    active: bool = True
    key_id: UUID | None = None


class AuthItemAction(BaseModel):
    items: list[SaveAuthItemInput] | None = None
    create_tool_id: UUID | None = None
    link_tool_id: UUID | None = None


class SaveAuthApiRequest(BaseModel):
    """Request model for save auth endpoint."""

    group_id: UUID
    input_auth_id: UUID | None = None
    names: AuthResourceAction
    descriptions: AuthResourceAction
    flags: AuthResourceAction
    protocols: AuthMultiResourceAction
    slugs: AuthMultiResourceAction
    items: AuthItemAction | None = None


class SaveAuthApiResponse(BaseModel):
    """Response model for save auth endpoint."""

    success: bool
    auth_id: UUID
    message: str


class SaveAuthSqlParams(BaseModel):
    """SQL parameters for save auth."""

    profile_id: UUID
    group_id: UUID
    input_auth_id: UUID | None = None
    names: AuthResourceAction
    descriptions: AuthResourceAction
    flags: AuthResourceAction
    protocols: AuthMultiResourceAction
    slugs: AuthMultiResourceAction
    items: AuthItemAction

    @classmethod
    def from_request(
        cls, request: SaveAuthApiRequest, profile_id: UUID
    ) -> SaveAuthSqlParams:
        return cls(
            profile_id=profile_id,
            group_id=request.group_id,
            input_auth_id=request.input_auth_id,
            names=request.names,
            descriptions=request.descriptions,
            flags=request.flags,
            protocols=request.protocols,
            slugs=request.slugs,
            items=request.items or AuthItemAction(items=[]),
        )

    def to_tuple(self) -> tuple:
        def single(a: AuthResourceAction) -> tuple:
            return (a.resource_id, a.create_tool_id, a.link_tool_id)

        def multi(a: AuthMultiResourceAction) -> tuple:
            return (a.resource_ids, a.create_tool_id, a.link_tool_id)

        def item_input(i: SaveAuthItemInput) -> tuple:
            return (
                i.name,
                i.description,
                i.encrypted,
                i.position,
                i.active,
                i.key_id,
            )

        def items_action(a: AuthItemAction) -> tuple:
            item_rows = [item_input(i) for i in (a.items or [])]
            return (item_rows, a.create_tool_id, a.link_tool_id)

        return (
            self.profile_id,
            self.group_id,
            self.input_auth_id,
            single(self.names),
            single(self.descriptions),
            single(self.flags),
            multi(self.protocols),
            multi(self.slugs),
            items_action(self.items),
        )


class SaveAuthSqlRow(BaseModel):
    """SQL row for save auth."""

    auth_id: UUID | None = None
    actor_name: str | None = None


class DeleteAuthApiRequest(BaseModel):
    """Request model for delete auth endpoint."""

    auth_id: UUID


class DeleteAuthApiResponse(BaseModel):
    """Response model for delete auth endpoint."""

    success: bool
    message: str


class DuplicateAuthApiRequest(BaseModel):
    """Request model for duplicate auth endpoint."""

    auth_id: UUID


class DuplicateAuthApiResponse(BaseModel):
    """Response model for duplicate auth endpoint."""

    success: bool
    auth_id: UUID
    message: str


class PatchAuthDraftApiRequest(BaseModel):
    """Request model for patch auth draft endpoint."""

    input_draft_id: UUID | None = None
    group_id: UUID | None = None
    names: AuthResourceAction | None = None
    descriptions: AuthResourceAction | None = None
    flags: AuthResourceAction | None = None
    protocols: AuthMultiResourceAction | None = None
    slugs: AuthMultiResourceAction | None = None
    items: AuthItemAction | None = None
    expected_version: int = 0


class PatchAuthDraftApiResponse(BaseModel):
    """Response model for patch auth draft endpoint."""

    success: bool
    draft_id: UUID
    new_version: int
    message: str


class PatchAuthDraftSqlParams(BaseModel):
    """SQL parameters for patch auth draft."""

    profile_id: UUID
    input_draft_id: UUID | None = None
    group_id: UUID | None = None
    names: AuthResourceAction
    descriptions: AuthResourceAction
    flags: AuthResourceAction
    protocols: AuthMultiResourceAction
    slugs: AuthMultiResourceAction
    items: AuthItemAction
    expected_version: int = 0

    @classmethod
    def from_request(
        cls, request: PatchAuthDraftApiRequest, profile_id: UUID
    ) -> PatchAuthDraftSqlParams:
        empty_single = AuthResourceAction()
        empty_multi = AuthMultiResourceAction()
        return cls(
            profile_id=profile_id,
            input_draft_id=request.input_draft_id,
            group_id=request.group_id,
            names=request.names or empty_single,
            descriptions=request.descriptions or empty_single,
            flags=request.flags or empty_single,
            protocols=request.protocols or empty_multi,
            slugs=request.slugs or empty_multi,
            items=request.items or AuthItemAction(items=[]),
            expected_version=request.expected_version,
        )

    def to_tuple(self) -> tuple:
        def single(a: AuthResourceAction) -> tuple:
            return (a.resource_id, a.create_tool_id, a.link_tool_id)

        def multi(a: AuthMultiResourceAction) -> tuple:
            return (a.resource_ids, a.create_tool_id, a.link_tool_id)

        def item_input(i: SaveAuthItemInput) -> tuple:
            return (
                i.name,
                i.description,
                i.encrypted,
                i.position,
                i.active,
                i.key_id,
            )

        def items_action(a: AuthItemAction) -> tuple:
            item_rows = [item_input(i) for i in (a.items or [])]
            return (item_rows, a.create_tool_id, a.link_tool_id)

        return (
            self.profile_id,
            self.input_draft_id,
            self.group_id,
            single(self.names),
            single(self.descriptions),
            single(self.flags),
            multi(self.protocols),
            multi(self.slugs),
            items_action(self.items),
            self.expected_version,
        )


class PatchAuthDraftSqlRow(BaseModel):
    """SQL row for patch auth draft."""

    draft_id: UUID | None = None
    new_version: int | None = None
    draft_exists: bool | None = None


class ListAuthApiAuth(BaseModel):
    """Auth type for list endpoint with computed permissions."""

    auth_id: UUID | None = None
    name: str | None = None
    description: str | None = None
    protocol_count: int | None = None
    slug_count: int | None = None
    item_count: int | None = None
    is_inactive: bool | None = None
    can_edit: bool | None = None
    can_duplicate: bool | None = None
    can_delete: bool | None = None


class ListAuthApiResponse(BaseModel):
    """Response model for list auth endpoint with computed permissions."""

    actor_name: str | None = None
    auths: list[ListAuthApiAuth] | None = None
    total_count: int | None = None
