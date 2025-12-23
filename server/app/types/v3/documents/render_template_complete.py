"""SQL parameter model generated from SQL introspection.

Generated from: app/sql/v3/documents/render_template_complete.sql
"""

from typing import Any

from pydantic import BaseModel


class RenderTemplateSqlParams(BaseModel):
    """SQL parameters for query execution.

    Parameters are ordered $1, $2, ...
    """


    def to_tuple(self) -> tuple[Any, ...]:
        """Convert model to tuple in parameter order ($1, $2, ...)."""
        return (
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
