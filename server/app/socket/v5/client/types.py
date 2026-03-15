"""Unified client payload types for v5 WebSocket generation.

Instead of per-artifact payload classes (GenerateAgentPayload, GenerateAuthPayload, ...),
v5 uses a single GeneratePayload that carries the artifact_type discriminator and a
generic artifact_id field. The registry maps these to the correct fetcher kwarg.

This module re-exports all client-facing types from their canonical infra locations.
"""

# ═══════════════════════════════════════════════════════════════════════════
# Generation types — canonical location: app.infra.websocket.generation_types
# ═══════════════════════════════════════════════════════════════════════════

from app.infra.websocket.generation_types import (
    ArtifactOperation as ArtifactOperation,
)
from app.infra.websocket.generation_types import (
    ArtifactTypeItem as ArtifactTypeItem,
)
from app.infra.websocket.generation_types import (
    EntryOperation as EntryOperation,
)
from app.infra.websocket.generation_types import (
    EntryTypeItem as EntryTypeItem,
)
from app.infra.websocket.generation_types import (
    GeneratePayload as GeneratePayload,
)
from app.infra.websocket.generation_types import (
    GenerationCompleteEvent as GenerationCompleteEvent,
)
from app.infra.websocket.generation_types import (
    GenerationErrorEvent as GenerationErrorEvent,
)
from app.infra.websocket.generation_types import (
    GenerationMediaCompleteEvent as GenerationMediaCompleteEvent,
)
from app.infra.websocket.generation_types import (
    GenerationMediaProgressEvent as GenerationMediaProgressEvent,
)
from app.infra.websocket.generation_types import (
    GenerationProgressEvent as GenerationProgressEvent,
)
from app.infra.websocket.generation_types import (
    GenerationSavedEvent as GenerationSavedEvent,
)
from app.infra.websocket.generation_types import (
    ResourceOperation as ResourceOperation,
)
from app.infra.websocket.generation_types import (
    ResourceTypeItem as ResourceTypeItem,
)

# ═══════════════════════════════════════════════════════════════════════════
# Connection types — canonical location: app.infra.session.client_types
# ═══════════════════════════════════════════════════════════════════════════

from app.infra.session.client_types import (
    ConnectionConfirmedPayload as ConnectionConfirmedPayload,
)

# ═══════════════════════════════════════════════════════════════════════════
# Attempt types — canonical location: app.infra.attempt.client_types
# ═══════════════════════════════════════════════════════════════════════════

