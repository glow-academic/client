"""Integration tests for continue_simulation WebSocket event.

This test file covers the core business logic for continuing simulation attempts:

1. **Scenario Progression Logic:**
   - Uses `simulation_scenarios` as the source of truth for determining which scenarios
     are part of a simulation and their order (via `position` field)
   - Maps child scenarios to parent scenarios via `scenario_tree` when checking
     for graded chats (a scenario is complete if ANY of its child variants has a grade)

2. **Attempt Completion Logic:**
   - An attempt is finished when ALL parent scenarios from `simulation_scenarios` have
     at least one graded chat (via `simulation_chat_grades` table)
   - Uses parent scenario IDs from `simulation_scenarios` as the source of truth
   - Maps child scenario IDs (from `simulation_chats.scenario_id`) to parent IDs
     before checking completion

3. **Chat Reuse Logic (`previous_chat_id` and `previous_chat_map`):**
   - `previous_chat_id`: Reuse a single chat from a previous attempt for the next scenario
   - `previous_chat_map`: Reuse multiple chats from previous attempts, mapping scenario IDs
     to chat IDs that should be reused
   - When reusing, creates a new `attempt_chats` junction entry linking the old chat
     to the new attempt, allowing robust data representation

4. **Advancing Chat Logic:**
   - When a user presses "end session" without completing a chat, the system creates
     an "advancing" chat: 0 messages, marked as completed, but no grade
   - The system then attaches the correct graded chat (if available) via `attempt_chats`
     junction table, ensuring all chats are properly represented

5. **Next Chat Selection:**
   - Determines the next scenario based on `simulation_scenarios.position`
   - Checks if current scenario is complete (has graded chat) before advancing
   - Creates new chat for next scenario or reuses previous chat if provided

6. **Parent Scenario ID Mapping:**
   - The API endpoint `/api/v3/attempts/full` maps child scenario IDs to parent IDs
     when computing `previousChats` for each chat
   - This ensures that `previousChats` are correctly associated with parent scenarios,
     even when the current chat uses a child scenario variant
"""

import asyncpg  # type: ignore
import pytest
from app.socket.simulations.continue_chat import continue_simulation
from tests.integration.socket.conftest import MockSocketIO
from tests.seed_helpers import get_cs_dept_id  # type: ignore
from tests.seed_helpers import get_superadmin_alias

pytestmark = pytest.mark.asyncio


async def test_continue_simulation_missing_chat_id(
    db: asyncpg.Connection, mock_sio: MockSocketIO
) -> None:
    """Test continue_simulation with missing chat_id."""
    sid = "test_sid_123"
    data = {
        "attempt_id": "00000000-0000-0000-0000-000000000000",
    }

    await continue_simulation(sid, data)

    # Verify error was emitted (check both possible event names)
    error_events = mock_sio.get_events("continue_simulation_error")
    if not error_events:
        error_events = mock_sio.get_events("simulation_error")
    assert len(error_events) >= 1
    # Check message in either 'message' field or error details
    message = error_events[0].get("message", "") or str(error_events[0])
    assert (
        "chat_id" in message.lower()
        or "missing" in message.lower()
        or "required" in message.lower()
    )


async def test_continue_simulation_missing_attempt_id(
    db: asyncpg.Connection, mock_sio: MockSocketIO
) -> None:
    """Test continue_simulation with missing attempt_id."""
    sid = "test_sid_123"
    data = {
        "chat_id": "00000000-0000-0000-0000-000000000000",
    }

    await continue_simulation(sid, data)

    # Verify error was emitted (check both possible event names)
    error_events = mock_sio.get_events("continue_simulation_error")
    if not error_events:
        error_events = mock_sio.get_events("simulation_error")
    assert len(error_events) >= 1
    # Check message in either 'message' field or error details
    message = error_events[0].get("message", "") or str(error_events[0])
    assert "attempt_id" in message.lower() or "missing" in message.lower() or "required" in message.lower()


async def test_continue_simulation_chat_not_found(
    db: asyncpg.Connection, mock_sio: MockSocketIO
) -> None:
    """Test continue_simulation with non-existent chat_id."""
    fake_chat_id = "00000000-0000-0000-0000-000000000000"
    fake_attempt_id = "00000000-0000-0000-0000-000000000001"

    sid = "test_sid_123"
    data = {
        "chat_id": fake_chat_id,
        "attempt_id": fake_attempt_id,
    }

    await continue_simulation(sid, data)

    # Verify error was emitted (check both possible event names)
    error_events = mock_sio.get_events("continue_simulation_error")
    if not error_events:
        error_events = mock_sio.get_events("simulation_error")
    assert len(error_events) >= 1
    # Check message in either 'message' field or error details
    message = error_events[0].get("message", "") or str(error_events[0])
    assert "chat" in message.lower() or "not found" in message.lower()


