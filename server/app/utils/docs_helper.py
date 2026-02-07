"""Shared documentation helper for artifact and resource docs.

Provides dataclass configs and builder functions to generate dynamic
(DB-backed) and static documentation for all artifacts and resources.
"""

from __future__ import annotations

import inspect
from collections.abc import AsyncGenerator
from dataclasses import dataclass, field
from types import ModuleType
from typing import Annotated, Any, cast

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends

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


# ========== Async Builders (with DB) ==========


async def build_artifact_docs(
    conn: asyncpg.Connection, config: ArtifactDocsConfig
) -> dict[str, Any]:
    """Build complete artifact documentation with dynamic DB introspection."""
    docs: dict[str, Any] = {
        "name": config.plural_name,
        "type": config.entity_type,
    }

    # Dynamic: DB schema (only if table exists)
    if config.table_name:
        columns = await get_table_columns(conn, config.table_name)
        foreign_keys = (
            await get_foreign_keys(conn, config.fk_pattern) if config.fk_pattern else []
        )
        docs["database"] = {
            "table": config.table_name,
            "columns": columns,
            "foreign_keys": foreign_keys,
        }

    # Dynamic: Junction tables
    if config.junction_prefix:
        junction_tables = await get_junction_tables(conn, config.junction_prefix)
        linked_resources = _extract_linked_resources(
            junction_tables, config.junction_prefix
        )
        docs["relationships"] = {
            "junction_tables": junction_tables,
            "linked_resources": linked_resources,
        }

    # Dynamic: Business logic from permissions.py
    if config.permissions_module and config.permission_functions:
        docs["business_logic"] = extract_business_logic(
            config.permissions_module, config.permission_functions
        )

    # Static sections
    if config.api_routing:
        docs["api_routing"] = config.api_routing
    if config.resources_info:
        docs["resources"] = {"available": config.resources_info}
    if config.glow_context:
        docs["glow_context"] = config.glow_context
    for key, value in config.extra_sections.items():
        docs[key] = value

    return docs


async def build_resource_docs(
    conn: asyncpg.Connection, config: ResourceDocsConfig
) -> dict[str, Any]:
    """Build complete resource documentation with dynamic DB introspection."""
    docs: dict[str, Any] = {
        "name": config.name,
        "type": "resource",
        "description": config.description,
    }

    # Dynamic: DB schema
    if config.table_name:
        columns = await get_table_columns(conn, config.table_name)
        docs["database"] = {
            "table": config.table_name,
            "columns": columns,
        }

    # Static sections
    if config.used_by_artifacts:
        docs["used_by_artifacts"] = config.used_by_artifacts
    if config.glow_context:
        docs["glow_context"] = config.glow_context
    for key, value in config.extra_sections.items():
        docs[key] = value

    return docs


# ========== Sync Builders (for MCP, no DB) ==========


def build_artifact_docs_static(config: ArtifactDocsConfig) -> dict[str, Any]:
    """Build artifact documentation from static config only (no DB queries)."""
    docs: dict[str, Any] = {
        "name": config.plural_name,
        "type": config.entity_type,
    }

    if config.table_name:
        docs["database"] = {"table": config.table_name}

    # Business logic (still works without DB — uses inspect)
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


# ========== Router Factories ==========
# These create FastAPI routers with /docs endpoints, using lazy imports
# of get_db to avoid circular import issues (docs.py -> app.main -> router -> docs.py).


async def _lazy_get_db() -> AsyncGenerator[asyncpg.Connection, None]:
    """Lazily import and yield from get_db to avoid circular imports."""
    from app.main import get_db

    async for conn in get_db():
        yield conn


def create_artifact_docs_router(config: ArtifactDocsConfig) -> APIRouter:
    """Create a FastAPI router with a POST /docs endpoint for an artifact."""
    router = APIRouter()

    @router.post("/docs")
    async def get_docs(
        conn: Annotated[asyncpg.Connection, Depends(_lazy_get_db)],
    ) -> dict[str, Any]:
        return await build_artifact_docs(conn, config)

    return router
