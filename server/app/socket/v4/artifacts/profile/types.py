"""WebSocket-specific types for profile generation."""

from app.api.v4.artifacts.profile.types import GetProfileApiRequest, ProfileFlagConfig
from app.api.v4.resources.cohorts.types import QGetCohortsV4Item
from app.socket.v4.artifacts.types import (
    GenerationCompleteEvent,
    GenerationErrorEvent,
    GenerationProgressEvent,
)
from app.sql.types import (
    QGetDepartmentsV4Item,
    QGetEmailsV4Item,
    QGetNamesV4Item,
    QGetRequestLimitsV4Item,
)


class GenerateProfilePayload(GetProfileApiRequest):
    """Client-to-server payload for `profile_generate`."""

    resource_types: list[str]
    user_instructions: list[str] | None = None
    staff_id: str | None = None


class ProfileGenerationCompleteEvent(GenerationCompleteEvent):
    """Server-to-client event: profile generation complete."""

    artifact_type: str = "profile"

    name_resource: QGetNamesV4Item | None = None
    request_limit_resource: QGetRequestLimitsV4Item | None = None
    email_resources: list[QGetEmailsV4Item] | None = None
    department_resources: list[QGetDepartmentsV4Item] | None = None
    cohort_resources: list[QGetCohortsV4Item] | None = None
    flag_resource: ProfileFlagConfig | None = None


class ProfileGenerationProgressEvent(GenerationProgressEvent):
    artifact_type: str = "profile"


class ProfileGenerationErrorEvent(GenerationErrorEvent):
    artifact_type: str = "profile"
