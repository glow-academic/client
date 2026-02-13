"""Shared documentation helper for artifact and resource docs.

Provides dataclass configs and builder functions to generate dynamic
(DB-backed) and static documentation for all artifacts and resources.
Also provides shared models and business logic for page metadata endpoints.
"""

from __future__ import annotations

import inspect
from dataclasses import dataclass, field
from types import ModuleType
from typing import Any, cast
from uuid import UUID

import asyncpg  # type: ignore
from pydantic import BaseModel

from app.sql.types import (
    GetDocsColumnsSqlParams,
    GetDocsColumnsSqlRow,
    GetDocsForeignKeysSqlParams,
    GetDocsForeignKeysSqlRow,
    GetDocsJunctionsSqlParams,
    GetDocsJunctionsSqlRow,
)
from app.utils.sql_helper import execute_sql_typed

# SQL paths for generic docs queries
COLUMNS_SQL = "app/sql/v4/queries/docs/get_docs_columns_complete.sql"
JUNCTIONS_SQL = "app/sql/v4/queries/docs/get_docs_junctions_complete.sql"
FK_SQL = "app/sql/v4/queries/docs/get_docs_foreign_keys_complete.sql"


# ========== Page Metadata Models ==========


class PageMetaItem(BaseModel):
    title: str
    description: str


class DocsApiRequest(BaseModel):
    entity_id: UUID | None = None


class DocsApiResponse(BaseModel):
    list: PageMetaItem
    detail: PageMetaItem
    new: PageMetaItem


@dataclass
class PageMetadataConfig:
    list_title: str = ""
    list_description: str = ""
    detail_title: str = ""
    detail_description: str = ""
    new_title: str = ""
    new_description: str = ""


def compute_docs_metadata(
    page_config: PageMetadataConfig,
    entity_name: str | None = None,
) -> DocsApiResponse:
    """Compute page metadata from config and optional entity name."""
    detail_title = (
        f"{entity_name} {page_config.detail_title}"
        if entity_name
        else page_config.detail_title
    )
    return DocsApiResponse(
        list=PageMetaItem(
            title=page_config.list_title, description=page_config.list_description
        ),
        detail=PageMetaItem(
            title=detail_title, description=page_config.detail_description
        ),
        new=PageMetaItem(
            title=page_config.new_title, description=page_config.new_description
        ),
    )


# ========== Config Dataclasses ==========


@dataclass
class ArtifactDocsConfig:
    """Configuration for generating artifact documentation."""

    name: str  # singular: "persona"
    plural_name: str  # "personas"
    entity_type: str = "artifact"  # "artifact", "analytics", "workflow"
    table_name: str | None = None  # "persona_artifact" (None for analytics)
    junction_prefix: str | None = None  # "persona" (None for analytics)
    fk_pattern: str | None = None  # "persona_%" (None for analytics)
    permissions_module: ModuleType | None = None
    permission_functions: list[str] = field(default_factory=list)
    api_routing: dict[str, Any] = field(default_factory=dict)
    glow_context: dict[str, Any] = field(default_factory=dict)
    resources_info: list[dict[str, Any]] = field(default_factory=list)
    extra_sections: dict[str, Any] = field(default_factory=dict)
    page_metadata: PageMetadataConfig | None = None


@dataclass
class ResourceDocsConfig:
    """Configuration for generating resource documentation."""

    name: str  # "names"
    table_name: str | None = None  # "names_resource"
    description: str = ""
    glow_context: dict[str, Any] = field(default_factory=dict)
    used_by_artifacts: list[str] = field(default_factory=list)
    extra_sections: dict[str, Any] = field(default_factory=dict)


# ========== Schema Discovery ==========


async def get_table_columns(
    conn: asyncpg.Connection, table_name: str
) -> list[dict[str, Any]]:
    """Get columns for a table from information_schema."""
    params = GetDocsColumnsSqlParams(table_name_param=table_name)
    result = cast(
        GetDocsColumnsSqlRow,
        await execute_sql_typed(conn, COLUMNS_SQL, params=params),
    )
    if not result.columns:
        return []
    return [
        {
            "name": col.name,
            "type": col.type,
            "nullable": col.nullable,
            "default": col.default_value,
        }
        for col in result.columns
    ]


