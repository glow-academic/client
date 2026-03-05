"""Reusable junction table operations — upsert, deactivate, link.

All junction tables follow the pattern:
  {artifact}_{resource}_junction (owner_id, resource_id, active, created_at, generated, mcp)

These helpers work with any junction table regardless of artifact type.
"""

from uuid import UUID

import asyncpg


async def upsert_single(
    conn: asyncpg.Connection,
    *,
    table: str,
    owner_col: str,
    owner_id: UUID,
    resource_col: str,
    resource_id: UUID,
    constraint: str,
    mcp: bool = False,
) -> None:
    """Upsert a single-select junction row.

    Deactivates any existing active row with a different resource ID,
    then inserts or reactivates the target row.
    """
    await conn.execute(
        f"UPDATE {table} SET active = false "
        f"WHERE {owner_col} = $1 AND active = true AND {resource_col} != $2",
        owner_id,
        resource_id,
    )
    await conn.execute(
        f"INSERT INTO {table} ({owner_col}, {resource_col}, mcp) VALUES ($1, $2, $3) "
        f"ON CONFLICT ON CONSTRAINT {constraint} "
        f"DO UPDATE SET active = true, mcp = $3",
        owner_id,
        resource_id,
        mcp,
    )


async def upsert_multi(
    conn: asyncpg.Connection,
    *,
    table: str,
    owner_col: str,
    owner_id: UUID,
    resource_col: str,
    resource_ids: list[UUID],
    constraint: str,
    mcp: bool = False,
) -> None:
    """Upsert multi-select junction rows.

    Deactivates rows whose resource ID is not in the new list,
    then inserts or reactivates rows for each ID in the list.
    Pass an empty list to deactivate all.
    """
    if not resource_ids:
        await conn.execute(
            f"UPDATE {table} SET active = false "
            f"WHERE {owner_col} = $1 AND active = true",
            owner_id,
        )
        return

    await conn.execute(
        f"UPDATE {table} SET active = false "
        f"WHERE {owner_col} = $1 AND active = true AND {resource_col} != ALL($2::uuid[])",
        owner_id,
        resource_ids,
    )
    await conn.execute(
        f"INSERT INTO {table} ({owner_col}, {resource_col}, mcp) "
        f"SELECT $1, unnest($2::uuid[]), $3 "
        f"ON CONFLICT ON CONSTRAINT {constraint} "
        f"DO UPDATE SET active = true, mcp = $3",
        owner_id,
        resource_ids,
        mcp,
    )


async def upsert_multi_with_idx(
    conn: asyncpg.Connection,
    *,
    table: str,
    owner_col: str,
    owner_id: UUID,
    resource_col: str,
    resource_ids: list[UUID],
    constraint: str,
    mcp: bool = False,
) -> None:
    """Upsert multi-select junction rows that have an `idx` ordering column.

    Same as upsert_multi but also sets idx from list position.
    """
    if not resource_ids:
        await conn.execute(
            f"UPDATE {table} SET active = false "
            f"WHERE {owner_col} = $1 AND active = true",
            owner_id,
        )
        return

    await conn.execute(
        f"UPDATE {table} SET active = false "
        f"WHERE {owner_col} = $1 AND active = true AND {resource_col} != ALL($2::uuid[])",
        owner_id,
        resource_ids,
    )
    await conn.executemany(
        f"INSERT INTO {table} ({owner_col}, {resource_col}, idx, mcp) "
        f"VALUES ($1, $2, $3, $4) "
        f"ON CONFLICT ON CONSTRAINT {constraint} "
        f"DO UPDATE SET active = true, idx = $3, mcp = $4",
        [(owner_id, rid, idx, mcp) for idx, rid in enumerate(resource_ids)],
    )


async def upsert_multi_with_value(
    conn: asyncpg.Connection,
    *,
    table: str,
    owner_col: str,
    owner_id: UUID,
    resource_col: str,
    resource_values: dict[UUID, bool],
    constraint: str,
    mcp: bool = False,
) -> None:
    """Upsert multi-select junction rows that have a `value` boolean column.

    Same as upsert_multi but also sets a boolean value per resource ID.
    """
    if not resource_values:
        await conn.execute(
            f"UPDATE {table} SET active = false "
            f"WHERE {owner_col} = $1 AND active = true",
            owner_id,
        )
        return

    resource_ids = list(resource_values.keys())
    await conn.execute(
        f"UPDATE {table} SET active = false "
        f"WHERE {owner_col} = $1 AND active = true AND {resource_col} != ALL($2::uuid[])",
        owner_id,
        resource_ids,
    )
    await conn.executemany(
        f"INSERT INTO {table} ({owner_col}, {resource_col}, value, mcp) "
        f"VALUES ($1, $2, $3, $4) "
        f"ON CONFLICT ON CONSTRAINT {constraint} "
        f"DO UPDATE SET active = true, value = $3, mcp = $4",
        [(owner_id, rid, val, mcp) for rid, val in resource_values.items()],
    )


async def insert_single(
    conn: asyncpg.Connection,
    *,
    table: str,
    owner_col: str,
    owner_id: UUID,
    resource_col: str,
    resource_id: UUID,
    generated: bool = False,
    mcp: bool = False,
) -> None:
    """Insert a single junction row (for create, not update)."""
    await conn.execute(
        f"INSERT INTO {table} ({owner_col}, {resource_col}, generated, mcp) "
        f"VALUES ($1, $2, $3, $4)",
        owner_id,
        resource_id,
        generated,
        mcp,
    )


async def insert_multi(
    conn: asyncpg.Connection,
    *,
    table: str,
    owner_col: str,
    owner_id: UUID,
    resource_col: str,
    resource_ids: list[UUID],
    generated: bool = False,
    mcp: bool = False,
) -> None:
    """Insert multiple junction rows (for create, not update)."""
    if not resource_ids:
        return
    await conn.executemany(
        f"INSERT INTO {table} ({owner_col}, {resource_col}, generated, mcp) "
        f"VALUES ($1, $2, $3, $4)",
        [(owner_id, rid, generated, mcp) for rid in resource_ids],
    )


async def insert_multi_with_idx(
    conn: asyncpg.Connection,
    *,
    table: str,
    owner_col: str,
    owner_id: UUID,
    resource_col: str,
    resource_ids: list[UUID],
    generated: bool = False,
    mcp: bool = False,
) -> None:
    """Insert multiple junction rows with idx ordering (for create)."""
    if not resource_ids:
        return
    await conn.executemany(
        f"INSERT INTO {table} ({owner_col}, {resource_col}, idx, generated, mcp) "
        f"VALUES ($1, $2, $3, $4, $5)",
        [(owner_id, rid, idx, generated, mcp) for idx, rid in enumerate(resource_ids)],
    )


async def insert_multi_with_value(
    conn: asyncpg.Connection,
    *,
    table: str,
    owner_col: str,
    owner_id: UUID,
    resource_col: str,
    resource_values: dict[UUID, bool],
    generated: bool = False,
    mcp: bool = False,
) -> None:
    """Insert multiple junction rows with boolean value (for create)."""
    if not resource_values:
        return
    await conn.executemany(
        f"INSERT INTO {table} ({owner_col}, {resource_col}, value, generated, mcp) "
        f"VALUES ($1, $2, $3, $4, $5)",
        [(owner_id, rid, val, generated, mcp) for rid, val in resource_values.items()],
    )
