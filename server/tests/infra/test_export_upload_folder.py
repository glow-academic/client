"""Focused tests for injectable export upload folders."""

from __future__ import annotations

from pathlib import Path
from types import ModuleType
import sys

import pytest

from tests.infra.route_helpers import create_admin_route_actor
from tests.helpers import unique_tag

pytestmark = pytest.mark.asyncio


def _ensure_export_type_packages(artifact_name: str) -> None:
    main_dir = Path(__file__).resolve().parents[2] / "app" / "routes" / "v5" / "api" / "main"
    artifact_dir = main_dir / artifact_name
    if "app.routes.v5.api.main" not in sys.modules:
        package = ModuleType("app.routes.v5.api.main")
        package.__path__ = [str(main_dir)]  # type: ignore[attr-defined]
        sys.modules["app.routes.v5.api.main"] = package
    package_name = f"app.routes.v5.api.main.{artifact_name}"
    if package_name not in sys.modules:
        package = ModuleType(package_name)
        package.__path__ = [str(artifact_dir)]  # type: ignore[attr-defined]
        sys.modules[package_name] = package


async def test_export_persona_impl_writes_to_injected_upload_folder(
    pool,
    redis_client,
    setting_graph_factory,
    tmp_path,
):
    _ensure_export_type_packages("persona")
    from app.infra.persona.export import export_persona_impl
    from app.routes.v5.tools.artifacts.persona.create import create_persona
    from app.routes.v5.tools.resources.names.create import create_name

    actor = await create_admin_route_actor(
        pool,
        redis_client,
        setting_graph_factory,
        tool_artifacts=["persona"],
        group_name="persona-export-folder",
        role_name_prefix="Persona Export Admin",
    )

    async with pool.acquire() as conn:
        name = await create_name(conn, f"persona-export-{unique_tag()}", redis_client)
        persona = await create_persona(
            conn,
            name_id=name.id,
            department_ids=[actor.department_id],
        )

    result = await export_persona_impl(
        pool,
        redis_client,
        profile_id=actor.profile_id,
        session_id=actor.session_id,
        persona_id=persona.id,
        upload_folder=tmp_path,
    )

    exported = tmp_path / result.file_name
    assert exported.exists()
    assert exported.suffix == ".csv"
    assert Path(exported).parent == tmp_path


async def test_export_scenario_impl_writes_to_injected_upload_folder(
    pool,
    redis_client,
    setting_graph_factory,
    tmp_path,
):
    _ensure_export_type_packages("scenario")
    from app.infra.scenario.export import export_scenario_impl
    from app.routes.v5.tools.artifacts.scenario.create import create_scenario
    from app.routes.v5.tools.resources.names.create import create_name
    from app.routes.v5.tools.resources.problem_statements.create import (
        create_problem_statement,
    )

    actor = await create_admin_route_actor(
        pool,
        redis_client,
        setting_graph_factory,
        tool_artifacts=["scenario"],
        group_name="scenario-export-folder",
        role_name_prefix="Scenario Export Admin",
    )

    async with pool.acquire() as conn:
        name = await create_name(conn, f"scenario-export-{unique_tag()}", redis_client)
        problem_statement = await create_problem_statement(
            conn,
            name=f"scenario-problem-{unique_tag()}",
            problem_statement="Export scenario problem statement",
            redis=redis_client,
        )
        scenario = await create_scenario(
            conn,
            name_id=name.id,
            problem_statement_ids=[problem_statement.id],
            department_ids=[actor.department_id],
        )

    result = await export_scenario_impl(
        pool,
        redis_client,
        profile_id=actor.profile_id,
        session_id=actor.session_id,
        scenario_id=scenario.id,
        upload_folder=tmp_path,
    )

    exported = tmp_path / result.file_name
    assert exported.exists()
    assert exported.suffix == ".csv"
    assert Path(exported).parent == tmp_path
