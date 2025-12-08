"""Integration tests for POST /api/v3/home/history endpoint.

This test file verifies that the new separate history endpoint produces identical
results to the old embedded history implementation when using the same filter parameters.

Key verification points:
1. Default behavior (simulationFilters = None) matches old behavior (general only)
2. All filter combinations work correctly
3. Parameter mapping matches SQL expectations ($1-$16)
4. Role-based filtering works correctly (TA vs instructional/admin)
"""

from datetime import datetime, timedelta

import asyncpg  # type: ignore
import httpx
import pytest
from tests.seed_helpers import (
    get_cs_dept_id,  # type: ignore
    )

pytestmark = pytest.mark.asyncio


# ============================================================================
# Helper Functions
# ============================================================================


async def _create_test_profile(
    db: asyncpg.Connection,
    role: str = "ta",
    first_name: str = "Test",
    last_name: str = "User",
    email: str | None = None,
) -> str:
    """Create a test profile."""
    test_email = email or f"test_{role}_{datetime.now().timestamp()}@purdue.edu"
    profile_id = await db.fetchval(
        "INSERT INTO profiles(first_name, last_name, role, active) "
        "VALUES ($1, $2, $3, true) RETURNING id",
        first_name,
        last_name,
        role,
    )
    # Insert email into profile_emails
    await db.execute(
        "INSERT INTO profile_emails(profile_id, email, is_primary, active) "
        "VALUES ($1, $2, true, true)",
        profile_id,
        test_email,
    )
    return str(profile_id)


async def _create_test_cohort(
    db: asyncpg.Connection,
    title: str = "Test Cohort",
) -> str:
    """Create a test cohort."""
    cohort_id = await db.fetchval(
        "INSERT INTO cohorts(title, active) VALUES ($1, true) RETURNING id",
        title,
    )
    return str(cohort_id)


async def _create_test_simulation(
    db: asyncpg.Connection,
    title: str = "Test Simulation",
    practice_simulation: bool = False,
    department_id: str | None = None,
) -> str:
    """Create a test simulation."""
    rubric_id = await db.fetchval("SELECT id FROM rubrics LIMIT 1")
    if not rubric_id:
        rubric_id = await db.fetchval(
            "INSERT INTO rubrics(name, description, points, pass_points, active) "
            "VALUES ('Test Rubric', 'Test', 100, 70, true) RETURNING id"
        )

    simulation_id = await db.fetchval(
        "INSERT INTO simulations(title, description, rubric_id, active, practice_simulation) "
        "VALUES ($1, 'Test Description', $2, true, $3) RETURNING id",
        title,
        rubric_id,
        practice_simulation,
    )

    if department_id:
        await db.execute(
            "INSERT INTO simulation_departments(simulation_id, department_id, active) "
            "VALUES ($1, $2, true)",
            simulation_id,
            department_id,
        )

    return str(simulation_id)


async def _create_test_attempt(
    db: asyncpg.Connection,
    simulation_id: str,
    profile_id: str,
    created_at: datetime | None = None,
    archived: bool = False,
    infinite_mode: bool = False,
) -> str:
    """Create a test simulation attempt."""
    if created_at is None:
        created_at = datetime.now()

    attempt_id = await db.fetchval(
        "INSERT INTO simulation_attempts(simulation_id, created_at, archived, infinite_mode) "
        "VALUES ($1, $2, $3, $4) RETURNING id",
        simulation_id,
        created_at,
        archived,
        infinite_mode,
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
    attempt_id: str,
    scenario_id: str | None = None,
    completed: bool = False,
) -> str:
    """Create a test simulation chat."""
    if scenario_id is None:
        # Create a simple scenario
        scenario_id = await db.fetchval(
            "INSERT INTO scenarios(name, active) VALUES ('Test Scenario', true) RETURNING id"
        )
        await db.execute(
            "INSERT INTO scenario_tree(parent_id, child_id, active) VALUES ($1, $1, true)",
            scenario_id,
        )

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

    return str(chat_id)


async def _link_profile_to_cohort(
    db: asyncpg.Connection,
    profile_id: str,
    cohort_id: str,
) -> None:
    """Link a profile to a cohort."""
    await db.execute(
        "INSERT INTO cohort_profiles(profile_id, cohort_id, active) "
        "VALUES ($1, $2, true)",
        profile_id,
        cohort_id,
    )


