"""SQL parameter model generated from SQL introspection.

Generated from: app/sql/v3/model_runs/log_run_complete.sql
"""

from typing import Any
from uuid import UUID

from pydantic import BaseModel


class LogRunSqlParams(BaseModel):
    """SQL parameters for query execution.

    Parameters are ordered $1, $2, ...
    """

    run_id: UUID
    param_2: UUID
    param_3: int
    param_4: int
    param_5: int
    param_6: int
    param_7: int
    param_8: int
    param_9: int
    param_10: list[str]
    param_11: str

    def to_tuple(self) -> tuple[Any, ...]:
        """Convert model to tuple in parameter order ($1, $2, ...)."""
        return (
            self.run_id,
            self.param_2,
            self.param_3,
            self.param_4,
            self.param_5,
            self.param_6,
            self.param_7,
            self.param_8,
            self.param_9,
            self.param_10,
            self.param_11,
        )


"""SQL response row model generated from SQL introspection.

Generated from: app/sql/v3/model_runs/log_run_complete.sql
"""

from typing import Any

from pydantic import BaseModel


class LogRunSqlRow(BaseModel):
    """SQL query result row.

    Columns returned by the SQL query.
    """

    field_?column?: int


"""API request model generated from SQL introspection.

Generated from: app/sql/v3/model_runs/log_run_complete.sql

API request model excludes profile_id (obtained from request header).
"""

from typing import Any
from uuid import UUID

from pydantic import BaseModel


class LogRunApiRequest(BaseModel):
    """API request parameters.

    Excludes profile_id (obtained from request header).
    """

    run_id: UUID
    param_2: UUID
    param_3: int
    param_4: int
    param_5: int
    param_6: int
    param_7: int
    param_8: int
    param_9: int
    param_10: list[str]
    param_11: str


"""API response model generated from SQL introspection.

Generated from: app/sql/v3/model_runs/log_run_complete.sql

For now, identical to SQL response structure.
"""

from typing import Any

from pydantic import BaseModel


class LogRunApiResponse(BaseModel):
    """API response data.

    Structure matches SQL query result.
    """

    field_?column?: int
