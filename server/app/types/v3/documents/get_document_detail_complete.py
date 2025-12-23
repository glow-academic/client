"""SQL parameter model generated from SQL introspection.

Generated from: app/sql/v3/documents/get_document_detail_complete.sql
"""

from typing import Any
from uuid import UUID

from pydantic import BaseModel


class GetDocumentDetailSqlParams(BaseModel):
    """SQL parameters for query execution.

    Parameters are ordered $1, $2, ...
    """

    param_1: UUID
    param_2: UUID

    def to_tuple(self) -> tuple[Any, ...]:
        """Convert model to tuple in parameter order ($1, $2, ...)."""
        return (
            self.param_1,
            self.param_2,
        )


"""SQL response row model generated from SQL introspection.

Generated from: app/sql/v3/documents/get_document_detail_complete.sql
"""

from typing import Any

from pydantic import BaseModel


class GetDocumentDetailSqlRow(BaseModel):
    """SQL query result row.

    Columns returned by the SQL query.
    """

    document_id: str
    name: str
    description: str
    active: bool
    updated_at: str
    classify_agent_id: str
    document_agent_id: str
    department_ids: list[str]
    field_ids: list[str]
    upload_id: str
    template_upload_id: str
    template_args: dict[str, Any]
    file_path: str
    template_file_path: str
    template: bool
    scenario_ids: list[str]
    active_scenario_count: int
    total_scenario_links: int
    department_mapping: dict[str, Any]
    valid_department_ids: list[str]
    parameter_mapping: dict[str, Any]
    linked_parameter_ids: list[str]
    field_mapping: dict[str, Any]
    valid_field_ids: list[str]
    agent_mapping: dict[str, Any]
    valid_agent_ids: list[str]
    template_id: str
    template_mapping: dict[str, Any]
    extension: str
    can_edit: bool
    can_delete: bool
    actor_name: str


"""API request model generated from SQL introspection.

Generated from: app/sql/v3/documents/get_document_detail_complete.sql

API request model excludes profile_id (obtained from request header).
"""

from typing import Any
from uuid import UUID

from pydantic import BaseModel


class GetDocumentDetailApiRequest(BaseModel):
    """API request parameters.

    Excludes profile_id (obtained from request header).
    """

    param_1: UUID
    param_2: UUID


"""API response model generated from SQL introspection.

Generated from: app/sql/v3/documents/get_document_detail_complete.sql

For now, identical to SQL response structure.
"""

from typing import Any

from pydantic import BaseModel


class GetDocumentDetailApiResponse(BaseModel):
    """API response data.

    Structure matches SQL query result.
    """

    document_id: str
    name: str
    description: str
    active: bool
    updated_at: str
    classify_agent_id: str
    document_agent_id: str
    department_ids: list[str]
    field_ids: list[str]
    upload_id: str
    template_upload_id: str
    template_args: dict[str, Any]
    file_path: str
    template_file_path: str
    template: bool
    scenario_ids: list[str]
    active_scenario_count: int
    total_scenario_links: int
    department_mapping: dict[str, Any]
    valid_department_ids: list[str]
    parameter_mapping: dict[str, Any]
    linked_parameter_ids: list[str]
    field_mapping: dict[str, Any]
    valid_field_ids: list[str]
    agent_mapping: dict[str, Any]
    valid_agent_ids: list[str]
    template_id: str
    template_mapping: dict[str, Any]
    extension: str
    can_edit: bool
    can_delete: bool
    actor_name: str
