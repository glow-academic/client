"""SQL parameter model generated from SQL introspection.

Generated from: app/sql/v3/attempts/get_attempt_full_complete.sql
"""

from typing import Any
from uuid import UUID

from pydantic import BaseModel


class GetAttemptFullSqlParams(BaseModel):
    """SQL parameters for query execution.

    Parameters are ordered $1, $2, ...
    """

    param_1: UUID

    def to_tuple(self) -> tuple[Any, ...]:
        """Convert model to tuple in parameter order ($1, $2, ...)."""
        return (
            self.param_1,
        )


"""SQL response row model generated from SQL introspection.

Generated from: app/sql/v3/attempts/get_attempt_full_complete.sql
"""

from typing import Any

from pydantic import BaseModel


class GetAttemptFullSqlRow(BaseModel):
    """SQL query result row.

    Columns returned by the SQL query.
    """

    attempt: dict[str, Any]
    simulation: dict[str, Any]
    attemptProfiles: dict[str, Any]
    chats: dict[str, Any]
    scenarioDocuments: dict[str, Any]
    aggregatedResults: dict[str, Any]
    timer: dict[str, Any]
    currentChatIndex: int
    expectedChatCount: int
    isSingleChatAttempt: bool
    isLastAttempt: bool
    showResults: bool
    shouldShowControls: bool
    remainingScenariosCount: int
    isLastRemainingScenario: bool
    canPickMultipleAlternatives: bool
    isActive: bool
    rubricStructure: dict[str, Any]
    allSimulationScenarios: dict[str, Any]
    availableContinuationOptions: dict[str, Any]


"""API request model generated from SQL introspection.

Generated from: app/sql/v3/attempts/get_attempt_full_complete.sql

API request model excludes profile_id (obtained from request header).
"""

from typing import Any
from uuid import UUID

from pydantic import BaseModel


class GetAttemptFullApiRequest(BaseModel):
    """API request parameters.

    Excludes profile_id (obtained from request header).
    """

    param_1: UUID


"""API response model generated from SQL introspection.

Generated from: app/sql/v3/attempts/get_attempt_full_complete.sql

For now, identical to SQL response structure.
"""

from typing import Any

from pydantic import BaseModel


class GetAttemptFullApiResponse(BaseModel):
    """API response data.

    Structure matches SQL query result.
    """

    attempt: dict[str, Any]
    simulation: dict[str, Any]
    attemptProfiles: dict[str, Any]
    chats: dict[str, Any]
    scenarioDocuments: dict[str, Any]
    aggregatedResults: dict[str, Any]
    timer: dict[str, Any]
    currentChatIndex: int
    expectedChatCount: int
    isSingleChatAttempt: bool
    isLastAttempt: bool
    showResults: bool
    shouldShowControls: bool
    remainingScenariosCount: int
    isLastRemainingScenario: bool
    canPickMultipleAlternatives: bool
    isActive: bool
    rubricStructure: dict[str, Any]
    allSimulationScenarios: dict[str, Any]
    availableContinuationOptions: dict[str, Any]
