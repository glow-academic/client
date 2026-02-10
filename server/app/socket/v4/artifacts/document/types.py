"""WebSocket-specific types for document generation.

Extends base artifact types with document-specific fields.
Types are registered in OpenAPI via FastAPI endpoints, enabling
automatic type extraction in the frontend via InputOf/OutputOf.
"""

from app.api.v4.artifacts.document.types import GetDocumentApiRequest
from app.socket.v4.artifacts.types import (
    GenerationCompleteEvent,
    GenerationErrorEvent,
    GenerationProgressEvent,
)
from app.sql.types import (
    QGetDepartmentsV4Item,
    QGetDescriptionsV4Item,
    QGetFlagsV4Item,
    QGetImagesV4Item,
    QGetNamesV4Item,
    QGetParameterFieldsV4Item,
    QGetTextsV4Item,
    QGetUploadsV4Item,
)

# =============================================================================
# Client-to-Server Events (document_generate)
# =============================================================================


class GenerateDocumentPayload(GetDocumentApiRequest):
    """Request payload for document_generate WebSocket event.

    Extends GetDocumentApiRequest (which has document_id, draft_id)
    with generation-specific fields.
    """

    # Generation-specific fields - resource_types API (gold standard pattern)
    resource_types: list[str]  # Required: which resource types to generate
    user_instructions: list[str] | None = None  # Optional: user instructions


# =============================================================================
# Server-to-Client Events
# =============================================================================


class DocumentGenerationCompleteEvent(GenerationCompleteEvent):
    """Server-to-client event: document_generation_complete.

    Emitted when a document resource generation completes successfully.
    Contains full resource objects (not just IDs) for immediate frontend use.
    """

    artifact_type: str = "document"

    # Single-select resources (full objects, not IDs)
    name_resource: QGetNamesV4Item | None = None
    description_resource: QGetDescriptionsV4Item | None = None
    flag_resource: QGetFlagsV4Item | None = None

    # Multi-select resources (arrays of full objects)
    department_resources: list[QGetDepartmentsV4Item] | None = None
    field_resources: list[QGetParameterFieldsV4Item] | None = None
    upload_resources: list[QGetUploadsV4Item] | None = None
    image_resources: list[QGetImagesV4Item] | None = None
    text_resources: list[QGetTextsV4Item] | None = None


class DocumentGenerationProgressEvent(GenerationProgressEvent):
    """Server-to-client event: document_generation_progress.

    Emitted during document resource generation to show progress.
    """

    artifact_type: str = "document"


class DocumentGenerationErrorEvent(GenerationErrorEvent):
    """Server-to-client event: document_generation_error.

    Emitted when document resource generation fails.
    """

    artifact_type: str = "document"
