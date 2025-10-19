"""Real database integration tests for DepartmentService."""

import asyncpg  # type: ignore
import pytest
from app.schemas.departments import DepartmentDetailRequest  # type: ignore
from app.schemas.departments import DepartmentsFilters  # type: ignore
from app.services.department_service import DepartmentService  # type: ignore
from tests.seed_helpers import get_cs_dept_id  # type: ignore
from tests.seed_helpers import get_superadmin_alias  # type: ignore

pytestmark = pytest.mark.asyncio


# ============================================================================
# LIST DEPARTMENTS TESTS
# ============================================================================


async def test_get_departments_list_returns_data(
    db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test departments list returns CS department."""
    dept_id = await get_cs_dept_id(db)
    admin_id = await get_superadmin_alias(db)

    svc = DepartmentService(db)
    resp = await svc.get_departments_list(
        DepartmentsFilters(departmentIds=[dept_id], profileId=admin_id)
    )

    assert len(resp.departments) >= 1
    # Should include CS department
    cs_dept = next(
        (d for d in resp.departments if d.title == "Computer Science"), None
    )
    assert cs_dept is not None


async def test_get_departments_list_superadmin_can_edit(
    db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test that superadmin has edit permissions."""
    dept_id = await get_cs_dept_id(db)
    admin_id = await get_superadmin_alias(db)

    svc = DepartmentService(db)
    resp = await svc.get_departments_list(
        DepartmentsFilters(departmentIds=[dept_id], profileId=admin_id)
    )

    # Superadmin should have edit permissions
    for dept in resp.departments:
        assert dept.can_edit is True


# ============================================================================
# GET DEPARTMENT DETAIL TESTS
# ============================================================================


async def test_get_department_detail_success(
    db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test getting department detail with agent roles and mapping."""
    dept_id = await get_cs_dept_id(db)
    admin_id = await get_superadmin_alias(db)

    svc = DepartmentService(db)
    resp = await svc.get_department_detail(
        DepartmentDetailRequest(departmentId=dept_id, profileId=admin_id)
    )

    assert resp.title is not None
    assert resp.agent_roles is not None
    assert resp.valid_agent_ids is not None
    assert resp.agent_mapping is not None
    # Check structure exists (may be empty if no agents in seed data)
    assert isinstance(resp.valid_agent_ids, list)
    assert isinstance(resp.agent_mapping, dict)
    
    # CRITICAL: Verify agent_mapping is populated when valid_agent_ids exist
    if len(resp.valid_agent_ids) > 0:
        assert len(resp.agent_mapping) > 0, "agent_mapping should be populated when department has valid agents"
        first_agent_id = resp.valid_agent_ids[0]
        assert first_agent_id in resp.agent_mapping, f"Agent {first_agent_id} should be in agent_mapping"
        agent_item = resp.agent_mapping[first_agent_id]
        assert hasattr(agent_item, 'name') and len(agent_item.name) > 0, "Agent mapping should have valid name"
        assert hasattr(agent_item, 'description'), "Agent mapping should have description field"


async def test_get_department_detail_has_agent_mappings(
    db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test that agent mapping contains name and description."""
    dept_id = await get_cs_dept_id(db)
    admin_id = await get_superadmin_alias(db)

    svc = DepartmentService(db)
    resp = await svc.get_department_detail(
        DepartmentDetailRequest(departmentId=dept_id, profileId=admin_id)
    )

    # Verify agent mapping structure
    if resp.agent_mapping:
        for agent_id, agent_info in resp.agent_mapping.items():
            assert agent_info.name is not None
            assert agent_info.description is not None


async def test_get_department_detail_invalid_id(
    db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test getting department detail with invalid ID."""
    admin_id = await get_superadmin_alias(db)
    fake_dept_id = "00000000-0000-0000-0000-000000000000"

    svc = DepartmentService(db)
    with pytest.raises(ValueError, match="Department.*not found"):
        await svc.get_department_detail(
            DepartmentDetailRequest(departmentId=fake_dept_id, profileId=admin_id)
        )


# ============================================================================
# GET DEPARTMENT DETAIL DEFAULT TESTS
# ============================================================================


async def test_get_department_detail_default_success(
    db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test getting default department detail for creation mode."""
    admin_id = await get_superadmin_alias(db)

    svc = DepartmentService(db)
    resp = await svc.get_department_detail_default(admin_id)

    assert resp.title == ""
    assert resp.description == ""
    assert resp.active is True
    assert resp.valid_agent_ids is not None
    assert resp.agent_mapping is not None
    
    # CRITICAL: Verify agent_mapping is populated when valid_agent_ids exist
    if len(resp.valid_agent_ids) > 0:
        assert len(resp.agent_mapping) > 0, "agent_mapping should be populated when department has valid agents"
        first_agent_id = resp.valid_agent_ids[0]
        assert first_agent_id in resp.agent_mapping, f"Agent {first_agent_id} should be in agent_mapping"
        agent_item = resp.agent_mapping[first_agent_id]
        assert hasattr(agent_item, 'name') and len(agent_item.name) > 0, "Agent mapping should have valid name"
        assert hasattr(agent_item, 'description'), "Agent mapping should have description field"
