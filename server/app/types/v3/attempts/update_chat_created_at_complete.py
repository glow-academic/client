"""SQL parameter model generated from SQL introspection.

Generated from: app/sql/v3/attempts/update_chat_created_at_complete.sql
"""

from typing import Any
from uuid import UUID

from pydantic import BaseModel


class UpdateChatCreatedAtSqlParams(BaseModel):
    """SQL parameters for query execution.

    Parameters are ordered $1, $2, ...
    """

    createdAt: str
    chatId: UUID

    def to_tuple(self) -> tuple[Any, ...]:
        """Convert model to tuple in parameter order ($1, $2, ...)."""
        return (
            self.createdAt,
            self.chatId,
        )


"""SQL response row model generated from SQL introspection.

Generated from: app/sql/v3/attempts/update_chat_created_at_complete.sql
"""

from typing import Any

from pydantic import BaseModel


class UpdateChatCreatedAtSqlRow(BaseModel):
    """SQL query result row.

    Columns returned by the SQL query.
    """

    chat_id: str


"""API request model generated from SQL introspection.

Generated from: app/sql/v3/attempts/update_chat_created_at_complete.sql

API request model excludes profile_id (obtained from request header).
"""

from typing import Any
from uuid import UUID

from pydantic import BaseModel


class UpdateChatCreatedAtApiRequest(BaseModel):
    """API request parameters.

    Excludes profile_id (obtained from request header).
    """

    createdAt: str
    chatId: UUID


"""API response model generated from SQL introspection.

Generated from: app/sql/v3/attempts/update_chat_created_at_complete.sql

For now, identical to SQL response structure.
"""

from typing import Any

from pydantic import BaseModel


class UpdateChatCreatedAtApiResponse(BaseModel):
    """API response data.

    Structure matches SQL query result.
    """

    chat_id: str
