"""Test scenario service document details functionality."""

from typing import Any
from unittest.mock import AsyncMock, MagicMock

import pytest


@pytest.fixture
def mock_conn() -> AsyncMock:
    """Create a mock database connection."""
    return AsyncMock()


@pytest.fixture
def mock_queries() -> MagicMock:
    """Create a mock queries object."""
    return MagicMock()


@pytest.fixture
def scenario_service(mock_conn: AsyncMock, mock_queries: MagicMock) -> Any:
    """Create a scenario service instance with mocked dependencies."""
    from app.services.scenario_service import ScenarioService
    
    service = ScenarioService(mock_conn)
    service.queries = mock_queries
    return service


@pytest.mark.asyncio
async def test_get_scenario_detail_returns_document_details(
    scenario_service: Any, mock_conn: AsyncMock, mock_queries: MagicMock
) -> None:
    """Test that get_scenario_detail returns document_details with all required fields."""
    # Arrange
    scenario_id = "a6d219fa-27a5-444d-9387-76c882cae9a6"
    profile_id = "965bd24f-dfae-4063-b370-e1373df46322"
    
    # Mock query response with document_details
    mock_queries.get_scenario_detail_complete.return_value = (
        "SELECT * FROM ...",
        [scenario_id, profile_id]
    )
    
    mock_scenario_data = {
        "id": scenario_id,
        "name": "Hash Table Confusion Amid the Crowd",
        "problem_statement": "Test problem statement",
        "active": True,
        "default_scenario": False,
        "generated": False,
        "department_id": "c7692d34-b875-5122-af69-074f85981205",
        "parent_scenario_id": None,
        "persona_id": None,
        "document_ids": ["57d963bc-f6f9-4fd4-b7b5-cdb822f4778a"],
        "objective_ids": [],
        "simulation_ids": [],
        "parameters_json": {},
        "valid_persona_ids": [],
        "valid_document_ids": ["57d963bc-f6f9-4fd4-b7b5-cdb822f4778a"],
        "valid_department_ids": ["c7692d34-b875-5122-af69-074f85981205"],
        "active_usage_count": 0,
        "user_role": "admin",
        "objective_mapping": {},
        "persona_mapping": {},
        "document_mapping": {
            "57d963bc-f6f9-4fd4-b7b5-cdb822f4778a": {
                "name": "CS253-PSO6.pdf",
                "description": "homework"
            }
        },
        "simulation_mapping": {},
        "parameter_mapping": {},
        "parameter_item_mapping": {},
        "department_mapping": {
            "c7692d34-b875-5122-af69-074f85981205": {
                "name": "Computer Science",
                "description": ""
            }
        },
        "document_details": [
            {
                "document_id": "57d963bc-f6f9-4fd4-b7b5-cdb822f4778a",
                "name": "CS253-PSO6.pdf",
                "type": "homework",
                "updatedAt": "2025-08-12 12:23:49.231-04",
                "extension": "pdf",
                "scenario_ids": [scenario_id],
                "can_edit": True,
                "can_delete": True,
                "active": True,
                "department_id": "c7692d34-b875-5122-af69-074f85981205",
                "file_path": "57d963bc-f6f9-4fd4-b7b5-cdb822f4778a.pdf",
                "mime_type": "application/pdf",
                "parameter_item_ids": []
            }
        ]
    }
    
    mock_conn.fetchrow.return_value = mock_scenario_data
    
    # Act
    from app.schemas.scenarios import ScenarioDetailRequest
    
    request = ScenarioDetailRequest(scenarioId=scenario_id, profileId=profile_id)
    result = await scenario_service.get_scenario_detail(request)
    
    # Assert
    assert result.document_details is not None
    assert len(result.document_details) == 1
    
    doc = result.document_details[0]
    assert doc.document_id == "57d963bc-f6f9-4fd4-b7b5-cdb822f4778a"
    assert doc.name == "CS253-PSO6.pdf"
    assert doc.type == "homework"
    assert doc.file_path == "57d963bc-f6f9-4fd4-b7b5-cdb822f4778a.pdf"
    assert doc.mime_type == "application/pdf"
    assert doc.extension == "pdf"
    assert doc.can_edit is True
    assert doc.can_delete is True
    assert doc.active is True
    assert doc.department_id == "c7692d34-b875-5122-af69-074f85981205"
    assert scenario_id in doc.scenario_ids
    assert isinstance(doc.parameter_item_ids, list)
    assert doc.updatedAt is not None


@pytest.mark.asyncio
async def test_get_scenario_detail_default_returns_empty_document_details(
    scenario_service: Any, mock_conn: AsyncMock, mock_queries: MagicMock
) -> None:
    """Test that get_scenario_detail_default returns empty document_details array."""
    # Arrange
    profile_id = "965bd24f-dfae-4063-b370-e1373df46322"
    
    mock_queries.get_scenario_detail_default_complete.return_value = (
        "SELECT * FROM ...",
        [profile_id]
    )
    
    mock_default_data = {
        "department_ids": ["c7692d34-b875-5122-af69-074f85981205"],
        "valid_persona_ids": [],
        "valid_document_ids": [],
        "department_mapping": {
            "c7692d34-b875-5122-af69-074f85981205": {
                "name": "Computer Science",
                "description": ""
            }
        },
        "persona_mapping": {},
        "document_mapping": {},
        "parameter_mapping": {},
        "parameter_item_mapping": {},
        "parameters_json": {},
        "document_details": []  # Empty array for create mode
    }
    
    mock_conn.fetchrow.return_value = mock_default_data
    
    # Act
    from app.schemas.scenarios import ScenarioDetailDefaultRequest
    request = ScenarioDetailDefaultRequest(profileId=profile_id)
    result = await scenario_service.get_scenario_detail_default(request)
    
    # Assert
    assert result.document_details is not None
    assert isinstance(result.document_details, list)
    assert len(result.document_details) == 0
    assert result.document_ids == []
    assert result.name == ""
    assert result.problem_statement == ""


@pytest.mark.asyncio
@pytest.mark.skip(reason="Integration test - requires database")
async def test_document_details_integration() -> None:
    """Integration test to verify document_details query returns correct data.
    
    This test should be run manually with a real database connection.
    """
    # This is a placeholder for an integration test that would:
    # 1. Connect to a test database
    # 2. Create a scenario with documents
    # 3. Query the scenario detail
    # 4. Verify all 13 fields are present in document_details
    pass

