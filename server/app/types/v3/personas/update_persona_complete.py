"""SQL parameter model generated from SQL introspection.

Generated from: app/sql/v3/personas/update_persona_complete.sql
"""

from typing import Any
from uuid import UUID

from pydantic import BaseModel


class UpdatePersonaSqlParams(BaseModel):
    """SQL parameters for query execution.

    Parameters are ordered $1, $2, ...
    """

    personaId: UUID
    name: str
    description: str
    active: bool
    color: str
    icon: str
    instructions: str
    department_ids: list[str]
    profile_id: UUID
    example_ids: list[str]

    def to_tuple(self) -> tuple[Any, ...]:
        """Convert model to tuple in parameter order ($1, $2, ...)."""
        return (
            self.personaId,
            self.name,
            self.description,
            self.active,
            self.color,
            self.icon,
            self.instructions,
            self.department_ids,
            self.profile_id,
            self.example_ids,
        )


"""SQL response row model generated from SQL introspection.

Generated from: app/sql/v3/personas/update_persona_complete.sql
"""

from typing import Any

from pydantic import BaseModel


class UpdatePersonaSqlRow(BaseModel):
    """SQL query result row.

    Columns returned by the SQL query.
    """

    persona_id: str
    actor_name: str
