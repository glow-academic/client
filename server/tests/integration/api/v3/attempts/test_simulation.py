"""Integration tests for POST /api/v3/attempts/simulation endpoint.

This test file covers the core business logic for the attempt full data endpoint:

1. **Parent Scenario ID Mapping:**
   - The endpoint maps child scenario IDs to parent scenario IDs when computing
     `previousChats` for each chat
   - This ensures that `previousChats` are correctly associated with parent scenarios,
     even when the current chat uses a child scenario variant
   - The `parentScenarioId` field is added to each chat object for frontend use

2. **Previous Chats Computation:**
   - `previousChats` are computed server-side using the parent scenario ID
   - For each parent scenario, finds all chats from previous attempts that used
     that scenario (or any of its child variants)
   - Maps child scenario IDs to parent IDs before matching

3. **Current Chat Index:**
   - Calculated as the index of the first incomplete chat among all chats
   - Uses `ROW_NUMBER() OVER (ORDER BY created_at)` to rank all chats first,
     then finds the row number of the first incomplete chat

4. **All Simulation Scenarios:**
   - Returns all scenarios from `simulation_scenarios` (source of truth)
   - Each scenario includes its `previousChats` computed using parent scenario ID
   - Ensures consistent data structure for frontend consumption
"""

import asyncpg  # type: ignore
import httpx
import pytest
from tests.seed_helpers import (
    get_cs_dept_id,  # type: ignore
    get_superadmin_alias,
)

pytestmark = pytest.mark.asyncio


# ============================================================================
# Helper Functions (reuse from test_continue.py pattern)
# ============================================================================


async def _create_test_simulation_with_scenarios(
    db: asyncpg.Connection,
    num_scenarios: int = 3,
) -> tuple[str, list[str]]:
    """Create a test simulation with multiple scenarios."""
    profile_id = await get_superadmin_alias(db)
    dept_id = await get_cs_dept_id(db)

    rubric_id = await db.fetchval("SELECT id FROM rubrics LIMIT 1")
    if not rubric_id:
        rubric_id = await db.fetchval(
            "INSERT INTO rubrics(name, description, points, pass_points, active) "
            "VALUES ('Test Rubric', 'Test', 100, 70, true) RETURNING id"
        )

    parent_scenario_ids = []
    for i in range(num_scenarios):
        scenario_id = await db.fetchval(
            "INSERT INTO scenarios(name, active) VALUES ($1, true) RETURNING id",
            f"Test Scenario {i + 1}",
        )
        await db.execute(
            "INSERT INTO scenario_tree(parent_id, child_id, active) VALUES ($1, $1, true)",
            scenario_id,
        )
        parent_scenario_ids.append(str(scenario_id))

    simulation_id = await db.fetchval(
        "INSERT INTO simulations(title, description, rubric_id, active, practice_simulation) "
        "VALUES ('Test Simulation', 'Test', $1, true, false) RETURNING id",
        rubric_id,
    )

    await db.execute(
        "INSERT INTO simulation_departments(simulation_id, department_id, active) "
        "VALUES ($1, $2, true)",
        simulation_id,
        dept_id,
    )

    for idx, scenario_id in enumerate(parent_scenario_ids):
        await db.execute(
            "INSERT INTO simulation_scenarios(simulation_id, scenario_id, position) "
            "VALUES ($1, $2, $3)",
            simulation_id,
            scenario_id,
            idx + 1,
        )

    return (str(simulation_id), parent_scenario_ids)


async def _create_test_attempt(
    db: asyncpg.Connection,
    simulation_id: str,
    profile_id: str,
) -> str:
    """Create a test simulation attempt.

    Note: simulation_attempts table doesn't have an 'active' column.
    The 'active' flag is managed via attempt_profiles junction table.
    """
    attempt_id = await db.fetchval(
        "INSERT INTO simulation_attempts(simulation_id) VALUES ($1) RETURNING id",
        simulation_id,
    )

    await db.execute(
        "INSERT INTO attempt_profiles(attempt_id, profile_id, active) "
        "VALUES ($1, $2, true)",
        attempt_id,
        profile_id,
    )

    return str(attempt_id)


async def _create_test_chat(
    db: asyncpg.Connection,
    scenario_id: str,
    attempt_id: str,
    completed: bool = False,
    num_messages: int = 0,
) -> str:
    """Create a test simulation chat linked to an attempt."""
    chat_id = await db.fetchval(
        "INSERT INTO simulation_chats(title, scenario_id, completed, trace_id) "
        "VALUES ($1, $2, $3, $4) RETURNING id",
        "Test Chat",
        scenario_id,
        completed,
        "test-trace-id",
    )

    await db.execute(
        "INSERT INTO attempt_chats(attempt_id, chat_id) VALUES ($1, $2)",
        attempt_id,
        chat_id,
    )

    for i in range(num_messages):
        await db.execute(
            "INSERT INTO simulation_messages(chat_id, content, type, completed) "
            "VALUES ($1, $2, $3, true)",
            chat_id,
            f"Test message {i + 1}",
            "query" if i % 2 == 0 else "response",
        )

    return str(chat_id)


