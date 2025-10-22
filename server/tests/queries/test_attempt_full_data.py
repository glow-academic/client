"""Real database integration tests for get_attempt_full_data query."""

import asyncpg  # type: ignore
import pytest
from app.queries.simulation_queries import get_attempt_full_data
from tests.seed_helpers import get_cs_dept_id, get_superadmin_alias

pytestmark = pytest.mark.asyncio


async def test_get_attempt_full_data_returns_complete_structure(
    db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test that get_attempt_full_data returns all expected fields."""
    # Get a real attempt ID from the database
    attempt_id = await db.fetchval(
        "SELECT id FROM simulation_attempts ORDER BY created_at DESC LIMIT 1"
    )
    
    if not attempt_id:
        pytest.skip("No attempts found in database")
    
    result = await get_attempt_full_data(db, str(attempt_id))
    
    # Assert main structure
    assert "attempt" in result
    assert "simulation" in result
    assert "attemptProfiles" in result
    assert "chats" in result
    assert "scenarioDocuments" in result
    assert "departmentDocuments" in result
    assert "timer" in result
    assert "rubricStructure" in result
    
    # Assert attempt fields
    assert result["attempt"]["id"] == str(attempt_id)
    assert "createdAt" in result["attempt"]
    assert "simulationId" in result["attempt"]
    assert "infiniteMode" in result["attempt"]
    assert "archived" in result["attempt"]
    
    # Assert simulation fields
    assert "id" in result["simulation"]
    assert "title" in result["simulation"]
    assert "timeLimit" in result["simulation"]


async def test_get_attempt_full_data_chats_have_persona_id(
    db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test that chat scenarios include personaId field."""
    # Get an attempt with chats
    attempt_id = await db.fetchval(
        """
        SELECT sa.id 
        FROM simulation_attempts sa
        JOIN simulation_chats sc ON sc.attempt_id = sa.id
        ORDER BY sa.created_at DESC 
        LIMIT 1
        """
    )
    
    if not attempt_id:
        pytest.skip("No attempts with chats found in database")
    
    result = await get_attempt_full_data(db, str(attempt_id))
    
    # Assert chats exist and have proper structure
    assert len(result["chats"]) > 0, "Should have at least one chat"
    
    for chat in result["chats"]:
        assert "scenario" in chat
        if chat["scenario"]:  # Scenario could be null
            assert "id" in chat["scenario"]
            assert "personaId" in chat["scenario"], "Scenario must have personaId field"
            # personaId can be null, but the field must exist


async def test_get_attempt_full_data_chats_have_completed_at(
    db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test that chats include completedAt field."""
    # Get an attempt with completed chats
    attempt_id = await db.fetchval(
        """
        SELECT sa.id 
        FROM simulation_attempts sa
        JOIN simulation_chats sc ON sc.attempt_id = sa.id
        WHERE sc.completed = true
        ORDER BY sa.created_at DESC 
        LIMIT 1
        """
    )
    
    if not attempt_id:
        pytest.skip("No attempts with completed chats found in database")
    
    result = await get_attempt_full_data(db, str(attempt_id))
    
    # Assert chats exist
    assert len(result["chats"]) > 0, "Should have at least one chat"
    
    for chat in result["chats"]:
        assert "chat" in chat
        assert "completed" in chat["chat"]
        assert "completedAt" in chat["chat"], "Chat must have completedAt field"
        
        # If chat is completed and has a grade, completedAt should be set
        if chat["chat"]["completed"] and chat.get("grade"):
            assert chat["chat"]["completedAt"] is not None, \
                "Completed chat with grade should have completedAt timestamp"


async def test_get_attempt_full_data_timer_uses_grade_time_taken(
    db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test that timer calculation uses grade's time_taken when available."""
    # Get an attempt with graded chats
    attempt_id = await db.fetchval(
        """
        SELECT sa.id 
        FROM simulation_attempts sa
        JOIN simulation_chats sc ON sc.attempt_id = sa.id
        JOIN simulation_chat_grades scg ON scg.simulation_chat_id = sc.id
        WHERE sc.completed = true
        ORDER BY sa.created_at DESC 
        LIMIT 1
        """
    )
    
    if not attempt_id:
        pytest.skip("No attempts with graded chats found in database")
    
    result = await get_attempt_full_data(db, str(attempt_id))
    
    # Assert timer structure
    assert "timer" in result
    assert "elapsed" in result["timer"]
    assert "remaining" in result["timer"]
    assert "expired" in result["timer"]
    
    # Timer elapsed should be a positive number if there are completed chats
    if any(chat["chat"]["completed"] for chat in result["chats"]):
        assert result["timer"]["elapsed"] > 0, \
            "Timer elapsed should be positive for attempts with completed chats"


async def test_get_attempt_full_data_not_found(
    db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test that get_attempt_full_data raises ValueError for non-existent attempt."""
    fake_id = "00000000-0000-0000-0000-000000000000"
    
    with pytest.raises(ValueError, match="not found"):
        await get_attempt_full_data(db, fake_id)


async def test_get_attempt_full_data_includes_rubric_structure(
    db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test that rubric structure is included when simulation has a rubric."""
    # Get an attempt with a simulation that has a rubric
    attempt_id = await db.fetchval(
        """
        SELECT sa.id 
        FROM simulation_attempts sa
        JOIN simulations s ON s.id = sa.simulation_id
        WHERE s.rubric_id IS NOT NULL
        ORDER BY sa.created_at DESC 
        LIMIT 1
        """
    )
    
    if not attempt_id:
        pytest.skip("No attempts with rubric found in database")
    
    result = await get_attempt_full_data(db, str(attempt_id))
    
    # If simulation has a rubric, structure should be present
    if result["simulation"]["rubricId"]:
        assert result["rubricStructure"] is not None, \
            "Rubric structure should be present when simulation has rubric"
        
        if result["rubricStructure"]:
            assert "standardGroups" in result["rubricStructure"]
            assert "standardGroupsMapping" in result["rubricStructure"]
            assert "standardsMapping" in result["rubricStructure"]

