"""WebSocket-specific types for profile generation.

Extends base artifact types with profile-specific fields.
Types are registered in OpenAPI via FastAPI endpoints, enabling
automatic type extraction in the frontend via InputOf/OutputOf.
"""

from uuid import UUID

from app.api.v4.artifacts.profile.types import GetProfileApiRequest
from app.api.v4.resources.cohorts.get import QGetCohortsV4Item
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

# =============================================================================
# Client-to-Server Events (profile_generate)
# =============================================================================


class GenerateProfilePayload(GetProfileApiRequest):
    """Request payload for profile_generate WebSocket event.

    Extends GetProfileApiRequest (which has target_profile_id, draft_id)
    with generation-specific fields and form state.
    """

    # Generation-specific fields - domain-based API
    domain_ids: list[UUID]  # Required: which domains to generate
    user_instructions: list[str] | None = None  # Optional: user instructions

    # Current form state (for Jinja context and resource tree)
    name_id: UUID | None = None
    active_flag_id: UUID | None = None
    request_limit_id: UUID | None = None
    email_ids: list[UUID] | None = None
    department_ids: list[UUID] | None = None
    cohort_ids: list[UUID] | None = None

    # Legacy field for backwards compatibility
    staff_id: str | None = None  # Client passes staff_id instead of target_profile_id


# =============================================================================
# Server-to-Client Events
# =============================================================================


class ProfileGenerationCompleteEvent(GenerationCompleteEvent):
    """Server-to-client event: profile_generation_complete.

    Emitted when a profile resource generation completes successfully.
    Contains full resource objects (not just IDs) for immediate frontend use.
    """

    artifact_type: str = "profile"

    # Single-select resources (full objects)
    name_resource: QGetNamesV4Item | None = None
    request_limit_resource: QGetRequestLimitsV4Item | None = None

    # Multi-select resources (arrays of full objects)
    email_resources: list[QGetEmailsV4Item] | None = None
    department_resources: list[QGetDepartmentsV4Item] | None = None
    cohort_resources: list[QGetCohortsV4Item] | None = None

    # Legacy ID fields for backwards compatibility
    name_id: str | None = None
    active_flag_id: str | None = None
    request_limit_id: str | None = None
    email_ids: list[str] | None = None
    department_ids: list[str] | None = None
    cohort_ids: list[str] | None = None


class ProfileGenerationProgressEvent(GenerationProgressEvent):
    """Server-to-client event: profile_generation_progress.

    Emitted during profile resource generation to show progress.
    """

    artifact_type: str = "profile"


class ProfileGenerationErrorEvent(GenerationErrorEvent):
    """Server-to-client event: profile_generation_error.

    Emitted when profile resource generation fails.
    """

    artifact_type: str = "profile"
