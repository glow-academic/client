"""SQL parameter model generated from SQL introspection.

Generated from: app/sql/v3/documents/update_document_complete.sql
"""

from typing import Any
from uuid import UUID

from pydantic import BaseModel


class UpdateDocumentSqlParams(BaseModel):
    """SQL parameters for query execution.

    Parameters are ordered $1, $2, ...
    """

    documentId: UUID
    name: str
    description: str
    active: bool
    template: bool
    department_id: UUID
    field_ids: list[str]
    classify_agent_id: UUID
    document_agent_id: UUID
    template_upload_id: UUID
    template_args: dict[str, Any]
    profile_id: UUID

    def to_tuple(self) -> tuple[Any, ...]:
        """Convert model to tuple in parameter order ($1, $2, ...)."""
        return (
            self.documentId,
            self.name,
            self.description,
            self.active,
            self.template,
            self.department_id,
            self.field_ids,
            self.classify_agent_id,
            self.document_agent_id,
            self.template_upload_id,
            self.template_args,
            self.profile_id,
        )


"""SQL response row model generated from SQL introspection.

Generated from: app/sql/v3/documents/update_document_complete.sql
"""

from typing import Any

from pydantic import BaseModel


class UpdateDocumentSqlRow(BaseModel):
    """SQL query result row.

    Columns returned by the SQL query.
    """

    document_id: str
    document_name: str
    actor_name: str
