"""SQL parameter model generated from SQL introspection.

Generated from: tests/sql/integration/socket/create_test_chat_with_messages.sql
"""

from typing import Any
from uuid import UUID

from pydantic import BaseModel


class CreateTestChatWithMessagesSqlParams(BaseModel):
    """SQL parameters for query execution.

    Parameters are ordered $1, $2, ...
    """

    scenario_id: UUID
    run_id: UUID
    attempt_id: UUID

    def to_tuple(self) -> tuple[Any, ...]:
        """Convert model to tuple in parameter order ($1, $2, ...)."""
        return (
            self.scenario_id,
            self.run_id,
            self.attempt_id,
        )


"""SQL response row model generated from SQL introspection.

Generated from: tests/sql/integration/socket/create_test_chat_with_messages.sql
"""

from typing import Any

from pydantic import BaseModel


class CreateTestChatWithMessagesSqlRow(BaseModel):
    """SQL query result row.

    Columns returned by the SQL query.
    """

    chat_id: str
    system_message_id: str
    user_message_id: str
    assistant_message_id: str


"""API request model generated from SQL introspection.

Generated from: tests/sql/integration/socket/create_test_chat_with_messages.sql

API request model excludes profile_id (obtained from request header).
"""

from typing import Any
from uuid import UUID

from pydantic import BaseModel


class CreateTestChatWithMessagesApiRequest(BaseModel):
    """API request parameters.

    Excludes profile_id (obtained from request header).
    """

    scenario_id: UUID
    run_id: UUID
    attempt_id: UUID


"""API response model generated from SQL introspection.

Generated from: tests/sql/integration/socket/create_test_chat_with_messages.sql

For now, identical to SQL response structure.
"""

from typing import Any

from pydantic import BaseModel


class CreateTestChatWithMessagesApiResponse(BaseModel):
    """API response data.

    Structure matches SQL query result.
    """

    chat_id: str
    system_message_id: str
    user_message_id: str
    assistant_message_id: str
