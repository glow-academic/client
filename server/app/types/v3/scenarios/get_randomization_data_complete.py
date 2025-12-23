"""SQL parameter model generated from SQL introspection.

Generated from: app/sql/v3/scenarios/get_randomization_data_complete.sql
"""

from typing import Any
from uuid import UUID

from pydantic import BaseModel


class GetRandomizationDataSqlParams(BaseModel):
    """SQL parameters for query execution.

    Parameters are ordered $1, $2, ...
    """

    department_ids: list[UUID]
    param_2: UUID

    def to_tuple(self) -> tuple[Any, ...]:
        """Convert model to tuple in parameter order ($1, $2, ...)."""
        return (
            self.department_ids,
            self.param_2,
        )


"""SQL response row model generated from SQL introspection.

Generated from: app/sql/v3/scenarios/get_randomization_data_complete.sql
"""

from typing import Any

from pydantic import BaseModel


class GetRandomizationDataSqlRow(BaseModel):
    """SQL query result row.

    Columns returned by the SQL query.
    """

    personas: dict[str, Any]
    documents: dict[str, Any]
    parameters: dict[str, Any]
    parameter_items: dict[str, Any]
    document_parameter_items: dict[str, Any]
    persona_ids: list[str]
    document_ids: list[str]
    parameter_item_ids: list[str]


"""API request model generated from SQL introspection.

Generated from: app/sql/v3/scenarios/get_randomization_data_complete.sql

API request model excludes profile_id (obtained from request header).
"""

from typing import Any
from uuid import UUID

from pydantic import BaseModel


class GetRandomizationDataApiRequest(BaseModel):
    """API request parameters.

    Excludes profile_id (obtained from request header).
    """

    department_ids: list[UUID]
    param_2: UUID


"""API response model generated from SQL introspection.

Generated from: app/sql/v3/scenarios/get_randomization_data_complete.sql

For now, identical to SQL response structure.
"""

from typing import Any

from pydantic import BaseModel


class GetRandomizationDataApiResponse(BaseModel):
    """API response data.

    Structure matches SQL query result.
    """

    personas: dict[str, Any]
    documents: dict[str, Any]
    parameters: dict[str, Any]
    parameter_items: dict[str, Any]
    document_parameter_items: dict[str, Any]
    persona_ids: list[str]
    document_ids: list[str]
    parameter_item_ids: list[str]
