"""Test document-parameter item matching in scenario service."""

import asyncpg  # type: ignore
import pytest
from app.services.scenario_service import ScenarioService  # type: ignore
from tests.seed_helpers import get_cs_dept_id  # type: ignore
from tests.seed_helpers import get_superadmin_alias  # type: ignore

pytestmark = pytest.mark.asyncio


async def test_randomly_fill_scenario_attributes_document_parameter_matching(
    db: asyncpg.Connection, disable_cache: None
) -> None:
    """
    Test that randomly_fill_scenario_attributes() selects documents that share 
    parameter items with the scenario via document_parameter_items junction table.
    
    This test verifies intelligent document selection based on parameter item matching,
    not just text similarity.
    """
    # Test the updated implementation that uses document_parameter_items
    
    dept_id = await get_cs_dept_id(db)
    admin_id = await get_superadmin_alias(db)
    
    # Get a scenario with parameter items (look for scenarios with CS251 or CS182 parameter items)
    scenario_result = await db.fetchrow(
        """
        SELECT DISTINCT s.id, s.name, s.problem_statement, s.department_id
        FROM scenarios s
        JOIN scenario_parameter_items spi ON spi.scenario_id = s.id
        JOIN parameter_items pi ON pi.id = spi.parameter_item_id
        WHERE s.department_id = $1 
        AND spi.active = true
        AND pi.value IN ('CS251', 'CS182')
        LIMIT 1
        """,
        dept_id
    )
    
    if not scenario_result:
        pytest.skip("No practice scenario found in test database")
    
    scenario = dict(scenario_result)
    
    # Get the scenario's parameter items
    param_items = await db.fetch(
        """
        SELECT spi.parameter_item_id, pi.name, pi.value, pi.parameter_id, p.name as parameter_name
        FROM scenario_parameter_items spi
        JOIN parameter_items pi ON pi.id = spi.parameter_item_id
        JOIN parameters p ON p.id = pi.parameter_id
        WHERE spi.scenario_id = $1 AND spi.active = true
        """,
        scenario["id"]
    )
    
    if not param_items:
        pytest.skip("Scenario has no parameter items to test with")
    
    param_item_ids = [str(item["parameter_item_id"]) for item in param_items]
    
    # Get documents linked to these parameter items via document_parameter_items
    linked_docs = await db.fetch(
        """
        SELECT DISTINCT d.id, d.name, d.type
        FROM documents d
        JOIN document_parameter_items dpi ON dpi.document_id = d.id
        WHERE dpi.parameter_item_id = ANY($1::uuid[])
        AND dpi.active = true
        AND d.active = true
        """,
        param_item_ids
    )
    
    if not linked_docs:
        pytest.skip("No documents linked to scenario's parameter items found")
    
    # Get all active documents for comparison
    all_docs = await db.fetch(
        """
        SELECT id, name, type FROM documents 
        WHERE active = true AND department_id = $1
        """,
        dept_id
    )
    
    # Execute the method under test
    svc = ScenarioService(db)
    result = await svc.randomly_fill_scenario_attributes(scenario, dept_id)
    
    # Verify that the result includes documents linked to parameter items
    # The method should prefer documents that share parameter items with the scenario
    
    # Get the documents that were actually selected
    selected_doc_ids = await db.fetch(
        """
        SELECT document_id FROM scenario_documents 
        WHERE scenario_id = $1 AND active = true
        """,
        result["id"]
    )
    
    selected_doc_ids = [str(row["document_id"]) for row in selected_doc_ids]
    linked_doc_ids = [str(doc["id"]) for doc in linked_docs]
    
    # Assert that at least one selected document is linked to the scenario's parameter items
    has_matching_doc = any(doc_id in linked_doc_ids for doc_id in selected_doc_ids)
    
    assert has_matching_doc, (
        f"Expected scenario to select documents linked to parameter items {param_item_ids}, "
        f"but selected documents {selected_doc_ids} don't include any linked documents {linked_doc_ids}. "
        f"Available linked documents: {[doc['name'] for doc in linked_docs]}"
    )
    
    # Additional verification: if there are multiple documents with parameter item links,
    # the method should prefer them over documents without links
    if len(linked_docs) > 1:
        # Count how many selected documents have parameter item links
        matching_count = sum(1 for doc_id in selected_doc_ids if doc_id in linked_doc_ids)
        
        # If there are enough linked documents, most/all selected should be linked
        if len(linked_docs) >= len(selected_doc_ids):
            assert matching_count == len(selected_doc_ids), (
                f"Expected all selected documents to be linked to parameter items when "
                f"sufficient linked documents are available. "
                f"Selected: {selected_doc_ids}, Linked: {linked_doc_ids}"
            )


async def test_document_parameter_items_junction_table_exists(
    db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test that document_parameter_items junction table has data for testing."""
    # Check if document_parameter_items table has any data
    count = await db.fetchval("SELECT COUNT(*) FROM document_parameter_items WHERE active = true")
    
    if count == 0:
        pytest.skip("No document_parameter_items data found in test database")
    
    # Get some sample data to verify the relationship
    sample_data = await db.fetch(
        """
        SELECT 
            d.name as document_name,
            d.type as document_type,
            pi.name as parameter_item_name,
            pi.value as parameter_item_value,
            p.name as parameter_name
        FROM document_parameter_items dpi
        JOIN documents d ON d.id = dpi.document_id
        JOIN parameter_items pi ON pi.id = dpi.parameter_item_id
        JOIN parameters p ON p.id = pi.parameter_id
        WHERE dpi.active = true
        LIMIT 5
        """
    )
    
    assert len(sample_data) > 0, "Should have sample document-parameter item relationships"
    
    # Log the sample data for debugging
    print(f"Sample document-parameter item relationships:")
    for row in sample_data:
        print(f"  Document: {row['document_name']} ({row['document_type']}) "
              f"linked to parameter item: {row['parameter_item_name']} "
              f"({row['parameter_name']}: {row['parameter_item_value']})")
