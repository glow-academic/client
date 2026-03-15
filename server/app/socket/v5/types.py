"""Shared types and utilities for v5 WebSocket handlers.

This module re-exports types from their canonical infra locations.
All v5 handlers should import from here or directly from infra.
"""

from __future__ import annotations

# =============================================================================
# Internal Server-to-Server Events
# =============================================================================
# Re-exported from infra — canonical location is app.infra.websocket.generation_types
from app.infra.websocket.generation_types import (
    GenerateErrorApiRequest as GenerateErrorApiRequest,
)

# =============================================================================
# Test domain types
# =============================================================================
# Re-exported from infra — canonical location is app.infra.websocket.test_types
from app.infra.websocket.test_types import (
    TestAllCompleteEvent as TestAllCompleteEvent,
)

# Re-exported from infra — canonical location is app.infra.test.client_types
from app.infra.test.client_types import (
    TEST_GRADE_ENTRY_TYPES as TEST_GRADE_ENTRY_TYPES,
)

# Re-exported from infra — canonical location is app.infra.attempt.client_types
from app.infra.attempt.client_types import (
    MESSAGE_ENTRY_TYPES as MESSAGE_ENTRY_TYPES,
)

# Re-exported from infra — canonical location is app.infra.test.workflows
from app.infra.test.workflows import (
    build_messages_from_conversation as build_messages_from_conversation,
)
from app.infra.test.workflows import (
    determine_next_run as determine_next_run,
)
