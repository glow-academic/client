"""SQL parameter model generated from SQL introspection.

Generated from: app/sql/v3/scenarios/get_randomization_data_complete.sql
"""

from typing import Any

from pydantic import BaseModel


class GetRandomizationDataSqlParams(BaseModel):
    """SQL parameters for query execution.

    Parameters are ordered $1, $2, ...
    """


    def to_tuple(self) -> tuple[Any, ...]:
        """Convert model to tuple in parameter order ($1, $2, ...)."""
        return (
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
