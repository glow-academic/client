"""SQL parameter model generated from SQL introspection.

Generated from: app/sql/v3/problem_statements/insert_problem_statement_complete.sql
"""

from typing import Any
from uuid import UUID

from pydantic import BaseModel


class InsertProblemStatementSqlParams(BaseModel):
    """SQL parameters for query execution.

    Parameters are ordered $1, $2, ...
    """

    problem_statement: str
    problem_statement_name: str
    scenario_id: UUID
    active: bool

    def to_tuple(self) -> tuple[Any, ...]:
        """Convert model to tuple in parameter order ($1, $2, ...)."""
        return (
            self.problem_statement,
            self.problem_statement_name,
            self.scenario_id,
            self.active,
        )


"""SQL response row model generated from SQL introspection.

Generated from: app/sql/v3/problem_statements/insert_problem_statement_complete.sql
"""

from typing import Any

from pydantic import BaseModel


class InsertProblemStatementSqlRow(BaseModel):
    """SQL query result row.

    Columns returned by the SQL query.
    """

    problem_statement_id: str


"""API request model generated from SQL introspection.

Generated from: app/sql/v3/problem_statements/insert_problem_statement_complete.sql

API request model excludes profile_id (obtained from request header).
"""

from typing import Any
from uuid import UUID

from pydantic import BaseModel


class InsertProblemStatementApiRequest(BaseModel):
    """API request parameters.

    Excludes profile_id (obtained from request header).
    """

    problem_statement: str
    problem_statement_name: str
    scenario_id: UUID
    active: bool


"""API response model generated from SQL introspection.

Generated from: app/sql/v3/problem_statements/insert_problem_statement_complete.sql

For now, identical to SQL response structure.
"""

from typing import Any

from pydantic import BaseModel


class InsertProblemStatementApiResponse(BaseModel):
    """API response data.

    Structure matches SQL query result.
    """

    problem_statement_id: str
