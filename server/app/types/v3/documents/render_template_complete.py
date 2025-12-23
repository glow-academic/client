"""SQL parameter model generated from SQL introspection.

Generated from: app/sql/v3/documents/render_template_complete.sql
"""

from typing import Any
from uuid import UUID

from pydantic import BaseModel


class RenderTemplateSqlParams(BaseModel):
    """SQL parameters for query execution.

    Parameters are ordered $1, $2, ...
    """

    document_id: UUID
    profile_id: UUID

    def to_tuple(self) -> tuple[Any, ...]:
        """Convert model to tuple in parameter order ($1, $2, ...)."""
        return (
            self.document_id,
            self.profile_id,
        )


"""SQL response row model generated from SQL introspection.

Generated from: app/sql/v3/documents/render_template_complete.sql
"""

from typing import Any

from pydantic import BaseModel


class RenderTemplateSqlRow(BaseModel):
    """SQL query result row.

    Columns returned by the SQL query.
    """

    template: bool
    template_args: dict[str, Any]
    file_path: str
    upload_id: str
    document_name: str
    actor_name: str


"""API request model generated from SQL introspection.

Generated from: app/sql/v3/documents/render_template_complete.sql

API request model excludes profile_id (obtained from request header).
"""

from typing import Any
from uuid import UUID

from pydantic import BaseModel


class RenderTemplateApiRequest(BaseModel):
    """API request parameters.

    Excludes profile_id (obtained from request header).
    """

    document_id: UUID


"""API response model generated from SQL introspection.

Generated from: app/sql/v3/documents/render_template_complete.sql

For now, identical to SQL response structure.
"""

from typing import Any

from pydantic import BaseModel


class RenderTemplateApiResponse(BaseModel):
    """API response data.

    Structure matches SQL query result.
    """

    template: bool
    template_args: dict[str, Any]
    file_path: str
    upload_id: str
    document_name: str
    actor_name: str
