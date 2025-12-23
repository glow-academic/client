"""SQL parameter model generated from SQL introspection.

Generated from: app/sql/v3/simulations/create_user_message_complete.sql
"""

from typing import Any
from uuid import UUID

from pydantic import BaseModel


class CreateUserMessageSqlParams(BaseModel):
    """SQL parameters for query execution.

    Parameters are ordered $1, $2, ...
    """

    chat_id: UUID
    message_content: str
    run_id: UUID

    def to_tuple(self) -> tuple[Any, ...]:
        """Convert model to tuple in parameter order ($1, $2, ...)."""
        return (
            self.chat_id,
            self.message_content,
            self.run_id,
        )


"""SQL response row model generated from SQL introspection.

Generated from: app/sql/v3/simulations/create_user_message_complete.sql
"""

from typing import Any

from pydantic import BaseModel


class CreateUserMessageSqlRow(BaseModel):
    """SQL query result row.

    Columns returned by the SQL query.
    """

    message_id: UUID
    created_at: str
    parent_id: UUID