async def _link_cohort_to_simulation(
    db: asyncpg.Connection,
    cohort_id: str,
    simulation_id: str,
) -> None:
    """Link a cohort to a simulation."""
    await db.execute(
        "INSERT INTO cohort_simulations(cohort_id, simulation_id, active) "
        "VALUES ($1, $2, true)",
        cohort_id,
        simulation_id,
    )


# ============================================================================
# Basic Filtering Tests (matches old behavior)
# ============================================================================


async def test_history_with_user_provided_filters(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test history endpoint with exact filters from user's example."""
    # Create test data
    dept_id = await get_cs_dept_id(db)
    # Use TA role so profileId filtering works (instructional would set it to None)
    profile_id = await _create_test_profile(db, role="ta")
    cohort_id = await _create_test_cohort(db, "Test Cohort")
    simulation_id = await _create_test_simulation(
        db, "Test Simulation", department_id=dept_id
    )

    # Link profile to cohort (required for cohort filtering)
    await _link_profile_to_cohort(db, profile_id, cohort_id)
    await _link_cohort_to_simulation(db, cohort_id, simulation_id)

    # Create attempt within date range
    start_date = datetime(2025, 8, 1, 0, 0, 0)
    end_date = datetime(2025, 11, 1, 23, 59, 59)
    attempt_date = datetime(2025, 9, 15, 12, 0, 0)
    attempt_id = await _create_test_attempt(
        db, simulation_id, profile_id, created_at=attempt_date
    )

    # Create a chat
    await _create_test_chat(db, attempt_id, completed=True)

    # Call API with user's exact filters
    response = await client.post(
        "/api/v3/home/history",
        json={
            "startDate": "2025-08-01T00:00:00Z",
            "endDate": "2025-11-01T23:59:59Z",
            "cohortIds": [cohort_id],
            "roles": ["guest", "ta", "instructional", "admin", "superadmin"],
            "simulationFilters": ["general", "practice", "archived"],
            "profileId": profile_id,
            "departmentIds": [dept_id],
            "page": 0,
            "pageSize": 20,
        },
    )

    if response.status_code != 200:
        print(f"Error response: {response.status_code} - {response.text}")
    assert response.status_code == 200
    data = response.json()

    assert "data" in data
    assert "totalCount" in data
    assert "page" in data
    assert "pageSize" in data
    assert "totalPages" in data

    # Should find the attempt we created
    assert data["totalCount"] >= 1
    assert len(data["data"]) >= 1

    # Verify attempt data structure
    attempt = data["data"][0]
    assert attempt["attemptId"] == attempt_id
    assert attempt["simulation_id"] == simulation_id
    assert attempt["profileId"] == profile_id


async def test_history_default_simulation_filters_matches_old_behavior(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test that default simulationFilters (None) matches old behavior (general only).

    Old behavior: sim.practice_simulation = FALSE (hardcoded)
    New behavior: simulationFilters = None → defaults to ["general"] → practice_simulation = FALSE
    """
    profile_id = await _create_test_profile(db, role="ta")
    dept_id = await get_cs_dept_id(db)

    # Create general simulation (practice_simulation = FALSE)
    general_sim_id = await _create_test_simulation(
        db, "General Simulation", practice_simulation=False, department_id=dept_id
    )
    # Create practice simulation (practice_simulation = TRUE)
    practice_sim_id = await _create_test_simulation(
        db, "Practice Simulation", practice_simulation=True, department_id=dept_id
    )

    # Create attempts for both
    attempt_date = datetime.now() - timedelta(days=5)
    general_attempt_id = await _create_test_attempt(
        db, general_sim_id, profile_id, created_at=attempt_date
    )
    practice_attempt_id = await _create_test_attempt(
        db, practice_sim_id, profile_id, created_at=attempt_date
    )

    await _create_test_chat(db, general_attempt_id, completed=True)
    await _create_test_chat(db, practice_attempt_id, completed=True)

    # Call API with simulationFilters omitted (should default to ["general"])
    start_date = (datetime.now() - timedelta(days=30)).isoformat() + "Z"
    end_date = datetime.now().isoformat() + "Z"

    response = await client.post(
        "/api/v3/home/history",
        json={
            "startDate": start_date,
            "endDate": end_date,
            "cohortIds": [],
            "roles": ["ta"],
            # simulationFilters omitted - should default to ["general"]
            "profileId": profile_id,
            "departmentIds": [dept_id],
            "page": 0,
            "pageSize": 20,
        },
    )

    if response.status_code != 200:
        print(f"Error response: {response.status_code} - {response.text}")
    assert response.status_code == 200
    data = response.json()

    # Should only find general simulation attempt (matching old behavior)
    attempt_ids = [a["attemptId"] for a in data["data"]]
    assert general_attempt_id in attempt_ids
    assert practice_attempt_id not in attempt_ids


async def test_history_explicit_general_filter(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test that explicit simulationFilters = ["general"] works correctly."""
    profile_id = await _create_test_profile(db, role="ta")
    dept_id = await get_cs_dept_id(db)

    general_sim_id = await _create_test_simulation(
        db, "General Simulation", practice_simulation=False, department_id=dept_id
    )
    practice_sim_id = await _create_test_simulation(
        db, "Practice Simulation", practice_simulation=True, department_id=dept_id
    )

    attempt_date = datetime.now() - timedelta(days=5)
    general_attempt_id = await _create_test_attempt(
        db, general_sim_id, profile_id, created_at=attempt_date
    )
    practice_attempt_id = await _create_test_attempt(
        db, practice_sim_id, profile_id, created_at=attempt_date
    )

    await _create_test_chat(db, general_attempt_id, completed=True)
    await _create_test_chat(db, practice_attempt_id, completed=True)

    start_date = (datetime.now() - timedelta(days=30)).isoformat() + "Z"
    end_date = datetime.now().isoformat() + "Z"

    response = await client.post(
        "/api/v3/home/history",
        json={
            "startDate": start_date,
            "endDate": end_date,
            "cohortIds": [],
            "roles": ["ta"],
            "simulationFilters": ["general"],  # Explicit general filter
            "profileId": profile_id,
            "departmentIds": [dept_id],
            "page": 0,
            "pageSize": 20,
        },
    )

    if response.status_code != 200:
        print(f"Error response: {response.status_code} - {response.text}")
    assert response.status_code == 200
    data = response.json()

    attempt_ids = [a["attemptId"] for a in data["data"]]
    assert general_attempt_id in attempt_ids
    assert practice_attempt_id not in attempt_ids


# ============================================================================
# Extended Filtering Tests (new features)
# ============================================================================


async def test_history_practice_filter(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test simulationFilters = ["practice"]."""
    profile_id = await _create_test_profile(db, role="ta")
    dept_id = await get_cs_dept_id(db)

    general_sim_id = await _create_test_simulation(
        db, "General Simulation", practice_simulation=False, department_id=dept_id
    )
    practice_sim_id = await _create_test_simulation(
        db, "Practice Simulation", practice_simulation=True, department_id=dept_id
    )

    attempt_date = datetime.now() - timedelta(days=5)
    general_attempt_id = await _create_test_attempt(
        db, general_sim_id, profile_id, created_at=attempt_date
    )
    practice_attempt_id = await _create_test_attempt(
        db, practice_sim_id, profile_id, created_at=attempt_date
    )

    await _create_test_chat(db, general_attempt_id, completed=True)
    await _create_test_chat(db, practice_attempt_id, completed=True)

    start_date = (datetime.now() - timedelta(days=30)).isoformat() + "Z"
    end_date = datetime.now().isoformat() + "Z"

    response = await client.post(
        "/api/v3/home/history",
        json={
            "startDate": start_date,
            "endDate": end_date,
            "cohortIds": [],
            "roles": ["ta"],
            "simulationFilters": ["practice"],
            "profileId": profile_id,
            "departmentIds": [dept_id],
            "page": 0,
            "pageSize": 20,
        },
    )

    assert response.status_code == 200
    data = response.json()

    attempt_ids = [a["attemptId"] for a in data["data"]]
    assert general_attempt_id not in attempt_ids
    assert practice_attempt_id in attempt_ids


async def test_history_archived_filter(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test simulationFilters = ["archived"]."""
    profile_id = await _create_test_profile(db, role="ta")
    dept_id = await get_cs_dept_id(db)

    sim_id = await _create_test_simulation(db, "Test Simulation", department_id=dept_id)

    attempt_date = datetime.now() - timedelta(days=5)
    archived_attempt_id = await _create_test_attempt(
        db, sim_id, profile_id, created_at=attempt_date, archived=True
    )
    active_attempt_id = await _create_test_attempt(
        db, sim_id, profile_id, created_at=attempt_date, archived=False
    )

    await _create_test_chat(db, archived_attempt_id, completed=True)
    await _create_test_chat(db, active_attempt_id, completed=True)

    start_date = (datetime.now() - timedelta(days=30)).isoformat() + "Z"
    end_date = datetime.now().isoformat() + "Z"

    response = await client.post(
        "/api/v3/home/history",
        json={
            "startDate": start_date,
            "endDate": end_date,
            "cohortIds": [],
            "roles": ["ta"],
            "simulationFilters": ["archived"],
            "profileId": profile_id,
            "departmentIds": [dept_id],
            "page": 0,
            "pageSize": 20,
        },
    )

    assert response.status_code == 200
    data = response.json()

    attempt_ids = [a["attemptId"] for a in data["data"]]
    assert archived_attempt_id in attempt_ids
    assert active_attempt_id not in attempt_ids


async def test_history_combined_simulation_filters(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test simulationFilters = ["general", "practice", "archived"]."""
    profile_id = await _create_test_profile(db, role="ta")
    dept_id = await get_cs_dept_id(db)

    general_sim_id = await _create_test_simulation(
        db, "General Simulation", practice_simulation=False, department_id=dept_id
    )
    practice_sim_id = await _create_test_simulation(
        db, "Practice Simulation", practice_simulation=True, department_id=dept_id
    )

    attempt_date = datetime.now() - timedelta(days=5)
    general_attempt_id = await _create_test_attempt(
        db, general_sim_id, profile_id, created_at=attempt_date, archived=False
    )
    practice_attempt_id = await _create_test_attempt(
        db, practice_sim_id, profile_id, created_at=attempt_date, archived=False
    )
    archived_attempt_id = await _create_test_attempt(
        db, general_sim_id, profile_id, created_at=attempt_date, archived=True
    )

    await _create_test_chat(db, general_attempt_id, completed=True)
    await _create_test_chat(db, practice_attempt_id, completed=True)
    await _create_test_chat(db, archived_attempt_id, completed=True)

    start_date = (datetime.now() - timedelta(days=30)).isoformat() + "Z"
    end_date = datetime.now().isoformat() + "Z"

    response = await client.post(
        "/api/v3/home/history",
        json={
            "startDate": start_date,
            "endDate": end_date,
            "cohortIds": [],
            "roles": ["ta"],
            "simulationFilters": ["general", "practice", "archived"],
            "profileId": profile_id,
            "departmentIds": [dept_id],
            "page": 0,
            "pageSize": 20,
        },
    )

    assert response.status_code == 200
    data = response.json()

    attempt_ids = [a["attemptId"] for a in data["data"]]
    assert general_attempt_id in attempt_ids
    assert practice_attempt_id in attempt_ids
    assert archived_attempt_id in attempt_ids


async def test_history_search_filter(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test search functionality (searches profile name, simulation name, persona names)."""
    profile1_id = await _create_test_profile(
        db, role="ta", first_name="John", last_name="Doe"
    )
    profile2_id = await _create_test_profile(
        db, role="ta", first_name="Jane", last_name="Smith"
    )
    dept_id = await get_cs_dept_id(db)

    sim1_id = await _create_test_simulation(
        db, "Math Simulation", department_id=dept_id
    )
    sim2_id = await _create_test_simulation(
        db, "Science Simulation", department_id=dept_id
    )

    # Link profiles to cohorts for proper filtering
    cohort1_id = await _create_test_cohort(db, "Cohort 1")
    cohort2_id = await _create_test_cohort(db, "Cohort 2")
    await _link_profile_to_cohort(db, profile1_id, cohort1_id)
    await _link_profile_to_cohort(db, profile2_id, cohort2_id)
    await _link_cohort_to_simulation(db, cohort1_id, sim1_id)
    await _link_cohort_to_simulation(db, cohort2_id, sim2_id)

    attempt_date = datetime.now() - timedelta(days=5)
    attempt1_id = await _create_test_attempt(
        db, sim1_id, profile1_id, created_at=attempt_date
    )
    attempt2_id = await _create_test_attempt(
        db, sim2_id, profile2_id, created_at=attempt_date
    )

    await _create_test_chat(db, attempt1_id, completed=True)
    await _create_test_chat(db, attempt2_id, completed=True)

    start_date = (datetime.now() - timedelta(days=30)).isoformat() + "Z"
    end_date = datetime.now().isoformat() + "Z"

    # Search for "John" (profile name) - use instructional role to see all attempts
    response = await client.post(
        "/api/v3/home/history",
        json={
            "startDate": start_date,
            "endDate": end_date,
            "cohortIds": [cohort1_id, cohort2_id],  # Include both cohorts
            "roles": ["instructional", "ta"],  # Instructional to see all
            "simulationFilters": ["general"],
            "profileId": None,  # Don't filter by profileId to see both
            "departmentIds": [dept_id],
            "search": "John",
            "page": 0,
            "pageSize": 20,
        },
    )

    if response.status_code != 200:
        print(f"Error response: {response.status_code} - {response.text}")
    assert response.status_code == 200
    data = response.json()

    attempt_ids = [a["attemptId"] for a in data["data"]]
    assert attempt1_id in attempt_ids
    assert attempt2_id not in attempt_ids

    # Search for "Math" (simulation name)
    response = await client.post(
        "/api/v3/home/history",
        json={
            "startDate": start_date,
            "endDate": end_date,
            "cohortIds": [],
            "roles": ["ta"],
            "simulationFilters": ["general"],
            "profileId": None,
            "departmentIds": [dept_id],
            "search": "Math",
            "page": 0,
            "pageSize": 20,
        },
    )

    assert response.status_code == 200
    data = response.json()

    attempt_ids = [a["attemptId"] for a in data["data"]]
    assert attempt1_id in attempt_ids
    assert attempt2_id not in attempt_ids


async def test_history_profile_ids_filter(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test profileIds filter."""
    profile1_id = await _create_test_profile(db, role="ta")
    profile2_id = await _create_test_profile(db, role="ta")
    dept_id = await get_cs_dept_id(db)

    sim_id = await _create_test_simulation(db, "Test Simulation", department_id=dept_id)

    # Link profiles to cohorts for proper filtering
    cohort1_id = await _create_test_cohort(db, "Cohort 1")
    cohort2_id = await _create_test_cohort(db, "Cohort 2")
    await _link_profile_to_cohort(db, profile1_id, cohort1_id)
    await _link_profile_to_cohort(db, profile2_id, cohort2_id)
    await _link_cohort_to_simulation(db, cohort1_id, sim_id)
    await _link_cohort_to_simulation(db, cohort2_id, sim_id)

    attempt_date = datetime.now() - timedelta(days=5)
    attempt1_id = await _create_test_attempt(
        db, sim_id, profile1_id, created_at=attempt_date
    )
    attempt2_id = await _create_test_attempt(
        db, sim_id, profile2_id, created_at=attempt_date
    )

    await _create_test_chat(db, attempt1_id, completed=True)
    await _create_test_chat(db, attempt2_id, completed=True)

    start_date = (datetime.now() - timedelta(days=30)).isoformat() + "Z"
    end_date = datetime.now().isoformat() + "Z"

    response = await client.post(
        "/api/v3/home/history",
        json={
            "startDate": start_date,
            "endDate": end_date,
            "cohortIds": [cohort1_id, cohort2_id],  # Include both cohorts
            "roles": ["instructional", "ta"],  # Instructional to see all
            "simulationFilters": ["general"],
            "profileId": None,  # Don't filter by profileId
            "departmentIds": [dept_id],
            "profileIds": [profile1_id],  # Filter by profileIds
            "page": 0,
            "pageSize": 20,
        },
    )

    if response.status_code != 200:
        print(f"Error response: {response.status_code} - {response.text}")
    assert response.status_code == 200
    data = response.json()

    attempt_ids = [a["attemptId"] for a in data["data"]]
    assert attempt1_id in attempt_ids
    assert attempt2_id not in attempt_ids


async def test_history_simulation_ids_filter(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test simulationIds filter."""
    profile_id = await _create_test_profile(db, role="ta")
    dept_id = await get_cs_dept_id(db)

    sim1_id = await _create_test_simulation(db, "Simulation 1", department_id=dept_id)
    sim2_id = await _create_test_simulation(db, "Simulation 2", department_id=dept_id)

    attempt_date = datetime.now() - timedelta(days=5)
    attempt1_id = await _create_test_attempt(
        db, sim1_id, profile_id, created_at=attempt_date
    )
    attempt2_id = await _create_test_attempt(
        db, sim2_id, profile_id, created_at=attempt_date
    )

    await _create_test_chat(db, attempt1_id, completed=True)
    await _create_test_chat(db, attempt2_id, completed=True)

    start_date = (datetime.now() - timedelta(days=30)).isoformat() + "Z"
    end_date = datetime.now().isoformat() + "Z"

    response = await client.post(
        "/api/v3/home/history",
        json={
            "startDate": start_date,
            "endDate": end_date,
            "cohortIds": [],
            "roles": ["ta"],
            "simulationFilters": ["general"],
            "profileId": profile_id,
            "departmentIds": [dept_id],
            "simulationIds": [sim1_id],  # Filter by simulationIds
            "page": 0,
            "pageSize": 20,
        },
    )

    assert response.status_code == 200
    data = response.json()

    attempt_ids = [a["attemptId"] for a in data["data"]]
    assert attempt1_id in attempt_ids
    assert attempt2_id not in attempt_ids


async def test_history_infinite_mode_filter(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test infiniteMode filter."""
    profile_id = await _create_test_profile(db, role="ta")
    dept_id = await get_cs_dept_id(db)

    sim_id = await _create_test_simulation(db, "Test Simulation", department_id=dept_id)

    attempt_date = datetime.now() - timedelta(days=5)
    infinite_attempt_id = await _create_test_attempt(
        db, sim_id, profile_id, created_at=attempt_date, infinite_mode=True
    )
    normal_attempt_id = await _create_test_attempt(
        db, sim_id, profile_id, created_at=attempt_date, infinite_mode=False
    )

    await _create_test_chat(db, infinite_attempt_id, completed=True)
    await _create_test_chat(db, normal_attempt_id, completed=True)

    start_date = (datetime.now() - timedelta(days=30)).isoformat() + "Z"
    end_date = datetime.now().isoformat() + "Z"

    response = await client.post(
        "/api/v3/home/history",
        json={
            "startDate": start_date,
            "endDate": end_date,
            "cohortIds": [],
            "roles": ["ta"],
            "simulationFilters": ["general"],
            "profileId": profile_id,
            "departmentIds": [dept_id],
            "infiniteMode": True,  # Filter by infiniteMode
            "page": 0,
            "pageSize": 20,
        },
    )

    assert response.status_code == 200
    data = response.json()

    attempt_ids = [a["attemptId"] for a in data["data"]]
    assert infinite_attempt_id in attempt_ids
    assert normal_attempt_id not in attempt_ids


async def test_history_sorting(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test sorting (date, simulationName, score)."""
    profile_id = await _create_test_profile(db, role="ta")
    dept_id = await get_cs_dept_id(db)

    sim1_id = await _create_test_simulation(db, "A Simulation", department_id=dept_id)
    sim2_id = await _create_test_simulation(db, "Z Simulation", department_id=dept_id)

    # Link profile to cohorts for proper filtering
    cohort_id = await _create_test_cohort(db, "Test Cohort")
    await _link_profile_to_cohort(db, profile_id, cohort_id)
    await _link_cohort_to_simulation(db, cohort_id, sim1_id)
    await _link_cohort_to_simulation(db, cohort_id, sim2_id)

    attempt_date1 = datetime.now() - timedelta(days=10)
    attempt_date2 = datetime.now() - timedelta(days=5)
    attempt1_id = await _create_test_attempt(
        db, sim1_id, profile_id, created_at=attempt_date1
    )
    attempt2_id = await _create_test_attempt(
        db, sim2_id, profile_id, created_at=attempt_date2
    )

    await _create_test_chat(db, attempt1_id, completed=True)
    await _create_test_chat(db, attempt2_id, completed=True)

    start_date = (datetime.now() - timedelta(days=30)).isoformat() + "Z"
    end_date = datetime.now().isoformat() + "Z"

    # Test sorting by date (desc)
    response = await client.post(
        "/api/v3/home/history",
        json={
            "startDate": start_date,
            "endDate": end_date,
            "cohortIds": [],
            "roles": ["ta"],
            "simulationFilters": ["general"],
            "profileId": profile_id,
            "departmentIds": [dept_id],
            "sortBy": "date",
            "sortOrder": "desc",
            "page": 0,
            "pageSize": 20,
        },
    )

    if response.status_code != 200:
        print(f"Error response: {response.status_code} - {response.text}")
    assert response.status_code == 200
    data = response.json()

    # Most recent should be first
    assert len(data["data"]) >= 2
    assert data["data"][0]["attemptId"] == attempt2_id  # More recent
    assert data["data"][1]["attemptId"] == attempt1_id  # Older

    # Test sorting by simulationName (asc)
    response = await client.post(
        "/api/v3/home/history",
        json={
            "startDate": start_date,
            "endDate": end_date,
            "cohortIds": [],
            "roles": ["ta"],
            "simulationFilters": ["general"],
            "profileId": profile_id,
            "departmentIds": [dept_id],
            "sortBy": "simulationName",
            "sortOrder": "asc",
            "page": 0,
            "pageSize": 20,
        },
    )

    assert response.status_code == 200
    data = response.json()

    # "A Simulation" should come before "Z Simulation"
    assert len(data["data"]) >= 2
    assert data["data"][0]["simulationName"] == "A Simulation"
    assert data["data"][1]["simulationName"] == "Z Simulation"


async def test_history_pagination(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test pagination."""
    profile_id = await _create_test_profile(db, role="ta")
    dept_id = await get_cs_dept_id(db)

    sim_id = await _create_test_simulation(db, "Test Simulation", department_id=dept_id)

    # Link profile to cohort for proper filtering
    cohort_id = await _create_test_cohort(db, "Test Cohort")
    await _link_profile_to_cohort(db, profile_id, cohort_id)
    await _link_cohort_to_simulation(db, cohort_id, sim_id)

    # Create multiple attempts
    attempt_ids = []
    for i in range(5):
        attempt_date = datetime.now() - timedelta(days=i)
        attempt_id = await _create_test_attempt(
            db, sim_id, profile_id, created_at=attempt_date
        )
        await _create_test_chat(db, attempt_id, completed=True)
        attempt_ids.append(attempt_id)

    start_date = (datetime.now() - timedelta(days=30)).isoformat() + "Z"
    end_date = datetime.now().isoformat() + "Z"

    # Test first page
    response = await client.post(
        "/api/v3/home/history",
        json={
            "startDate": start_date,
            "endDate": end_date,
            "cohortIds": [],
            "roles": ["ta"],
            "simulationFilters": ["general"],
            "profileId": profile_id,
            "departmentIds": [dept_id],
            "page": 0,
            "pageSize": 2,
        },
    )

    if response.status_code != 200:
        print(f"Error response: {response.status_code} - {response.text}")
    assert response.status_code == 200
    data = response.json()

    assert data["page"] == 0
    assert data["pageSize"] == 2
    assert data["totalCount"] >= 5
    assert len(data["data"]) == 2

    # Test second page
    response = await client.post(
        "/api/v3/home/history",
        json={
            "startDate": start_date,
            "endDate": end_date,
            "cohortIds": [],
            "roles": ["ta"],
            "simulationFilters": ["general"],
            "profileId": profile_id,
            "departmentIds": [dept_id],
            "page": 1,
            "pageSize": 2,
        },
    )

    assert response.status_code == 200
    data = response.json()

    assert data["page"] == 1
    assert data["pageSize"] == 2
    assert len(data["data"]) == 2


# ============================================================================
# Edge Cases
# ============================================================================


async def test_history_empty_cohort_ids(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test with empty cohortIds array."""
    profile_id = await _create_test_profile(db, role="ta")
    dept_id = await get_cs_dept_id(db)

    sim_id = await _create_test_simulation(db, "Test Simulation", department_id=dept_id)
    # Link profile to a cohort so cohort expansion works
    cohort_id = await _create_test_cohort(db, "Test Cohort")
    await _link_profile_to_cohort(db, profile_id, cohort_id)
    await _link_cohort_to_simulation(db, cohort_id, sim_id)

    attempt_id = await _create_test_attempt(db, sim_id, profile_id)
    await _create_test_chat(db, attempt_id, completed=True)

    start_date = (datetime.now() - timedelta(days=30)).isoformat() + "Z"
    end_date = datetime.now().isoformat() + "Z"

    response = await client.post(
        "/api/v3/home/history",
        json={
            "startDate": start_date,
            "endDate": end_date,
            "cohortIds": [],  # Empty array - should expand to profile's cohorts
            "roles": ["ta"],
            "simulationFilters": ["general"],
            "profileId": profile_id,
            "departmentIds": [dept_id],
            "page": 0,
            "pageSize": 20,
        },
    )

    if response.status_code != 200:
        print(f"Error response: {response.status_code} - {response.text}")
    assert response.status_code == 200
    data = response.json()

    # Should still find attempts (empty cohortIds expands to profile's cohorts)
    assert data["totalCount"] >= 1


async def test_history_empty_department_ids(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test with empty departmentIds array."""
    profile_id = await _create_test_profile(db, role="ta")
    dept_id = await get_cs_dept_id(db)

    sim_id = await _create_test_simulation(db, "Test Simulation", department_id=dept_id)
    # Link profile to a cohort so cohort expansion works
    cohort_id = await _create_test_cohort(db, "Test Cohort")
    await _link_profile_to_cohort(db, profile_id, cohort_id)
    await _link_cohort_to_simulation(db, cohort_id, sim_id)

    attempt_id = await _create_test_attempt(db, sim_id, profile_id)
    await _create_test_chat(db, attempt_id, completed=True)

    start_date = (datetime.now() - timedelta(days=30)).isoformat() + "Z"
    end_date = datetime.now().isoformat() + "Z"

    response = await client.post(
        "/api/v3/home/history",
        json={
            "startDate": start_date,
            "endDate": end_date,
            "cohortIds": [],
            "roles": ["ta"],
            "simulationFilters": ["general"],
            "profileId": profile_id,
            "departmentIds": [],  # Empty array - should not filter by department
            "page": 0,
            "pageSize": 20,
        },
    )

    if response.status_code != 200:
        print(f"Error response: {response.status_code} - {response.text}")
    assert response.status_code == 200
    data = response.json()

    # Should still find attempts (empty departmentIds means no department filtering)
    assert data["totalCount"] >= 1


async def test_history_role_based_filtering_ta(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test that TA role only sees their own attempts."""
    ta_profile_id = await _create_test_profile(db, role="ta")
    other_ta_profile_id = await _create_test_profile(db, role="ta")
    dept_id = await get_cs_dept_id(db)

    sim_id = await _create_test_simulation(db, "Test Simulation", department_id=dept_id)

    attempt_date = datetime.now() - timedelta(days=5)
    ta_attempt_id = await _create_test_attempt(
        db, sim_id, ta_profile_id, created_at=attempt_date
    )
    other_attempt_id = await _create_test_attempt(
        db, sim_id, other_ta_profile_id, created_at=attempt_date
    )

    await _create_test_chat(db, ta_attempt_id, completed=True)
    await _create_test_chat(db, other_attempt_id, completed=True)

    start_date = (datetime.now() - timedelta(days=30)).isoformat() + "Z"
    end_date = datetime.now().isoformat() + "Z"

    # TA should only see their own attempts
    response = await client.post(
        "/api/v3/home/history",
        json={
            "startDate": start_date,
            "endDate": end_date,
            "cohortIds": [],
            "roles": ["ta"],
            "simulationFilters": ["general"],
            "profileId": ta_profile_id,  # TA profileId
            "departmentIds": [dept_id],
            "page": 0,
            "pageSize": 20,
        },
    )

    assert response.status_code == 200
    data = response.json()

    attempt_ids = [a["attemptId"] for a in data["data"]]
    assert ta_attempt_id in attempt_ids
    assert other_attempt_id not in attempt_ids


async def test_history_role_based_filtering_instructional(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test that instructional role sees all attempts (profileId ignored)."""
    instructional_profile_id = await _create_test_profile(db, role="instructional")
    ta_profile_id = await _create_test_profile(db, role="ta")
    dept_id = await get_cs_dept_id(db)

    sim_id = await _create_test_simulation(db, "Test Simulation", department_id=dept_id)

    # Link both profiles to cohorts for proper filtering
    cohort1_id = await _create_test_cohort(db, "Cohort 1")
    cohort2_id = await _create_test_cohort(db, "Cohort 2")
    await _link_profile_to_cohort(db, ta_profile_id, cohort1_id)
    await _link_profile_to_cohort(db, instructional_profile_id, cohort2_id)
    await _link_cohort_to_simulation(db, cohort1_id, sim_id)
    await _link_cohort_to_simulation(db, cohort2_id, sim_id)

    attempt_date = datetime.now() - timedelta(days=5)
    ta_attempt_id = await _create_test_attempt(
        db, sim_id, ta_profile_id, created_at=attempt_date
    )
    instructional_attempt_id = await _create_test_attempt(
        db, sim_id, instructional_profile_id, created_at=attempt_date
    )

    await _create_test_chat(db, ta_attempt_id, completed=True)
    await _create_test_chat(db, instructional_attempt_id, completed=True)

    start_date = (datetime.now() - timedelta(days=30)).isoformat() + "Z"
    end_date = datetime.now().isoformat() + "Z"

    # Instructional should see all attempts (profileId is ignored for roles above TA)
    # Include both cohorts so both attempts are visible
    response = await client.post(
        "/api/v3/home/history",
        json={
            "startDate": start_date,
            "endDate": end_date,
            "cohortIds": [cohort1_id, cohort2_id],  # Include both cohorts
            "roles": ["instructional", "ta"],
            "simulationFilters": ["general"],
            "profileId": instructional_profile_id,  # Instructional profileId (should be ignored)
            "departmentIds": [dept_id],
            "page": 0,
            "pageSize": 20,
        },
    )

    if response.status_code != 200:
        print(f"Error response: {response.status_code} - {response.text}")
    assert response.status_code == 200
    data = response.json()

    attempt_ids = [a["attemptId"] for a in data["data"]]
    # Should see both attempts (profileId filtering is ignored for instructional)
    assert ta_attempt_id in attempt_ids
    assert instructional_attempt_id in attempt_ids
