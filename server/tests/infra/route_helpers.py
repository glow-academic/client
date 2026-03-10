"""Shared helpers for v5 artifact route tests."""

from __future__ import annotations

from dataclasses import dataclass
from uuid import UUID

from app.infra.profile_identity_context import resolve_profile_identity_context
from app.routes.v5.tools.entries.groups.create import create_group
from app.routes.v5.tools.entries.sessions.create import create_session
from tests.helpers import unique_tag


@dataclass(frozen=True)
class RouteActor:
    """Minimal authenticated actor for route-level tests."""

    profile_id: UUID
    profiles_id: UUID
    session_id: UUID
    department_id: UUID
    name: str


async def create_admin_route_actor(
    pool,
    redis_client,
    setting_graph_factory,
    *,
    tool_artifacts: list[str] | None = None,
    group_name: str,
    role_name_prefix: str,
) -> RouteActor:
    """Create a route actor with admin role, session, and group."""
    from app.routes.v5.tools.artifacts.profile.update import update_profile
    from app.routes.v5.tools.resources.roles.create import create_role

    graph = await setting_graph_factory(
        tool_artifacts=tool_artifacts or ["persona", "scenario"],
    )

    async with pool.acquire() as conn:
        admin_role = await create_role(
            conn,
            role="admin",
            name=f"{role_name_prefix} {unique_tag()}",
            description=f"{group_name} admin role",
            redis=redis_client,
        )
        await update_profile(
            conn,
            graph.profile_artifact_id,
            role_ids=[admin_role.id],
            redis=redis_client,
        )
        session = await create_session(conn, profile_id=graph.profile_resource_id)
        await create_group(conn, session_id=session.id, name=group_name)

    identity = await resolve_profile_identity_context(
        pool,
        graph.profile_artifact_id,
        redis_client,
        session_id=session.id,
    )
    if identity is None:
        raise AssertionError("Expected route test actor identity to exist")

    return RouteActor(
        profile_id=graph.profile_artifact_id,
        profiles_id=graph.profile_resource_id,
        session_id=session.id,
        department_id=graph.department_id,
        name=identity.name,
    )