from app.infra.attempt.client_types import (
    AttemptAssistantCompleteEvent as AttemptAssistantCompleteEvent,
)
from app.infra.attempt.client_types import (
    AttemptAssistantHintsEvent as AttemptAssistantHintsEvent,
)
from app.infra.attempt.client_types import (
    AttemptAssistantProgressEvent as AttemptAssistantProgressEvent,
)
from app.infra.attempt.client_types import (
    AttemptAssistantStartEvent as AttemptAssistantStartEvent,
)
from app.infra.attempt.client_types import (
    AttemptAudioEndedEvent as AttemptAudioEndedEvent,
)
from app.infra.attempt.client_types import (
    AttemptAudioReadyEvent as AttemptAudioReadyEvent,
)
from app.infra.attempt.client_types import (
    AttemptAudioStartPayload as AttemptAudioStartPayload,
)
from app.infra.attempt.client_types import (
    AttemptAudioStopPayload as AttemptAudioStopPayload,
)
from app.infra.attempt.client_types import (
    AttemptChatEndedEvent as AttemptChatEndedEvent,
)
from app.infra.attempt.client_types import (
    AttemptChatStartedEvent as AttemptChatStartedEvent,
)
from app.infra.attempt.client_types import (
    AttemptEndAllPayload as AttemptEndAllPayload,
)
from app.infra.attempt.client_types import (
    AttemptEndedEvent as AttemptEndedEvent,
)
from app.infra.attempt.client_types import (
    AttemptEndPayload as AttemptEndPayload,
)
from app.infra.attempt.client_types import (
    AttemptErrorEvent as AttemptErrorEvent,
)
from app.infra.attempt.client_types import (
    AttemptGradeCompleteEvent as AttemptGradeCompleteEvent,
)
from app.infra.attempt.client_types import (
    AttemptGradePayload as AttemptGradePayload,
)
from app.infra.attempt.client_types import (
    AttemptGradeProgressEvent as AttemptGradeProgressEvent,
)
from app.infra.attempt.client_types import (
    AttemptGradeStartEvent as AttemptGradeStartEvent,
)
from app.infra.attempt.client_types import (
    AttemptJoinedEvent as AttemptJoinedEvent,
)
from app.infra.attempt.client_types import (
    AttemptJoinPayload as AttemptJoinPayload,
)
from app.infra.attempt.client_types import (
    AttemptLeavePayload as AttemptLeavePayload,
)
from app.infra.attempt.client_types import (
    AttemptMessagePayload as AttemptMessagePayload,
)
from app.infra.attempt.client_types import (
    AttemptNextPayload as AttemptNextPayload,
)
from app.infra.attempt.client_types import (
    AttemptResponsePayload as AttemptResponsePayload,
)
from app.infra.attempt.client_types import (
    AttemptResponseResultEvent as AttemptResponseResultEvent,
)
from app.infra.attempt.client_types import (
    AttemptStartedEvent as AttemptStartedEvent,
)
from app.infra.attempt.client_types import (
    AttemptStartPayload as AttemptStartPayload,
)
from app.infra.attempt.client_types import (
    AttemptStopPayload as AttemptStopPayload,
)
from app.infra.attempt.client_types import (
    AttemptStoppedEvent as AttemptStoppedEvent,
)
from app.infra.attempt.client_types import (
    AttemptUsePreviousPayload as AttemptUsePreviousPayload,
)
from app.infra.attempt.client_types import (
    AttemptUserCompleteEvent as AttemptUserCompleteEvent,
)
from app.infra.attempt.client_types import (
    AttemptUserDeltaEvent as AttemptUserDeltaEvent,
)
from app.infra.attempt.client_types import (
    AttemptUserProgressEvent as AttemptUserProgressEvent,
)
from app.infra.attempt.client_types import (
    AttemptUserStartEvent as AttemptUserStartEvent,
)

# ═══════════════════════════════════════════════════════════════════════════
# Test types — canonical location: app.infra.test.client_types
# ═══════════════════════════════════════════════════════════════════════════

from app.infra.test.client_types import (
    TestAllCompleteEvent as TestAllCompleteEvent,
)
from app.infra.test.client_types import (
    TestEndAllPayload as TestEndAllPayload,
)
from app.infra.test.client_types import (
    TestEndPayload as TestEndPayload,
)
from app.infra.test.client_types import (
    TestErrorEvent as TestErrorEvent,
)
from app.infra.test.client_types import (
    TestGradedEvent as TestGradedEvent,
)
from app.infra.test.client_types import (
    TestGroupPayload as TestGroupPayload,
)
from app.infra.test.client_types import (
    TestJoinedEvent as TestJoinedEvent,
)
from app.infra.test.client_types import (
    TestJoinPayload as TestJoinPayload,
)
from app.infra.test.client_types import (
    TestLeavePayload as TestLeavePayload,
)
from app.infra.test.client_types import (
    TestNextPayload as TestNextPayload,
)
from app.infra.test.client_types import (
    TestProgressEvent as TestProgressEvent,
)
from app.infra.test.client_types import (
    TestRunCompleteEvent as TestRunCompleteEvent,
)
from app.infra.test.client_types import (
    TestRunDeltaEvent as TestRunDeltaEvent,
)
from app.infra.test.client_types import (
    TestRunPayload as TestRunPayload,
)
from app.infra.test.client_types import (
    TestRunStartEvent as TestRunStartEvent,
)
from app.infra.test.client_types import (
    TestStartedEvent as TestStartedEvent,
)
from app.infra.test.client_types import (
    TestStartPayload as TestStartPayload,
)
from app.infra.test.client_types import (
    TestStopPayload as TestStopPayload,
)
from app.infra.test.client_types import (
    TestStoppedEvent as TestStoppedEvent,
)
