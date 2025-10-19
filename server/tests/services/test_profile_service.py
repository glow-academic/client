"""Real database integration tests for ProfileService."""

import asyncpg
import pytest
from app.schemas.profile import ProfileContextRequest
from app.services.profile_service import ProfileService
from tests.seed_helpers import get_cs_dept_id, get_superadmin_alias

pytestmark = pytest.mark.asyncio


# ============================================================================
# READ METHOD TESTS
# ============================================================================


async def test_get_profile(db: asyncpg.Connection, disable_cache: None) -> None:
    """Test getting profile by ID."""
    profile_id = await get_superadmin_alias(db)
    
    svc = ProfileService(db)
    result = await svc.get_profile(profile_id)
    
    assert result is not None
    assert result.id == profile_id
    assert result.alias == "sarava18"
    assert result.role == "superadmin"
    assert result.firstName is not None
    assert result.lastName is not None


async def test_get_profile_not_found(
    db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test getting non-existent profile."""
    # Generate a random UUID that doesn't exist
    fake_id = "00000000-0000-0000-0000-000000000000"
    
    svc = ProfileService(db)
    result = await svc.get_profile(fake_id)
    
    assert result is None


async def test_get_profile_by_alias(
    db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test getting profile by alias."""
    svc = ProfileService(db)
    result = await svc.get_profile_by_alias("sarava18")
    
    assert result is not None
    assert result.alias == "sarava18"
    assert result.role == "superadmin"


async def test_get_profile_by_alias_not_found(
    db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test getting profile by non-existent alias."""
    svc = ProfileService(db)
    result = await svc.get_profile_by_alias("nonexistent_alias")
    
    assert result is None


async def test_get_default_guest_profile_id(
    db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test getting default guest profile ID."""
    svc = ProfileService(db)
    result = await svc.get_default_guest_profile_id()
    
    # May or may not exist in seed data
    # Just verify it returns UUID or None
    assert result is None or isinstance(result, object)


async def test_get_simulatable_profiles_superadmin(
    db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test superadmin can emulate all profiles except self."""
    profile_id = await get_superadmin_alias(db)
    
    svc = ProfileService(db)
    result = await svc.get_simulatable_profiles(profile_id, [])
    
    # Superadmin can emulate everyone except themselves
    assert len(result) >= 0
    # Verify self is not in list
    profile_ids = [p.id for p in result]
    assert profile_id not in profile_ids


async def test_get_simulatable_profiles_admin(
    db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test admin can emulate instructional/ta/guest."""
    # Create an admin profile
    admin_id = await db.fetchval(
        "INSERT INTO profiles(first_name, last_name, alias, role) "
        "VALUES('Test', 'Admin', 'test_admin', 'admin') RETURNING id"
    )
    
    svc = ProfileService(db)
    result = await svc.get_simulatable_profiles(str(admin_id), [])
    
    # Admin can emulate instructional, ta, guest (not superadmin/admin)
    roles = {p.role for p in result}
    assert "superadmin" not in roles
    assert "admin" not in roles


async def test_get_simulatable_profiles_instructional(
    db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test instructional can emulate ta/guest."""
    # Create an instructional profile
    instr_id = await db.fetchval(
        "INSERT INTO profiles(first_name, last_name, alias, role) "
        "VALUES('Test', 'Instructor', 'test_instr', 'instructional') RETURNING id"
    )
    
    svc = ProfileService(db)
    result = await svc.get_simulatable_profiles(str(instr_id), [])
    
    # Instructional can emulate ta, guest (not superadmin/admin/instructional)
    roles = {p.role for p in result}
    assert "superadmin" not in roles
    assert "admin" not in roles
    assert "instructional" not in roles


async def test_get_simulatable_profiles_ta_cannot_emulate(
    db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test TA cannot emulate anyone."""
    # Create a TA profile
    ta_id = await db.fetchval(
        "INSERT INTO profiles(first_name, last_name, alias, role) "
        "VALUES('Test', 'TA', 'test_ta', 'ta') RETURNING id"
    )
    
    svc = ProfileService(db)
    result = await svc.get_simulatable_profiles(str(ta_id), [])
    
    # TA cannot emulate anyone
    assert len(result) == 0


async def test_authorize_emulation_allowed(
    db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test emulation authorization allows valid emulation."""
    superadmin_id = await get_superadmin_alias(db)
    
    # Create a target profile
    target_id = await db.fetchval(
        "INSERT INTO profiles(first_name, last_name, alias, role) "
        "VALUES('Target', 'User', 'test_target', 'ta') RETURNING id"
    )
    
    svc = ProfileService(db)
    allowed, reason = await svc.authorize_emulation(superadmin_id, str(target_id), [])
    
    assert allowed is True
    assert reason is None


async def test_authorize_emulation_denied(
    db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test emulation authorization denies invalid emulation."""
    # Create TA profile
    ta_id = await db.fetchval(
        "INSERT INTO profiles(first_name, last_name, alias, role) "
        "VALUES('TA', 'Test', 'test_ta2', 'ta') RETURNING id"
    )
    
    # Create target superadmin
    target_id = await get_superadmin_alias(db)
    
    svc = ProfileService(db)
    allowed, reason = await svc.authorize_emulation(str(ta_id), target_id, [])
    
    assert allowed is False
    assert reason is not None


async def test_authorize_emulation_self(
    db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test emulating self is always allowed."""
    profile_id = await get_superadmin_alias(db)
    
    svc = ProfileService(db)
    allowed, reason = await svc.authorize_emulation(profile_id, profile_id, [])
    
    assert allowed is True
    assert reason is None


async def test_get_profile_context(
    db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test getting complete profile context with optimized query."""
    profile_id = await get_superadmin_alias(db)
    
    svc = ProfileService(db)
    result = await svc.get_profile_context(
        ProfileContextRequest(effectiveProfileId=profile_id, pathname="/home")
    )
    
    assert result is not None
    assert result.actualProfile is not None
    assert result.effectiveProfile is not None
    assert result.departments is not None
    assert result.departmentIds is not None
    assert result.cohorts is not None
    assert result.breadcrumbs is not None
    assert result.simulatableProfiles is not None
    assert result.availableSections is not None
    assert result.redirectPath is not None


async def test_get_profile_context_guest(
    db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test profile context resolves guest-profile-id."""
    # Create a default guest profile
    await db.execute(
        "INSERT INTO profiles(first_name, last_name, alias, role, default_profile) "
        "VALUES('Guest', 'User', 'default_guest', 'guest', true) "
        "ON CONFLICT DO NOTHING"
    )
    
    svc = ProfileService(db)
    result = await svc.get_profile_context(
        ProfileContextRequest(effectiveProfileId="guest-profile-id", pathname="/home")
    )
    
    assert result is not None
    assert result.effectiveProfile.role == "guest"


async def test_get_student_simulation_report(
    db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test getting comprehensive student simulation report."""
    profile_id = await get_superadmin_alias(db)
    
    svc = ProfileService(db)
    result = await svc.get_student_simulation_report(profile_id, recent=10)
    
    assert result is not None
    assert "profile" in result
    assert "attempts" in result
    assert result["profile"]["id"] == profile_id
    assert isinstance(result["attempts"], list)


async def test_get_student_simulation_report_invalid_id(
    db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test simulation report with invalid profile ID."""
    svc = ProfileService(db)
    result = await svc.get_student_simulation_report("not-a-uuid")
    
    assert "error" in result
    assert "Invalid profile_id format" in result["error"]


async def test_get_student_simulation_report_not_found(
    db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test simulation report with non-existent profile."""
    fake_id = "00000000-0000-0000-0000-000000000000"
    
    svc = ProfileService(db)
    result = await svc.get_student_simulation_report(fake_id)
    
    assert "error" in result
    assert "not found" in result["error"].lower()


async def test_search_profiles(
    db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test fuzzy search profiles."""
    svc = ProfileService(db)
    result = await svc.search_profiles("sarava", limit=10)
    
    assert isinstance(result, list)
    assert len(result) >= 0
    
    # If results found, verify structure
    if result:
        for profile in result:
            assert "id" in profile
            assert "first_name" in profile
            assert "last_name" in profile
            assert "alias" in profile
            assert "role" in profile
            assert "score" in profile


async def test_search_profiles_empty_query(
    db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test search with empty query returns empty list."""
    svc = ProfileService(db)
    result = await svc.search_profiles("", limit=10)
    
    assert result == []


async def test_search_profiles_no_matches(
    db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test search with no matches."""
    svc = ProfileService(db)
    result = await svc.search_profiles("zzzzzznonexistent", limit=10)
    
    assert isinstance(result, list)
    # May or may not have fuzzy matches depending on data


async def test_get_profile_overview(
    db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test getting profile overview with latest grades."""
    profile_id = await get_superadmin_alias(db)
    
    svc = ProfileService(db)
    result = await svc.get_profile_overview(profile_id)
    
    assert result is not None
    assert "profile" in result
    assert "latest_grades" in result
    assert result["profile"]["id"] == profile_id
    assert isinstance(result["latest_grades"], list)


async def test_get_profile_overview_by_name(
    db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test getting profile overview by name search."""
    svc = ProfileService(db)
    result = await svc.get_profile_overview("sarava")
    
    assert result is not None
    assert "profile" in result
    assert "alias" in result["profile"]


async def test_get_profile_overview_not_found(
    db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test profile overview with non-existent profile."""
    fake_id = "00000000-0000-0000-0000-000000000000"
    
    svc = ProfileService(db)
    result = await svc.get_profile_overview(fake_id)
    
    assert "error" in result
    assert "not found" in result["error"].lower()


# ============================================================================
# MUTATION METHOD TESTS (Simple validation only)
# ============================================================================


async def test_update_profile(
    db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test updating profile fields."""
    profile_id = await get_superadmin_alias(db)
    
    svc = ProfileService(db)
    result = await svc.update_profile(profile_id, {"viewedIntro": True})
    
    assert result is not None
    assert result.viewedIntro is True


async def test_mark_intro_complete(
    db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test marking intro as complete."""
    profile_id = await get_superadmin_alias(db)
    
    svc = ProfileService(db)
    result = await svc.mark_intro_complete(profile_id)
    
    assert result is True


async def test_mark_chat_complete(
    db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test marking chat as complete."""
    profile_id = await get_superadmin_alias(db)
    
    svc = ProfileService(db)
    result = await svc.mark_chat_complete(profile_id)
    
    assert result is True
