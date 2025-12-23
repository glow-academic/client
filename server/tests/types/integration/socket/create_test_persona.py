"""SQL parameter model generated from SQL introspection.

Generated from: tests/sql/integration/socket/create_test_persona.sql
"""

from typing import Any

from pydantic import BaseModel


class CreateTestPersonaSqlParams(BaseModel):
    """SQL parameters for query execution.

    Parameters are ordered $1, $2, ...
    """

    name: str

    def to_tuple(self) -> tuple[Any, ...]:
        """Convert model to tuple in parameter order ($1, $2, ...)."""
        return (
            self.name,
        )


"""SQL response row model generated from SQL introspection.

Generated from: tests/sql/integration/socket/create_test_persona.sql
"""

from typing import Any

from pydantic import BaseModel


class CreateTestPersonaSqlRow(BaseModel):
    """SQL query result row.

    Columns returned by the SQL query.
    """

    persona_id: str
