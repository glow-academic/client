"""SQL parameter model generated from SQL introspection.

Generated from: tests/sql/integration/socket/create_test_chat_with_messages.sql
"""

from typing import Any

from pydantic import BaseModel


class CreateTestChatWithMessagesSqlParams(BaseModel):
    """SQL parameters for query execution.

    Parameters are ordered $1, $2, ...
    """


    def to_tuple(self) -> tuple[Any, ...]:
        """Convert model to tuple in parameter order ($1, $2, ...)."""
        return (
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