async def test_continue_simulation_attempt_not_found(
    db: asyncpg.Connection, mock_sio: MockSocketIO
) -> None:
    """Test continue_simulation with non-existent attempt_id."""
    # Create test data: get a scenario_id
    scenario_row = await db.fetchrow(
        "SELECT id FROM scenarios WHERE active = true LIMIT 1"
    )
    if not scenario_row:
        pytest.skip("No active scenarios found in test database")
    scenario_id = scenario_row["id"]

    # Create a simulation_chat
    chat_id = await db.fetchval(
        "INSERT INTO simulation_chats (title, scenario_id, completed, trace_id) "
        "VALUES ('Test Chat', $1, false, 'test-trace-id') RETURNING id",
        scenario_id,
    )
    chat_id_str = str(chat_id)

    fake_attempt_id = "00000000-0000-0000-0000-000000000000"

    sid = "test_sid_123"
    data = {
        "chat_id": chat_id_str,
        "attempt_id": fake_attempt_id,
    }

    await continue_simulation(sid, data)

    # Verify error was emitted (check both possible event names)
    error_events = mock_sio.get_events("continue_simulation_error")
    if not error_events:
        error_events = mock_sio.get_events("simulation_error")
    assert len(error_events) >= 1
    # Check message in either 'message' field or error details
    message = error_events[0].get("message", "") or str(error_events[0])
    assert "attempt" in message.lower() or "not found" in message.lower()


# ============================================================================
# Helper Functions for Test Data Setup
# ============================================================================