async def _create_test_grade(
    db: asyncpg.Connection,
    chat_id: str,
    rubric_id: str,
    score: int = 80,
    passed: bool = True,
) -> str:
    """Create a test grade for a chat."""
    grade_id = await db.fetchval(
        "INSERT INTO simulation_chat_grades("
        "simulation_chat_id, rubric_id, score, passed, time_taken"
        ") VALUES ($1, $2, $3, $4, $5) RETURNING id",
        chat_id,
        rubric_id,
        score,
        passed,
        300,
    )
    return str(grade_id)


async def _create_child_scenario(
    db: asyncpg.Connection,
    parent_scenario_id: str,
    name: str = "Child Scenario",
) -> str:
    """Create a child scenario variant linked to a parent."""
    child_id = await db.fetchval(
        "INSERT INTO scenarios(name, active) VALUES ($1, true) RETURNING id",
        name,
    )

    await db.execute(
        "INSERT INTO scenario_tree(parent_id, child_id, active) VALUES ($1, $2, true)",
        parent_scenario_id,
        child_id,
    )

    return str(child_id)


# ============================================================================
# Core Business Logic Tests
# ============================================================================


async def test_get_attempt_full_parent_scenario_id_mapping(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test that parentScenarioId is correctly computed for chats with child scenarios.

    Business Logic:
    - Chats can use child scenario variants, but we need to map them to parent IDs
    - The `parentScenarioId` field allows the frontend to correctly match chats
      with scenarios in `allSimulationScenarios`
    """
    profile_id = await get_superadmin_alias(db)
    simulation_id, scenario_ids = await _create_test_simulation_with_scenarios(db, 2)
    attempt_id = await _create_test_attempt(db, simulation_id, profile_id)

    # Create a child scenario variant for scenario 1
    child_scenario_id = await _create_child_scenario(
        db, scenario_ids[0], "Child Variant"
    )

    # Create chat using child scenario
    chat_id = await _create_test_chat(db, child_scenario_id, attempt_id, completed=True)

    # Call API
    response = await client.post(
        "/api/v3/attempts/simulation",
        json={"attemptId": attempt_id},
        headers={"X-Cache-Update": "999999"},
    )

    assert response.status_code == 200
    data = response.json()

    # Verify chat has both scenarioId (child) and parentScenarioId (parent)
    chats = data.get("chats", [])
    assert len(chats) == 1

    chat = chats[0]["chat"]
    assert chat["scenarioId"] == child_scenario_id  # Original child ID
    assert chat["parentScenarioId"] == scenario_ids[0]  # Mapped to parent


async def test_get_attempt_full_previous_chats_with_child_scenarios(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test that previousChats are correctly computed using parent scenario IDs.

    Business Logic:
    - `previousChats` should be computed server-side using parent scenario ID
    - Even if a chat uses a child scenario, its `previousChats` should match
      the parent scenario's previous chats
    - This ensures frontend can correctly display reuse options
    """
    profile_id = await get_superadmin_alias(db)
    simulation_id, scenario_ids = await _create_test_simulation_with_scenarios(db, 2)
    rubric_id = await db.fetchval(
        "SELECT rubric_id FROM simulations WHERE id = $1", simulation_id
    )

    # Create first attempt with scenario 1 (parent)
    attempt1_id = await _create_test_attempt(db, simulation_id, profile_id)
    chat1_id = await _create_test_chat(db, scenario_ids[0], attempt1_id, completed=True)
    await _create_test_grade(db, chat1_id, rubric_id)

    # Create second attempt with scenario 1 (child variant)
    attempt2_id = await _create_test_attempt(db, simulation_id, profile_id)
    child_scenario_id = await _create_child_scenario(
        db, scenario_ids[0], "Child Variant"
    )
    chat2_id = await _create_test_chat(
        db, child_scenario_id, attempt2_id, completed=True
    )
    await _create_test_grade(db, chat2_id, rubric_id)

    # Call API for attempt2
    response = await client.post(
        "/api/v3/attempts/full",
        json={"attemptId": attempt2_id},
        headers={"X-Cache-Update": "999999"},
    )

    assert response.status_code == 200
    data = response.json()

    # Verify chat2 has previousChats (from chat1, even though chat2 uses child scenario)
    chats = data.get("chats", [])
    assert len(chats) >= 1

    # Find chat2 in response
    chat2_data = next((c for c in chats if c["chat"]["id"] == chat2_id), None)
    assert chat2_data is not None

    # Verify previousChats includes chat1 (mapped via parent scenario ID)
    previous_chats = chat2_data.get("previousChats", [])
    assert len(previous_chats) >= 1

    # Verify allSimulationScenarios also has previousChats for scenario 1
    all_scenarios = data.get("allSimulationScenarios", [])
    scenario1_data = next(
        (s for s in all_scenarios if s["id"] == scenario_ids[0]), None
    )
    assert scenario1_data is not None
    assert len(scenario1_data.get("previousChats", [])) >= 1


async def test_get_attempt_full_current_chat_index(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test that currentChatIndex is correctly calculated.

    Business Logic:
    - `currentChatIndex` is the index of the first incomplete chat among all chats
    - Uses `ROW_NUMBER() OVER (ORDER BY created_at)` to rank all chats first,
      then finds the row number of the first incomplete chat
    - Index is 0-based (first chat is 0, second is 1, etc.)
    """
    profile_id = await get_superadmin_alias(db)
    simulation_id, scenario_ids = await _create_test_simulation_with_scenarios(db, 3)
    attempt_id = await _create_test_attempt(db, simulation_id, profile_id)

    # Create 3 chats: first two completed, third incomplete
    chat1_id = await _create_test_chat(db, scenario_ids[0], attempt_id, completed=True)
    chat2_id = await _create_test_chat(db, scenario_ids[1], attempt_id, completed=True)
    chat3_id = await _create_test_chat(db, scenario_ids[2], attempt_id, completed=False)

    # Call API
    response = await client.post(
        "/api/v3/attempts/simulation",
        json={"attemptId": attempt_id},
        headers={"X-Cache-Update": "999999"},
    )

    assert response.status_code == 200
    data = response.json()

    # Verify currentChatIndex points to chat3 (index 2, third chat)
    current_index = data.get("currentChatIndex", -1)
    assert current_index == 2

    # Verify chats array has 3 chats
    chats = data.get("chats", [])
    assert len(chats) == 3

    # Verify the chat at currentChatIndex is incomplete
    current_chat = chats[current_index]
    assert current_chat["chat"]["completed"] is False
    assert current_chat["chat"]["id"] == chat3_id


async def test_get_attempt_full_all_simulation_scenarios(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test that allSimulationScenarios includes all scenarios with previousChats.

    Business Logic:
    - Returns all scenarios from `simulation_scenarios` (source of truth)
    - Each scenario includes its `previousChats` computed using parent scenario ID
    - Ensures consistent data structure for frontend consumption
    """
    profile_id = await get_superadmin_alias(db)
    simulation_id, scenario_ids = await _create_test_simulation_with_scenarios(db, 3)
    rubric_id = await db.fetchval(
        "SELECT rubric_id FROM simulations WHERE id = $1", simulation_id
    )

    # Create first attempt with all scenarios
    attempt1_id = await _create_test_attempt(db, simulation_id, profile_id)
    chat1_id = await _create_test_chat(db, scenario_ids[0], attempt1_id, completed=True)
    chat2_id = await _create_test_chat(db, scenario_ids[1], attempt1_id, completed=True)
    chat3_id = await _create_test_chat(db, scenario_ids[2], attempt1_id, completed=True)
    await _create_test_grade(db, chat1_id, rubric_id)
    await _create_test_grade(db, chat2_id, rubric_id)
    await _create_test_grade(db, chat3_id, rubric_id)

    # Create second attempt
    attempt2_id = await _create_test_attempt(db, simulation_id, profile_id)
    new_chat1_id = await _create_test_chat(
        db, scenario_ids[0], attempt2_id, completed=True
    )
    await _create_test_grade(db, new_chat1_id, rubric_id)

    # Call API for attempt2
    response = await client.post(
        "/api/v3/attempts/full",
        json={"attemptId": attempt2_id},
        headers={"X-Cache-Update": "999999"},
    )

    assert response.status_code == 200
    data = response.json()

    # Verify allSimulationScenarios has all 3 scenarios
    all_scenarios = data.get("allSimulationScenarios", [])
    assert len(all_scenarios) == 3

    # Verify each scenario has previousChats
    for scenario in all_scenarios:
        assert scenario["id"] in scenario_ids
        # Scenario 1 should have previousChats (from attempt1)
        if scenario["id"] == scenario_ids[0]:
            assert len(scenario.get("previousChats", [])) >= 1
        # Scenarios 2 and 3 should also have previousChats (from attempt1)
        elif scenario["id"] in [scenario_ids[1], scenario_ids[2]]:
            assert len(scenario.get("previousChats", [])) >= 1