async def get_junction_tables(
    conn: asyncpg.Connection, prefix: str
) -> list[dict[str, Any]]:
    """Get junction tables and their columns for a given prefix."""
    params = GetDocsJunctionsSqlParams(prefix_param=prefix)
    result = cast(
        GetDocsJunctionsSqlRow,
        await execute_sql_typed(conn, JUNCTIONS_SQL, params=params),
    )
    if not result.junction_tables:
        return []
    return [{"name": jt.name, "columns": jt.columns} for jt in result.junction_tables]


async def get_foreign_keys(
    conn: asyncpg.Connection, table_pattern: str
) -> list[dict[str, Any]]:
    """Get foreign key relationships for tables matching a pattern."""
    params = GetDocsForeignKeysSqlParams(table_pattern_param=table_pattern)
    result = cast(
        GetDocsForeignKeysSqlRow,
        await execute_sql_typed(conn, FK_SQL, params=params),
    )
    if not result.foreign_keys:
        return []
    return [
        {
            "table": fk.table_name,
            "column": fk.column_name,
            "references": fk.references_table,
        }
        for fk in result.foreign_keys
    ]


# ========== Business Logic Extraction ==========


def _parse_docstring(docstring: str | None) -> dict[str, Any]:
    """Parse docstring into description and rules."""
    if not docstring:
        return {"description": "", "rules": []}

    lines = docstring.strip().split("\n")
    description = lines[0] if lines else ""

    rules = []
    for line in lines:
        line = line.strip()
        if line.startswith("-") or line.startswith("*"):
            rules.append(line.lstrip("-* "))

    return {"description": description, "rules": rules}


def extract_business_logic(
    module: ModuleType, function_names: list[str]
) -> dict[str, dict[str, Any]]:
    """Extract business logic from permission function docstrings and source."""
    result = {}
    for func_name in function_names:
        func = getattr(module, func_name, None)
        if func is None:
            continue
        parsed = _parse_docstring(inspect.getdoc(func))
        result[func_name] = {
            "description": parsed["description"],
            "rules": parsed["rules"],
            "source": inspect.getsource(func),
        }
    return result


# ========== Linked Resources Extraction ==========


def _extract_linked_resources(
    junction_tables: list[dict[str, Any]], prefix: str
) -> list[str]:
    """Extract resource names from junction table names."""
    linked = []
    for jt in junction_tables:
        name = jt["name"]
        if name and name.startswith(f"{prefix}_") and name.endswith("_junction"):
            resource = name[len(prefix) + 1 : -9]  # Remove prefix_ and _junction
            if resource:
                linked.append(resource)
    return linked


# ========== Sync Builders (for MCP, no DB) ==========


def build_artifact_docs_static(config: ArtifactDocsConfig) -> dict[str, Any]:
    """Build artifact documentation from static config only (no DB queries)."""
    docs: dict[str, Any] = {
        "name": config.plural_name,
        "type": config.entity_type,
    }

    if config.table_name:
        docs["database"] = {"table": config.table_name}

    # Business logic (still works without DB -- uses inspect)
    if config.permissions_module and config.permission_functions:
        docs["business_logic"] = extract_business_logic(
            config.permissions_module, config.permission_functions
        )

    if config.api_routing:
        docs["api_routing"] = config.api_routing
    if config.resources_info:
        docs["resources"] = {"available": config.resources_info}
    if config.glow_context:
        docs["glow_context"] = config.glow_context
    for key, value in config.extra_sections.items():
        docs[key] = value

    return docs


def build_resource_docs_static(config: ResourceDocsConfig) -> dict[str, Any]:
    """Build resource documentation from static config only (no DB queries)."""
    docs: dict[str, Any] = {
        "name": config.name,
        "type": "resource",
        "description": config.description,
    }

    if config.table_name:
        docs["database"] = {"table": config.table_name}
    if config.used_by_artifacts:
        docs["used_by_artifacts"] = config.used_by_artifacts
    if config.glow_context:
        docs["glow_context"] = config.glow_context
    for key, value in config.extra_sections.items():
        docs[key] = value

    return docs
