"""WebSocket-specific types for field generation (resource-type based)."""

from app.api.v4.artifacts.field.types import GetFieldApiRequest
from app.socket.v4.artifacts.types import (
    GenerationCompleteEvent,
    GenerationErrorEvent,
    GenerationProgressEvent,
)
from app.sql.types import (
    QGetDepartmentsV4Item,
    QGetDescriptionsV4Item,
    QGetFlagsV4Item,
    QGetNamesV4Item,
    QGetParametersV4Item,
)


class GenerateFieldPayload(GetFieldApiRequest):
    """Request payload for field_generate websocket event."""

    resource_types: list[str]
    user_instructions: list[str] | None = None


class FieldGenerationCompleteEvent(GenerationCompleteEvent):
    artifact_type: str = "field"

    name_resource: QGetNamesV4Item | None = None
    description_resource: QGetDescriptionsV4Item | None = None
    flag_resource: QGetFlagsV4Item | None = None

    department_resources: list[QGetDepartmentsV4Item] | None = None
    conditional_parameter_resources: list[QGetParametersV4Item] | None = None


class FieldGenerationProgressEvent(GenerationProgressEvent):
    artifact_type: str = "field"


class FieldGenerationErrorEvent(GenerationErrorEvent):
    artifact_type: str = "field"
