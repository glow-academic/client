"""SQL parameter model generated from SQL introspection.

Generated from: app/sql/v3/attempts/bulk_archive_attempts_complete.sql
"""

from typing import Any
from uuid import UUID

from pydantic import BaseModel


class BulkArchiveAttemptsSqlParams(BaseModel):
    """SQL parameters for query execution.

    Parameters are ordered $1, $2, ...
    """

    archived: bool
    attemptIds: list[UUID]

    def to_tuple(self) -> tuple[Any, ...]:
        """Convert model to tuple in parameter order ($1, $2, ...)."""
        return (
            self.archived,
            self.attemptIds,
        )


"""SQL response row model generated from SQL introspection.

Generated from: app/sql/v3/attempts/bulk_archive_attempts_complete.sql
"""

from typing import Any

from pydantic import BaseModel


class BulkArchiveAttemptsSqlRow(BaseModel):
    """SQL query result row.

    Columns returned by the SQL query.
    """

    updated_count: int


"""API request model generated from SQL introspection.

Generated from: app/sql/v3/attempts/bulk_archive_attempts_complete.sql

API request model excludes profile_id (obtained from request header).
"""

from typing import Any
from uuid import UUID

from pydantic import BaseModel


class BulkArchiveAttemptsApiRequest(BaseModel):
    """API request parameters.

    Excludes profile_id (obtained from request header).
    """

    archived: bool
    attemptIds: list[UUID]


"""API response model generated from SQL introspection.

Generated from: app/sql/v3/attempts/bulk_archive_attempts_complete.sql

For now, identical to SQL response structure.
"""

from typing import Any

from pydantic import BaseModel


class BulkArchiveAttemptsApiResponse(BaseModel):
    """API response data.

    Structure matches SQL query result.
    """

    updated_count: int
