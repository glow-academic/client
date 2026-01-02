"""Helper functions for socket v4 integration tests."""

import asyncpg  # type: ignore
from utils.sql_helper import execute_sql_typed

from app.sql.types import (
    GetOrCreateTestDepartmentV4SqlParams,
    GetOrCreateTestDepartmentV4SqlRow,
    GetOrCreateTestModelV4SqlParams,
    GetOrCreateTestModelV4SqlRow,
    GetOrCreateTestProfileV4SqlParams,
    GetOrCreateTestProfileV4SqlRow,
    TestGetOrCreateTestAgentV4SqlParams,
    TestGetOrCreateTestAgentV4SqlRow,
)


async def get_or_create_test_profile(
    db: asyncpg.Connection, email: str = "redacted@purdue.edu"
) -> str:
    """Get existing profile by email or create a new one."""
    params = GetOrCreateTestProfileV4SqlParams(email=email)
    result = await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/v4/integration/helpers/test_get_or_create_test_profile_v4_complete.sql",
        params=params,
    )
    return str(result.profile_id)


async def get_or_create_test_department(
    db: asyncpg.Connection, title: str = "Computer Science"
) -> str:
    """Get existing department by title or create a new one."""
    params = GetOrCreateTestDepartmentV4SqlParams(title=title)
    result = await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/v4/integration/helpers/test_get_or_create_test_department_v4_complete.sql",
        params=params,
    )
    return str(result.department_id)


async def get_or_create_test_model(
    db: asyncpg.Connection, name: str = "Test Model"
) -> str:
    """Get existing model or create a new one with provider."""
    params = GetOrCreateTestModelV4SqlParams(name=name)
    result = await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/v4/integration/helpers/test_get_or_create_test_model_v4_complete.sql",
        params=params,
    )
    return str(result.model_id)


async def get_or_create_test_agent(
    db: asyncpg.Connection,
    name: str = "Test Agent",
    description: str = "Test Description",
) -> str:
    """Get existing agent or create a new one."""
    params = TestGetOrCreateTestAgentV4SqlParams(name=name, description=description)
    result = await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/v4/integration/socket/helpers/test_get_or_create_test_agent_v4_complete.sql",
        params=params,
    )
    return str(result.agent_id)


async def create_test_scenario(
    db: asyncpg.Connection, name: str = "Test Scenario"
) -> str:
    """Create a test scenario using SQL helper."""
    from app.sql.types import (
        TestCreateTestScenarioV4SqlParams,
        TestCreateTestScenarioV4SqlRow,
    )

    params = TestCreateTestScenarioV4SqlParams(name=name)
    result = await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/v4/integration/socket/helpers/test_create_test_scenario_v4_complete.sql",
        params=params,
    )
    return str(result.scenario_id)


async def create_test_chat(
    db: asyncpg.Connection, scenario_id: str, trace_id: str = "test-trace-id"
) -> str:
    """Create a test chat using SQL helper."""
    from app.sql.types import (
        TestCreateTestChatV4SqlParams,
        TestCreateTestChatV4SqlRow,
    )

    params = TestCreateTestChatV4SqlParams(scenario_id=scenario_id, trace_id=trace_id)
    result = await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/v4/integration/socket/helpers/test_create_test_chat_v4_complete.sql",
        params=params,
    )
    return str(result.chat_id)


async def create_test_rubric(
    db: asyncpg.Connection,
    name: str = "Test Rubric",
    description: str = "Test Description",
    points: int = 100,
    pass_points: int = 70,
) -> str:
    """Create a test rubric using SQL helper."""
    from app.sql.types import (
        TestCreateTestRubricV4SqlParams,
        TestCreateTestRubricV4SqlRow,
    )

    params = TestCreateTestRubricV4SqlParams(
        name=name, description=description, points=points, pass_points=pass_points
    )
    result = await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/v4/integration/socket/helpers/test_create_test_rubric_v4_complete.sql",
        params=params,
    )
    return str(result.rubric_id)


async def create_test_group(
    db: asyncpg.Connection, rubric_id: str, trace_id: str = "test-trace-id"
) -> str:
    """Create a test group using SQL helper."""
    from app.sql.types import (
        TestCreateTestGroupV4SqlParams,
        TestCreateTestGroupV4SqlRow,
    )

    params = TestCreateTestGroupV4SqlParams(rubric_id=rubric_id, trace_id=trace_id)
    result = await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/v4/integration/socket/helpers/test_create_test_group_v4_complete.sql",
        params=params,
    )
    return str(result.group_id)


async def get_simulation_by_active(db: asyncpg.Connection) -> str | None:
    """Get first active simulation ID using SQL helper."""
    from app.sql.types import TestGetSimulationByActiveV4SqlRow

    result = await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/v4/integration/socket/helpers/test_get_simulation_by_active_v4_complete.sql",
        params=None,
    )
    return str(result.id) if result.id else None


async def get_eval_by_active(db: asyncpg.Connection) -> str | None:
    """Get first active eval ID using SQL helper."""
    from app.sql.types import TestGetEvalByActiveV4SqlRow

    result = await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/v4/integration/socket/helpers/test_get_eval_by_active_v4_complete.sql",
        params=None,
    )
    return str(result.id) if result.id else None


async def get_chat_by_id(db: asyncpg.Connection, chat_id: str) -> dict[str, any] | None:
    """Get chat by ID using SQL helper."""
    from app.sql.types import (
        TestGetChatByIdV4SqlParams,
        TestGetChatByIdV4SqlRow,
    )

    result = await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/v4/integration/socket/helpers/test_get_chat_by_id_v4_complete.sql",
        params=TestGetChatByIdV4SqlParams(chat_id=chat_id),
    )
    return (
        {
            "id": str(result.id),
            "completed": result.completed,
            "created_at": result.created_at,
        }
        if result.id
        else None
    )


async def create_test_attempt(db: asyncpg.Connection, simulation_id: str) -> str:
    """Create a test attempt using SQL helper."""
    from app.sql.types import (
        TestCreateTestAttemptV4SqlParams,
        TestCreateTestAttemptV4SqlRow,
    )

    params = TestCreateTestAttemptV4SqlParams(simulation_id=simulation_id)
    result = await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/v4/integration/socket/helpers/test_create_test_attempt_v4_complete.sql",
        params=params,
    )
    return str(result.attempt_id)


async def create_test_benchmark_attempt(db: asyncpg.Connection, eval_id: str) -> str:
    """Create a test benchmark attempt using SQL helper."""
    from app.sql.types import (
        TestCreateTestBenchmarkAttemptV4SqlParams,
        TestCreateTestBenchmarkAttemptV4SqlRow,
    )

    params = TestCreateTestBenchmarkAttemptV4SqlParams(eval_id=eval_id)
    result = await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/v4/integration/socket/helpers/test_create_test_benchmark_attempt_v4_complete.sql",
        params=params,
    )
    return str(result.attempt_id)


async def create_test_test(
    db: asyncpg.Connection, title: str = "Test Test", run_id: str | None = None
) -> str:
    """Create a test test using SQL helper."""
    from app.sql.types import (
        TestCreateTestTestV4SqlParams,
        TestCreateTestTestV4SqlRow,
    )

    params = TestCreateTestTestV4SqlParams(title=title, run_id=run_id)
    result = await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/v4/integration/socket/helpers/test_create_test_test_v4_complete.sql",
        params=params,
    )
    return str(result.test_id)