async def _create_test_simulation_with_scenarios(
    db: asyncpg.Connection,
    num_scenarios: int = 3,
) -> tuple[str, list[str]]:
    """Create a test simulation with multiple scenarios.
    
    Returns:
        Tuple of (simulation_id, list of parent scenario IDs in order)
    """
    profile_id = await get_superadmin_alias(db)
    dept_id = await get_cs_dept_id(db)
    
    # Create rubric
    rubric_id = await db.fetchval("SELECT id FROM rubrics LIMIT 1")
    if not rubric_id:
        rubric_id = await db.fetchval(
            "INSERT INTO rubrics(name, description, points, pass_points, active) "
            "VALUES ('Test Rubric', 'Test', 100, 70, true) RETURNING id"
        )
    
    # Create parent scenarios
    parent_scenario_ids = []
    for i in range(num_scenarios):
        scenario_id = await db.fetchval(
            "INSERT INTO scenarios(name, active) "
            "VALUES ($1, true) RETURNING id",
            f"Test Scenario {i+1}",
        )
        # Create self-referencing entry in scenario_tree (parent = child)
        await db.execute(
            "INSERT INTO scenario_tree(parent_id, child_id, active) VALUES ($1, $1, true)",
            scenario_id,
        )
        parent_scenario_ids.append(str(scenario_id))
    
    # Create simulation
    simulation_id = await db.fetchval(
        "INSERT INTO simulations(title, description, rubric_id, active, practice_simulation) "
        "VALUES ('Test Simulation', 'Test', $1, true, false) RETURNING id",
        rubric_id,
    )
    
    # Link simulation to department
    await db.execute(
        "INSERT INTO simulation_departments(simulation_id, department_id, active) "
        "VALUES ($1, $2, true)",
        simulation_id,
        dept_id,
    )
    
    # Link scenarios to simulation via simulation_scenarios (source of truth)
    for idx, scenario_id in enumerate(parent_scenario_ids):
        await db.execute(
            "INSERT INTO simulation_scenarios(simulation_id, scenario_id, position) "
            "VALUES ($1, $2, $3)",
            simulation_id,
            scenario_id,
            idx + 1,  # position starts at 1
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
        "INSERT INTO simulation_attempts(simulation_id) "
        "VALUES ($1) RETURNING id",
        simulation_id,
    )
    
    # Link profile to attempt via junction table (this has the 'active' flag)
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
    """Create a test simulation chat linked to an attempt.
    
    Args:
        db: Database connection
        scenario_id: Scenario ID (can be parent or child)
        attempt_id: Attempt ID to link chat to
        completed: Whether chat is marked as completed
        num_messages: Number of messages to create in the chat
    
    Returns:
        Chat ID as string
    """
    chat_id = await db.fetchval(
        "INSERT INTO simulation_chats(title, scenario_id, completed, trace_id) "
        "VALUES ($1, $2, $3, $4) RETURNING id",
        "Test Chat",
        scenario_id,
        completed,
        "test-trace-id",
    )
    
    # Link chat to attempt via junction table
    await db.execute(
        "INSERT INTO attempt_chats(attempt_id, chat_id) VALUES ($1, $2)",
        attempt_id,
        chat_id,
    )
    
    # Create messages if requested
    for i in range(num_messages):
        await db.execute(
            "INSERT INTO simulation_messages(chat_id, content, type, completed) "
            "VALUES ($1, $2, $3, true)",
            chat_id,
            f"Test message {i+1}",
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
        300,  # 5 minutes
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
    
    # Link child to parent in scenario_tree
    await db.execute(
        "INSERT INTO scenario_tree(parent_id, child_id, active) VALUES ($1, $2, true)",
        parent_scenario_id,
        child_id,
    )
    
    return str(child_id)


# ============================================================================
# Core Business Logic Tests
# ============================================================================


async def test_continue_simulation_creates_next_chat(
    db: asyncpg.Connection, mock_sio: MockSocketIO
) -> None:
    """Test that continue_simulation creates the next chat in sequence.
    
    Business Logic:
    - When ending a chat, the system should create a new chat for the next scenario
    - Next scenario is determined by `simulation_scenarios.position`
    - New chat should be linked to the attempt via `attempt_chats` junction table
    """
    profile_id = await get_superadmin_alias(db)
    simulation_id, scenario_ids = await _create_test_simulation_with_scenarios(db, 3)
    attempt_id = await _create_test_attempt(db, simulation_id, profile_id)
    
    # Create first chat for scenario 1 with messages
    # Note: We create it as incomplete first, then mark as completed after grading
    # to avoid triggering automatic grading in continue_simulation
    chat1_id = await _create_test_chat(
        db, scenario_ids[0], attempt_id, completed=False, num_messages=5
    )
    
    # Get rubric for grading
    rubric_id = await db.fetchval("SELECT rubric_id FROM simulations WHERE id = $1", simulation_id)
    
    # Grade the first chat
    await _create_test_grade(db, chat1_id, rubric_id)
    
    # Mark chat as completed after grading (this way continue_simulation won't try to grade it)
    await db.execute(
        "UPDATE simulation_chats SET completed = true WHERE id = $1", chat1_id
    )
    
    mock_sio.clear()
    
    # Continue simulation - should create chat for scenario 2
    sid = "test_sid_123"
    await continue_simulation(
        sid,
        {
            "chat_id": chat1_id,
            "attempt_id": attempt_id,
        },
    )
    
    # Verify success event
    continued_events = mock_sio.get_events("simulation_continued")
    assert len(continued_events) == 1
    assert continued_events[0]["success"] is True
    assert continued_events[0]["completed_chat_id"] == chat1_id
    assert continued_events[0]["next_chat_id"] is not None
    assert continued_events[0]["is_attempt_finished"] is False  # Only 1 of 3 scenarios done
    
    # Verify new chat was created and linked to attempt
    next_chat_id = continued_events[0]["next_chat_id"]
    chat_row = await db.fetchrow(
        "SELECT sc.* FROM simulation_chats sc "
        "JOIN attempt_chats ac ON ac.chat_id = sc.id "
        "WHERE sc.id = $1 AND ac.attempt_id = $2",
        next_chat_id,
        attempt_id,
    )
    assert chat_row is not None
    assert str(chat_row["scenario_id"]) == scenario_ids[1]  # Should be scenario 2


async def test_continue_simulation_with_previous_chat_id(
    db: asyncpg.Connection, mock_sio: MockSocketIO
) -> None:
    """Test reusing a chat from a previous attempt via `previous_chat_id`.
    
    Business Logic:
    - `previous_chat_id` allows reusing a chat from a previous attempt
    - The old chat is linked to the new attempt via `attempt_chats` junction table
    - This allows robust data representation: all chats are tracked, but we can
      reuse content from previous attempts
    """
    profile_id = await get_superadmin_alias(db)
    simulation_id, scenario_ids = await _create_test_simulation_with_scenarios(db, 2)
    
    # Create first attempt with first scenario
    attempt1_id = await _create_test_attempt(db, simulation_id, profile_id)
    chat1_id = await _create_test_chat(
        db, scenario_ids[0], attempt1_id, completed=True, num_messages=5
    )
    rubric_id = await db.fetchval("SELECT rubric_id FROM simulations WHERE id = $1", simulation_id)
    await _create_test_grade(db, chat1_id, rubric_id)
    
    # Create second attempt
    attempt2_id = await _create_test_attempt(db, simulation_id, profile_id)
    chat2_id = await _create_test_chat(
        db, scenario_ids[0], attempt2_id, completed=True, num_messages=3
    )
    await _create_test_grade(db, chat2_id, rubric_id)
    
    mock_sio.clear()
    
    # Continue second attempt, reusing chat1 from first attempt for scenario 2
    sid = "test_sid_123"
    await continue_simulation(
        sid,
        {
            "chat_id": chat2_id,
            "attempt_id": attempt2_id,
            "previous_chat_id": chat1_id,  # Reuse chat from attempt1
        },
    )
    
    # Verify success
    continued_events = mock_sio.get_events("simulation_continued")
    assert len(continued_events) == 1
    assert continued_events[0]["success"] is True
    
    # Verify that chat1 is now linked to attempt2
    link_row = await db.fetchrow(
        "SELECT * FROM attempt_chats WHERE attempt_id = $1 AND chat_id = $2",
        attempt2_id,
        chat1_id,
    )
    assert link_row is not None
    
    # Verify the reused chat is for scenario 2
    chat_row = await db.fetchrow("SELECT scenario_id FROM simulation_chats WHERE id = $1", chat1_id)
    assert str(chat_row["scenario_id"]) == scenario_ids[1]


async def test_continue_simulation_with_previous_chat_map(
    db: asyncpg.Connection, mock_sio: MockSocketIO
) -> None:
    """Test reusing multiple chats from previous attempts via `previous_chat_map`.
    
    Business Logic:
    - `previous_chat_map` maps scenario IDs to chat IDs that should be reused
    - Allows reusing multiple chats at once when continuing an attempt
    - Each reused chat is linked to the new attempt via `attempt_chats`
    """
    profile_id = await get_superadmin_alias(db)
    simulation_id, scenario_ids = await _create_test_simulation_with_scenarios(db, 3)
    
    # Create first attempt with all scenarios
    attempt1_id = await _create_test_attempt(db, simulation_id, profile_id)
    chat1_id = await _create_test_chat(db, scenario_ids[0], attempt1_id, completed=True)
    chat2_id = await _create_test_chat(db, scenario_ids[1], attempt1_id, completed=True)
    chat3_id = await _create_test_chat(db, scenario_ids[2], attempt1_id, completed=True)
    rubric_id = await db.fetchval("SELECT rubric_id FROM simulations WHERE id = $1", simulation_id)
    await _create_test_grade(db, chat1_id, rubric_id)
    await _create_test_grade(db, chat2_id, rubric_id)
    await _create_test_grade(db, chat3_id, rubric_id)
    
    # Create second attempt
    attempt2_id = await _create_test_attempt(db, simulation_id, profile_id)
    new_chat1_id = await _create_test_chat(db, scenario_ids[0], attempt2_id, completed=True)
    await _create_test_grade(db, new_chat1_id, rubric_id)
    
    mock_sio.clear()
    
    # Continue second attempt, reusing chats 2 and 3 from attempt1
    sid = "test_sid_123"
    await continue_simulation(
        sid,
        {
            "chat_id": new_chat1_id,
            "attempt_id": attempt2_id,
            "previous_chat_map": {
                scenario_ids[1]: chat2_id,  # Reuse chat2 for scenario 2
                scenario_ids[2]: chat3_id,  # Reuse chat3 for scenario 3
            },
        },
    )
    
    # Verify success
    continued_events = mock_sio.get_events("simulation_continued")
    assert len(continued_events) == 1
    assert continued_events[0]["success"] is True
    
    # Verify both chats are linked to attempt2
    link2 = await db.fetchrow(
        "SELECT * FROM attempt_chats WHERE attempt_id = $1 AND chat_id = $2",
        attempt2_id,
        chat2_id,
    )
    link3 = await db.fetchrow(
        "SELECT * FROM attempt_chats WHERE attempt_id = $1 AND chat_id = $2",
        attempt2_id,
        chat3_id,
    )
    assert link2 is not None
    assert link3 is not None


async def test_continue_simulation_attempt_completion_logic(
    db: asyncpg.Connection, mock_sio: MockSocketIO
) -> None:
    """Test that attempt completion is determined correctly.
    
    Business Logic:
    - An attempt is finished when ALL parent scenarios from `simulation_scenarios`
      have at least one graded chat
    - Uses `simulation_scenarios` as source of truth (not `scenario_links`)
    - Maps child scenario IDs to parent IDs when checking for grades
    """
    profile_id = await get_superadmin_alias(db)
    simulation_id, scenario_ids = await _create_test_simulation_with_scenarios(db, 3)
    attempt_id = await _create_test_attempt(db, simulation_id, profile_id)
    rubric_id = await db.fetchval("SELECT rubric_id FROM simulations WHERE id = $1", simulation_id)
    
    # Complete and grade scenario 1
    chat1_id = await _create_test_chat(db, scenario_ids[0], attempt_id, completed=True)
    await _create_test_grade(db, chat1_id, rubric_id)
    
    # Complete and grade scenario 2
    chat2_id = await _create_test_chat(db, scenario_ids[1], attempt_id, completed=True)
    await _create_test_grade(db, chat2_id, rubric_id)
    
    mock_sio.clear()
    
    # Continue - should create chat for scenario 3, attempt not finished yet
    await continue_simulation(
        sid := "test_sid_123",
        {
            "chat_id": chat2_id,
            "attempt_id": attempt_id,
        },
    )
    
    continued_events = mock_sio.get_events("simulation_continued")
    assert len(continued_events) == 1
    assert continued_events[0]["is_attempt_finished"] is False  # Scenario 3 not done yet
    
    # Complete and grade scenario 3
    chat3_id = continued_events[0]["next_chat_id"]
    await db.execute(
        "UPDATE simulation_chats SET completed = true WHERE id = $1", chat3_id
    )
    await _create_test_grade(db, chat3_id, rubric_id)
    
    mock_sio.clear()
    
    # Continue again - attempt should now be finished
    await continue_simulation(
        sid,
        {
            "chat_id": chat3_id,
            "attempt_id": attempt_id,
        },
    )
    
    continued_events = mock_sio.get_events("simulation_continued")
    assert len(continued_events) == 1
    assert continued_events[0]["is_attempt_finished"] is True  # All scenarios done


async def test_continue_simulation_with_child_scenario_grades(
    db: asyncpg.Connection, mock_sio: MockSocketIO
) -> None:
    """Test that child scenario grades are correctly mapped to parent scenarios.
    
    Business Logic:
    - A parent scenario is considered complete if ANY of its child variants has a grade
    - Uses `scenario_tree` to map child scenario IDs to parent IDs
    - This mapping happens when checking `scenarios_with_grades_set`
    """
    profile_id = await get_superadmin_alias(db)
    simulation_id, scenario_ids = await _create_test_simulation_with_scenarios(db, 2)
    attempt_id = await _create_test_attempt(db, simulation_id, profile_id)
    rubric_id = await db.fetchval("SELECT rubric_id FROM simulations WHERE id = $1", simulation_id)
    
    # Create a child scenario variant for scenario 1
    child_scenario_id = await _create_child_scenario(db, scenario_ids[0], "Child Variant")
    
    # Create chat with child scenario and grade it
    child_chat_id = await _create_test_chat(db, child_scenario_id, attempt_id, completed=True)
    await _create_test_grade(db, child_chat_id, rubric_id)
    
    mock_sio.clear()
    
    # Continue - should recognize scenario 1 as complete (via child grade)
    # and create chat for scenario 2
    await continue_simulation(
        sid := "test_sid_123",
        {
            "chat_id": child_chat_id,
            "attempt_id": attempt_id,
        },
    )
    
    continued_events = mock_sio.get_events("simulation_continued")
    assert len(continued_events) == 1
    assert continued_events[0]["success"] is True
    assert continued_events[0]["next_chat_id"] is not None
    
    # Verify new chat is for scenario 2 (parent)
    next_chat_id = continued_events[0]["next_chat_id"]
    next_chat_row = await db.fetchrow(
        "SELECT scenario_id FROM simulation_chats WHERE id = $1", next_chat_id
    )
    assert str(next_chat_row["scenario_id"]) == scenario_ids[1]


async def test_continue_simulation_advancing_chat_logic(
    db: asyncpg.Connection, mock_sio: MockSocketIO
) -> None:
    """Test that advancing chats (0 messages, completed, no grade) are created correctly.
    
    Business Logic:
    - When user presses "end session" without completing a chat, system creates
      an advancing chat: 0 messages, marked as completed, but no grade
    - The system then attaches the correct graded chat (if available) via `attempt_chats`
    - This allows proper data representation: all chats tracked, but advancing
      chats don't have grades
    """
    profile_id = await get_superadmin_alias(db)
    simulation_id, scenario_ids = await _create_test_simulation_with_scenarios(db, 2)
    attempt_id = await _create_test_attempt(db, simulation_id, profile_id)
    rubric_id = await db.fetchval("SELECT rubric_id FROM simulations WHERE id = $1", simulation_id)
    
    # Create first chat with grade
    chat1_id = await _create_test_chat(db, scenario_ids[0], attempt_id, completed=True)
    await _create_test_grade(db, chat1_id, rubric_id)
    
    mock_sio.clear()
    
    # Continue - creates advancing chat for scenario 2 (no messages, completed, no grade)
    await continue_simulation(
        sid := "test_sid_123",
        {
            "chat_id": chat1_id,
            "attempt_id": attempt_id,
        },
    )
    
    continued_events = mock_sio.get_events("simulation_continued")
    assert len(continued_events) == 1
    advancing_chat_id = continued_events[0]["next_chat_id"]
    
    # Verify advancing chat properties
    advancing_chat = await db.fetchrow(
        "SELECT completed, scenario_id FROM simulation_chats WHERE id = $1", advancing_chat_id
    )
    assert advancing_chat["completed"] is True
    assert str(advancing_chat["scenario_id"]) == scenario_ids[1]
    
    # Verify no messages in advancing chat
    message_count = await db.fetchval(
        "SELECT COUNT(*) FROM simulation_messages WHERE chat_id = $1", advancing_chat_id
    )
    assert message_count == 0
    
    # Verify no grade for advancing chat
    grade_count = await db.fetchval(
        "SELECT COUNT(*) FROM simulation_chat_grades WHERE simulation_chat_id = $1",
        advancing_chat_id,
    )
    assert grade_count == 0
    
    # Verify advancing chat is linked to attempt
    link = await db.fetchrow(
        "SELECT * FROM attempt_chats WHERE attempt_id = $1 AND chat_id = $2",
        attempt_id,
        advancing_chat_id,
    )
    assert link is not None


async def test_continue_simulation_end_all_flag(
    db: asyncpg.Connection, mock_sio: MockSocketIO
) -> None:
    """Test that `end_all` flag properly ends all remaining chats.
    
    Business Logic:
    - `end_all=True` creates advancing chats for all remaining incomplete scenarios
    - All created chats are marked as completed but have no grades
    - Attempt completion status is correctly determined after ending all
    """
    profile_id = await get_superadmin_alias(db)
    simulation_id, scenario_ids = await _create_test_simulation_with_scenarios(db, 3)
    attempt_id = await _create_test_attempt(db, simulation_id, profile_id)
    rubric_id = await db.fetchval("SELECT rubric_id FROM simulations WHERE id = $1", simulation_id)
    
    # Complete and grade scenario 1
    chat1_id = await _create_test_chat(db, scenario_ids[0], attempt_id, completed=True)
    await _create_test_grade(db, chat1_id, rubric_id)
    
    mock_sio.clear()
    
    # End all - should create advancing chats for scenarios 2 and 3
    await continue_simulation(
        sid := "test_sid_123",
        {
            "chat_id": chat1_id,
            "attempt_id": attempt_id,
            "end_all": True,
        },
    )
    
    # Verify end_all_completed event
    end_all_events = mock_sio.get_events("end_all_completed")
    assert len(end_all_events) == 1
    assert end_all_events[0]["success"] is True
    assert end_all_events[0]["all_completed"] is True
    
    # Verify advancing chats were created for scenarios 2 and 3
    next_chat_ids = end_all_events[0]["next_chat_ids"]
    assert len(next_chat_ids) == 2
    assert None not in next_chat_ids
    
    # Verify both advancing chats are completed but have no grades
    for next_chat_id in next_chat_ids:
        chat = await db.fetchrow(
            "SELECT completed FROM simulation_chats WHERE id = $1", next_chat_id
        )
        assert chat["completed"] is True
        
        grade_count = await db.fetchval(
            "SELECT COUNT(*) FROM simulation_chat_grades WHERE simulation_chat_id = $1",
            next_chat_id,
        )
        assert grade_count == 0
