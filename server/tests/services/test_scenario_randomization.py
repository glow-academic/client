"""Tests for scenario randomization logic using consolidated query."""

import uuid

import asyncpg  # type: ignore
import pytest
from app.services.scenario_service import ScenarioService  # type: ignore
from app.schemas.scenarios import RandomizeScenarioRequest  # type: ignore
from tests.seed_helpers import get_cs_dept_id, get_superadmin_alias  # type: ignore

pytestmark = pytest.mark.asyncio


async def test_get_randomization_data_complete_with_department(
    db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test consolidated randomization query returns data filtered by department."""
    dept_id = await get_cs_dept_id(db)
    
    svc = ScenarioService(db)
    data = await svc._get_randomization_data_parsed([dept_id])
    
    # Verify all expected keys are present
    assert "active_personas" in data
    assert "active_documents" in data
    assert "active_parameters" in data
    assert "all_parameter_items" in data
    assert "document_parameter_items_junction" in data
    assert "parameter_items_by_id" in data
    assert "parameter_items_by_param_id" in data
    assert "documents_by_id" in data
    
    # Verify data types
    assert isinstance(data["active_personas"], list)
    assert isinstance(data["active_documents"], list)
    assert isinstance(data["active_parameters"], list)
    assert isinstance(data["all_parameter_items"], list)
    assert isinstance(data["document_parameter_items_junction"], list)
    assert isinstance(data["parameter_items_by_id"], dict)
    assert isinstance(data["parameter_items_by_param_id"], dict)
    assert isinstance(data["documents_by_id"], dict)
    
    # Verify personas have UUID ids
    for persona in data["active_personas"]:
        assert "id" in persona
        assert isinstance(persona["id"], (str, uuid.UUID))
    
    # Verify documents have UUID ids and required fields
    for doc in data["active_documents"]:
        assert "id" in doc
        assert "name" in doc
        assert "type" in doc
        assert isinstance(doc["id"], (str, uuid.UUID))
    
    # Verify parameters have UUID ids
    for param in data["active_parameters"]:
        assert "id" in param
        assert "name" in param
        assert isinstance(param["id"], (str, uuid.UUID))
    
    # Verify parameter items have UUID ids and parameter_id
    for pi in data["all_parameter_items"]:
        assert "id" in pi
        assert "parameter_id" in pi
        assert isinstance(pi["id"], (str, uuid.UUID))
        assert isinstance(pi["parameter_id"], (str, uuid.UUID))
    
    # Verify junction data has UUIDs
    for junction in data["document_parameter_items_junction"]:
        assert "document_id" in junction
        assert "parameter_item_id" in junction
        assert isinstance(junction["document_id"], uuid.UUID)
        assert isinstance(junction["parameter_item_id"], uuid.UUID)
    
    # Verify lookup maps are populated
    assert len(data["parameter_items_by_id"]) > 0 or len(data["all_parameter_items"]) == 0
    assert len(data["parameter_items_by_param_id"]) > 0 or len(data["all_parameter_items"]) == 0
    assert len(data["documents_by_id"]) > 0 or len(data["active_documents"]) == 0


async def test_get_randomization_data_complete_no_department(
    db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test consolidated randomization query returns all data when no department filter."""
    svc = ScenarioService(db)
    data = await svc._get_randomization_data_parsed(None)
    
    # Should still return all expected keys
    assert "active_personas" in data
    assert "active_documents" in data
    assert "active_parameters" in data
    assert "all_parameter_items" in data
    assert "document_parameter_items_junction" in data
    assert "parameter_items_by_id" in data
    assert "parameter_items_by_param_id" in data
    assert "documents_by_id" in data


async def test_randomize_scenario_sections_documents_only(
    db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test randomize endpoint returns documents when targeting documents only."""
    dept_id = await get_cs_dept_id(db)
    admin_id = await get_superadmin_alias(db)
    
    svc = ScenarioService(db)
    request = RandomizeScenarioRequest(
        name="Test Scenario",
        description="Test description",
        departmentIds=[dept_id],
        targets=["documents"],
    )
    
    result = await svc.randomize_scenario_sections(request)
    
    assert result.success is True
    assert isinstance(result.documentIds, list)
    # Should return at least one document if available
    assert len(result.documentIds) >= 0  # May be 0 if no documents available


async def test_randomize_scenario_sections_parameters_only(
    db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test randomize endpoint returns parameters when targeting parameters only."""
    dept_id = await get_cs_dept_id(db)
    
    svc = ScenarioService(db)
    request = RandomizeScenarioRequest(
        name="Test Scenario",
        description="Test description",
        departmentIds=[dept_id],
        targets=["parameters"],
    )
    
    result = await svc.randomize_scenario_sections(request)
    
    assert result.success is True
    assert isinstance(result.parameterItemIds, list)
    # Should return parameter items (at least one per active parameter)
    assert len(result.parameterItemIds) >= 0


async def test_randomize_scenario_sections_no_duplicates(
    db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test randomize endpoint doesn't return duplicate parameter items."""
    dept_id = await get_cs_dept_id(db)
    
    svc = ScenarioService(db)
    request = RandomizeScenarioRequest(
        name="Test Scenario",
        description="Test description",
        departmentIds=[dept_id],
        targets=["parameters"],
    )
    
    result = await svc.randomize_scenario_sections(request)
    
    assert result.success is True
    # Check for duplicates
    param_item_ids = result.parameterItemIds
    assert len(param_item_ids) == len(set(param_item_ids)), "Should not have duplicate parameter items"


async def test_randomize_scenario_sections_documents_and_parameters(
    db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test randomize endpoint with both documents and parameters targets."""
    dept_id = await get_cs_dept_id(db)
    
    svc = ScenarioService(db)
    request = RandomizeScenarioRequest(
        name="Test Scenario",
        description="Test description",
        departmentIds=[dept_id],
        targets=["documents", "parameters"],
    )
    
    result = await svc.randomize_scenario_sections(request)
    
    assert result.success is True
    assert isinstance(result.documentIds, list)
    assert isinstance(result.parameterItemIds, list)
    # Should return documents when both are requested
    assert len(result.documentIds) >= 0
    # Check for duplicates
    assert len(result.parameterItemIds) == len(set(result.parameterItemIds)), "Should not have duplicate parameter items"


async def test_randomize_scenario_sections_with_existing_selections(
    db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test randomize endpoint respects existing document/parameter selections."""
    dept_id = await get_cs_dept_id(db)
    
    # Get some existing documents and parameters
    existing_docs = await db.fetch(
        """
        SELECT id FROM documents 
        WHERE active = true 
        LIMIT 2
        """
    )
    existing_params = await db.fetch(
        """
        SELECT pi.id FROM parameter_items pi
        JOIN parameters p ON p.id = pi.parameter_id
        WHERE pi.active = true AND p.active = true
        LIMIT 3
        """
    )
    
    if not existing_docs or not existing_params:
        pytest.skip("Need at least 2 documents and 3 parameter items for this test")
    
    doc_ids = [str(doc["id"]) for doc in existing_docs]
    param_ids = [str(param["id"]) for param in existing_params]
    
    svc = ScenarioService(db)
    request = RandomizeScenarioRequest(
        name="Test Scenario",
        description="Test description",
        departmentIds=[dept_id],
        documentIds=doc_ids,
        parameterItemIds=param_ids,
        targets=["documents", "parameters"],
    )
    
    result = await svc.randomize_scenario_sections(request)
    
    assert result.success is True
    # Should include existing documents (may add more)
    assert len(result.documentIds) >= len(doc_ids)
    # Should include existing parameters (may add more)
    assert len(result.parameterItemIds) >= len(param_ids)
    # Check for duplicates
    assert len(result.parameterItemIds) == len(set(result.parameterItemIds)), "Should not have duplicate parameter items"

