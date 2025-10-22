"""Comprehensive tests for scenario attribute selection logic in randomly_fill_scenario_attributes.

Tests the business logic for:
1. Document selection via parameter items (with fallback to text similarity)
2. Objectives selection (first 3 by idx)
3. Problem statement selection (most recent active)
4. Scenario variant creation with proper copying
"""

import uuid

import asyncpg  # type: ignore
import pytest
from app.services.scenario_service import ScenarioService  # type: ignore
from tests.seed_helpers import get_cs_dept_id  # type: ignore

pytestmark = pytest.mark.asyncio


# ============================================================================
# TEST DATA SETUP HELPERS
# ============================================================================

async def create_test_scenario_with_attributes(
    db: asyncpg.Connection, 
    dept_id: str,
    name: str = "Test Scenario",
    problem_statement: str = "Test problem statement"
) -> str:
    """Create a test scenario with basic attributes."""
    scenario_id = await db.fetchval(
        """
        INSERT INTO scenarios (name, department_id, active, default_scenario)
        VALUES ($1, $2, true, false)
        RETURNING id
        """,
        name, dept_id
    )
    
    # Insert problem statement into scenario_problem_statements table
    if problem_statement:
        await db.execute(
            """
            INSERT INTO scenario_problem_statements (scenario_id, problem_statement, active)
            VALUES ($1, $2, true)
            """,
            scenario_id, problem_statement
        )
    
    # Create self-edge in scenario_tree
    await db.execute(
        "INSERT INTO scenario_tree (parent_id, child_id) VALUES ($1, $1)",
        scenario_id
    )
    
    return str(scenario_id)


async def create_test_parameter_and_items(
    db: asyncpg.Connection, 
    dept_id: str,
    param_name: str = "Test Parameter"
) -> tuple[str, list[str]]:
    """Create a test parameter with 3 parameter items."""
    param_id = await db.fetchval(
        """
        INSERT INTO parameters (name, description, department_id, active)
        VALUES ($1, 'Test parameter description', $2, true)
        RETURNING id
        """,
        param_name, dept_id
    )
    
    param_items = []
    for i in range(3):
        item_id = await db.fetchval(
            """
            INSERT INTO parameter_items (name, description, value, parameter_id)
            VALUES ($1, 'Test item description', 'test_value', $2)
            RETURNING id
            """,
            f"{param_name} Item {i+1}", param_id
        )
        param_items.append(str(item_id))
    
    return str(param_id), param_items


async def create_test_documents_with_parameter_links(
    db: asyncpg.Connection,
    dept_id: str,
    param_item_ids: list[str],
    doc_names: list[str] | None = None
) -> list[str]:
    """Create test documents and link them to parameter items via document_parameter_items."""
    if doc_names is None:
        doc_names = ["Test Document 1", "Test Document 2", "Test Document 3"]
    
    doc_ids = []
    for i, name in enumerate(doc_names):
        doc_id = await db.fetchval(
            """
            INSERT INTO documents (name, type, file_path, mime_type, file_id, department_id, active)
            VALUES ($1, 'homework', '/test/path.pdf', 'application/pdf', 'test_file_id', $2, true)
            RETURNING id
            """,
            name, dept_id
        )
        doc_ids.append(str(doc_id))
        
        # Link to parameter items (first doc links to first param item, etc.)
        if i < len(param_item_ids):
            await db.execute(
                """
                INSERT INTO document_parameter_items (document_id, parameter_item_id, active)
                VALUES ($1, $2, true)
                """,
                doc_id, param_item_ids[i]
            )
    
    return doc_ids


async def create_test_objectives(
    db: asyncpg.Connection,
    scenario_id: str,
    objectives: list[str] | None = None
) -> None:
    """Create test objectives for a scenario."""
    if objectives is None:
        objectives = [
            "Objective 1: Learn basic concepts",
            "Objective 2: Apply knowledge", 
            "Objective 3: Analyze problems",
            "Objective 4: Create solutions"
        ]
    
    for idx, objective in enumerate(objectives):
        await db.execute(
            """
            INSERT INTO scenario_objectives (scenario_id, idx, objective)
            VALUES ($1, $2, $3)
            """,
            scenario_id, idx + 1, objective
        )


async def create_test_problem_statements(
    db: asyncpg.Connection,
    scenario_id: str,
    statements: list[str] | None = None
) -> None:
    """Create test problem statements for a scenario (with different timestamps)."""
    if statements is None:
        statements = [
            "Old problem statement",
            "New problem statement"
        ]
    
    for i, statement in enumerate(statements):
        hours_ago = i * 2
        # First, deactivate any existing problem statements
        await db.execute(
            "UPDATE scenario_problem_statements SET active = false WHERE scenario_id = $1",
            scenario_id
        )
        # Then insert the new one
        await db.execute(
            f"""
            INSERT INTO scenario_problem_statements (scenario_id, problem_statement, active, created_at)
            VALUES ($1, $2, true, now() - interval '{hours_ago} hours')
            """,
            scenario_id, statement
        )


# ============================================================================
# DOCUMENT SELECTION TESTS
# ============================================================================

async def test_document_selection_via_parameter_items_matching_documents_exist(
    db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test document selection when documents match parameter items via document_parameter_items junction."""
    dept_id = await get_cs_dept_id(db)
    
    # Setup: Create scenario, parameter, parameter items, and documents
    scenario_id = await create_test_scenario_with_attributes(db, dept_id)
    param_id, param_item_ids = await create_test_parameter_and_items(db, dept_id, "Course")
    doc_ids = await create_test_documents_with_parameter_links(
        db, dept_id, param_item_ids, ["CS182 Document", "CS253 Document", "CS251 Document"]
    )
    
    # Link scenario to parameter items
    for param_item_id in param_item_ids:
        await db.execute(
            """
            INSERT INTO scenario_parameter_items (scenario_id, parameter_item_id, active)
            VALUES ($1, $2, true)
            """,
            scenario_id, param_item_id
        )
    
    # Execute: Call randomly_fill_scenario_attributes
    svc = ScenarioService(db)
    result = await svc.randomly_fill_scenario_attributes(
        {"id": scenario_id, "name": "Test Scenario", "problem_statement": "Test problem"},
        uuid.UUID(dept_id)
    )
    
    # Assert: Should select documents that match parameter items
    # Check that scenario_documents junction has been populated
    # The service returns a new scenario variant, so check that one
    new_scenario_id = result["id"]
    linked_docs = await db.fetch(
        "SELECT document_id FROM scenario_documents WHERE scenario_id = $1 AND active = true",
        new_scenario_id
    )
    
    assert len(linked_docs) == 1, "Should select exactly 1 document"
    selected_doc_id = linked_docs[0]["document_id"]
    
    # Verify the selected document is linked to one of the parameter items
    doc_param_link = await db.fetchval(
        """
        SELECT EXISTS (
            SELECT 1 FROM document_parameter_items dpi
            JOIN scenario_parameter_items spi ON spi.parameter_item_id = dpi.parameter_item_id
            WHERE dpi.document_id = $1 AND spi.scenario_id = $2 AND dpi.active = true
        )
        """,
        selected_doc_id, scenario_id
    )
    
    assert doc_param_link, "Selected document should be linked to scenario's parameter items"


async def test_document_selection_fallback_to_text_similarity_no_matching_documents(
    db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test document selection falls back to text similarity when no documents match parameter items."""
    dept_id = await get_cs_dept_id(db)
    
    # Setup: Create scenario, parameter, parameter items, and documents (not linked)
    scenario_id = await create_test_scenario_with_attributes(db, dept_id, "CS182 Homework", "CS182 homework problem")
    param_id, param_item_ids = await create_test_parameter_and_items(db, dept_id, "Course")
    
    # Create documents that are NOT linked to parameter items
    doc_ids = await create_test_documents_with_parameter_links(
        db, dept_id, [], ["CS182-HW1.pdf", "CS253-PSO1.pdf", "Random-Document.pdf"]
    )
    
    # Link scenario to parameter items
    for param_item_id in param_item_ids:
        await db.execute(
            """
            INSERT INTO scenario_parameter_items (scenario_id, parameter_item_id, active)
            VALUES ($1, $2, true)
            """,
            scenario_id, param_item_id
        )
    
    # Execute: Call randomly_fill_scenario_attributes
    svc = ScenarioService(db)
    result = await svc.randomly_fill_scenario_attributes(
        {"id": scenario_id, "name": "CS182 Homework", "problem_statement": "CS182 homework problem"},
        uuid.UUID(dept_id)
    )
    
    # Assert: Should fall back to text similarity and select 1 document
    new_scenario_id = result["id"]
    linked_docs = await db.fetch(
        "SELECT document_id FROM scenario_documents WHERE scenario_id = $1 AND active = true",
        new_scenario_id
    )
    
    assert len(linked_docs) == 1, "Should select exactly 1 document via text similarity fallback"
    
    # Verify the selected document exists (should be any active document from the database)
    selected_doc_id = linked_docs[0]["document_id"]
    # Check that a document was actually selected (not empty)
    assert selected_doc_id is not None, "Should have selected a document"


async def test_document_selection_skip_when_documents_already_exist(
    db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test document selection is skipped when scenario already has documents."""
    dept_id = await get_cs_dept_id(db)
    
    # Setup: Create scenario with existing documents
    scenario_id = await create_test_scenario_with_attributes(db, dept_id)
    param_id, param_item_ids = await create_test_parameter_and_items(db, dept_id, "Course")
    
    # Create and link existing documents
    existing_doc_ids = await create_test_documents_with_parameter_links(
        db, dept_id, param_item_ids[:2], ["Existing Doc 1", "Existing Doc 2"]
    )
    
    # Link scenario to existing documents
    for doc_id in existing_doc_ids:
        await db.execute(
            """
            INSERT INTO scenario_documents (scenario_id, document_id, active)
            VALUES ($1, $2, true)
            """,
            scenario_id, doc_id
        )
    
    # Link scenario to parameter items
    for param_item_id in param_item_ids:
        await db.execute(
            """
            INSERT INTO scenario_parameter_items (scenario_id, parameter_item_id, active)
            VALUES ($1, $2, true)
            """,
            scenario_id, param_item_id
        )
    
    # Execute: Call randomly_fill_scenario_attributes
    svc = ScenarioService(db)
    result = await svc.randomly_fill_scenario_attributes(
        {"id": scenario_id, "name": "Test Scenario", "problem_statement": "Test problem"},
        uuid.UUID(dept_id)
    )
    
    # Assert: Should not add more documents (keep existing)
    new_scenario_id = result["id"]
    linked_docs = await db.fetch(
        "SELECT document_id FROM scenario_documents WHERE scenario_id = $1 AND active = true",
        new_scenario_id
    )
    
    assert len(linked_docs) == 2, "Should keep existing 2 documents, not add more"
    assert set(str(doc["document_id"]) for doc in linked_docs) == set(existing_doc_ids), "Should keep the same documents"


# ============================================================================
# OBJECTIVES SELECTION TESTS
# ============================================================================

async def test_objectives_selection_first_3_by_idx(
    db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test objectives selection gets first 3 objectives ordered by idx."""
    dept_id = await get_cs_dept_id(db)
    
    # Setup: Create scenario with 4 objectives
    scenario_id = await create_test_scenario_with_attributes(db, dept_id)
    await create_test_objectives(
        db, scenario_id, 
        ["Objective 1", "Objective 2", "Objective 3", "Objective 4"]
    )
    
    # Execute: Call randomly_fill_scenario_attributes
    svc = ScenarioService(db)
    result = await svc.randomly_fill_scenario_attributes(
        {"id": scenario_id, "name": "Test Scenario", "problem_statement": "Test problem"},
        uuid.UUID(dept_id)
    )
    
    # Assert: Should have first 3 objectives in result
    assert "objectives" in result, "Result should contain objectives"
    objectives = result["objectives"]
    assert len(objectives) == 3, "Should select first 3 objectives"
    assert objectives[0] == "Objective 1", "First objective should be idx 1"
    assert objectives[1] == "Objective 2", "Second objective should be idx 2"
    assert objectives[2] == "Objective 3", "Third objective should be idx 3"


async def test_objectives_selection_fewer_than_3_available(
    db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test objectives selection when fewer than 3 objectives exist."""
    dept_id = await get_cs_dept_id(db)
    
    # Setup: Create scenario with only 2 objectives
    scenario_id = await create_test_scenario_with_attributes(db, dept_id)
    await create_test_objectives(
        db, scenario_id, 
        ["Objective 1", "Objective 2"]
    )
    
    # Execute: Call randomly_fill_scenario_attributes
    svc = ScenarioService(db)
    result = await svc.randomly_fill_scenario_attributes(
        {"id": scenario_id, "name": "Test Scenario", "problem_statement": "Test problem"},
        uuid.UUID(dept_id)
    )
    
    # Assert: Should use all available objectives
    assert "objectives" in result, "Result should contain objectives"
    objectives = result["objectives"]
    assert len(objectives) == 2, "Should use all 2 available objectives"
    assert objectives[0] == "Objective 1", "First objective should be idx 1"
    assert objectives[1] == "Objective 2", "Second objective should be idx 2"


async def test_objectives_selection_none_exist(
    db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test objectives selection when no objectives exist."""
    dept_id = await get_cs_dept_id(db)
    
    # Setup: Create scenario with no objectives
    scenario_id = await create_test_scenario_with_attributes(db, dept_id)
    
    # Execute: Call randomly_fill_scenario_attributes
    svc = ScenarioService(db)
    result = await svc.randomly_fill_scenario_attributes(
        {"id": scenario_id, "name": "Test Scenario", "problem_statement": "Test problem"},
        uuid.UUID(dept_id)
    )
    
    # Assert: Should have empty objectives array
    assert "objectives" in result, "Result should contain objectives"
    objectives = result["objectives"]
    assert len(objectives) == 0, "Should have empty objectives array when none exist"


# ============================================================================
# PROBLEM STATEMENT SELECTION TESTS
# ============================================================================

async def test_problem_statement_selection_most_recent_active(
    db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test problem statement selection gets most recent active statement."""
    dept_id = await get_cs_dept_id(db)
    
    # Setup: Create scenario with multiple problem statements
    scenario_id = await create_test_scenario_with_attributes(db, dept_id)
    await create_test_problem_statements(
        db, scenario_id,
        ["Old problem statement", "New problem statement"]
    )
    
    # Execute: Call randomly_fill_scenario_attributes
    svc = ScenarioService(db)
    result = await svc.randomly_fill_scenario_attributes(
        {"id": scenario_id, "name": "Test Scenario", "problem_statement": "Test problem"},
        uuid.UUID(dept_id)
    )
    
    # Assert: Should use most recent problem statement
    assert "problem_statement" in result, "Result should contain problem_statement"
    problem_statement = result["problem_statement"]
    assert problem_statement == "New problem statement", "Should use most recent problem statement"


async def test_problem_statement_selection_none_exist(
    db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test problem statement selection when no active statements exist."""
    dept_id = await get_cs_dept_id(db)
    
    # Setup: Create scenario with no problem statements
    scenario_id = await create_test_scenario_with_attributes(db, dept_id, problem_statement=None)
    
    # Execute: Call randomly_fill_scenario_attributes
    svc = ScenarioService(db)
    result = await svc.randomly_fill_scenario_attributes(
        {"id": scenario_id, "name": "Test Scenario", "problem_statement": "Test problem"},
        uuid.UUID(dept_id)
    )
    
    # Assert: Should generate a problem statement using AI (or None if AI fails)
    assert "problem_statement" in result, "Result should contain problem_statement"
    problem_statement = result["problem_statement"]
    # With AI generation, we should either get a generated statement or None (if AI fails)
    assert problem_statement is None or isinstance(problem_statement, str), "Should be None or a generated string"


# ============================================================================
# SCENARIO VARIANT CREATION TESTS
# ============================================================================

async def test_scenario_variant_creation_copies_objectives_and_problem_statements(
    db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test scenario variant creation copies objectives and problem statements to new scenario."""
    dept_id = await get_cs_dept_id(db)
    
    # Setup: Create original scenario with objectives and problem statements
    original_scenario_id = await create_test_scenario_with_attributes(db, dept_id)
    await create_test_objectives(
        db, original_scenario_id,
        ["Original Objective 1", "Original Objective 2", "Original Objective 3"]
    )
    await create_test_problem_statements(
        db, original_scenario_id,
        ["Original problem statement"]
    )
    
    # Create parameter items to trigger variant creation
    param_id, param_item_ids = await create_test_parameter_and_items(db, dept_id, "Course")
    for param_item_id in param_item_ids:
        await db.execute(
            """
            INSERT INTO scenario_parameter_items (scenario_id, parameter_item_id, active)
            VALUES ($1, $2, true)
            """,
            original_scenario_id, param_item_id
        )
    
    # Execute: Call randomly_fill_scenario_attributes (should create variant)
    svc = ScenarioService(db)
    result = await svc.randomly_fill_scenario_attributes(
        {"id": original_scenario_id, "name": "Original Scenario", "problem_statement": "Original problem"},
        uuid.UUID(dept_id)
    )
    
    # Assert: New scenario variant should be created
    assert result["id"] != original_scenario_id, "Should create new scenario variant"
    new_scenario_id = result["id"]
    
    # Check scenario_tree edge was created
    tree_edge = await db.fetchrow(
        "SELECT * FROM scenario_tree WHERE parent_id = $1 AND child_id = $2",
        original_scenario_id, new_scenario_id
    )
    assert tree_edge is not None, "Should create scenario_tree edge from parent to child"
    
    # Check objectives were copied
    new_objectives = await db.fetch(
        "SELECT idx, objective FROM scenario_objectives WHERE scenario_id = $1 ORDER BY idx",
        new_scenario_id
    )
    assert len(new_objectives) == 3, "Should copy all 3 objectives"
    assert new_objectives[0]["objective"] == "Original Objective 1", "Should copy first objective"
    assert new_objectives[1]["objective"] == "Original Objective 2", "Should copy second objective"
    assert new_objectives[2]["objective"] == "Original Objective 3", "Should copy third objective"
    
    # Check problem statement was copied
    new_problem_statement = await db.fetchval(
        "SELECT problem_statement FROM scenario_problem_statements WHERE scenario_id = $1 AND active = true",
        new_scenario_id
    )
    assert new_problem_statement == "Original problem statement", "Should copy problem statement"


# ============================================================================
# INTEGRATION TESTS
# ============================================================================

async def test_full_integration_parameter_items_to_documents_to_objectives_to_problem_statements(
    db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test full integration: parameter items → documents → objectives → problem statements."""
    dept_id = await get_cs_dept_id(db)
    
    # Setup: Create complete scenario with all attributes
    scenario_id = await create_test_scenario_with_attributes(db, dept_id, "CS182 Homework", "CS182 homework problem")
    
    # Create parameter items
    param_id, param_item_ids = await create_test_parameter_and_items(db, dept_id, "Course")
    
    # Create documents linked to parameter items
    doc_ids = await create_test_documents_with_parameter_links(
        db, dept_id, param_item_ids, ["CS182-HW1.pdf", "CS253-PSO1.pdf", "CS251-Project.pdf"]
    )
    
    # Create objectives
    await create_test_objectives(
        db, scenario_id,
        ["Learn CS182 concepts", "Apply algorithms", "Solve problems", "Create solutions"]
    )
    
    # Create problem statements
    await create_test_problem_statements(
        db, scenario_id,
        ["Old CS182 problem", "New CS182 problem"]
    )
    
    # Link scenario to parameter items
    for param_item_id in param_item_ids:
        await db.execute(
            """
            INSERT INTO scenario_parameter_items (scenario_id, parameter_item_id, active)
            VALUES ($1, $2, true)
            """,
            scenario_id, param_item_id
        )
    
    # Execute: Call randomly_fill_scenario_attributes
    svc = ScenarioService(db)
    result = await svc.randomly_fill_scenario_attributes(
        {"id": scenario_id, "name": "CS182 Homework", "problem_statement": "CS182 homework problem"},
        uuid.UUID(dept_id)
    )
    
    # Assert: All business logic should work together
    assert "id" in result, "Should return scenario ID"
    assert "objectives" in result, "Should contain objectives"
    assert "problem_statement" in result, "Should contain problem statement"
    
    # Check objectives (first 3)
    objectives = result["objectives"]
    assert len(objectives) == 3, "Should select first 3 objectives"
    assert objectives[0] == "Learn CS182 concepts", "Should have first objective"
    assert objectives[1] == "Apply algorithms", "Should have second objective"
    assert objectives[2] == "Solve problems", "Should have third objective"
    
    # Check problem statement (most recent)
    problem_statement = result["problem_statement"]
    assert problem_statement == "New CS182 problem", "Should use most recent problem statement"
    
    # Check documents were selected via parameter items
    new_scenario_id = result["id"]
    linked_docs = await db.fetch(
        "SELECT document_id FROM scenario_documents WHERE scenario_id = $1 AND active = true",
        new_scenario_id
    )
    assert len(linked_docs) == 1, "Should select exactly 1 document"
    
    # Verify the selected document is linked to parameter items
    selected_doc_id = linked_docs[0]["document_id"]
    doc_param_link = await db.fetchval(
        """
        SELECT EXISTS (
            SELECT 1 FROM document_parameter_items dpi
            JOIN scenario_parameter_items spi ON spi.parameter_item_id = dpi.parameter_item_id
            WHERE dpi.document_id = $1 AND spi.scenario_id = $2 AND dpi.active = true
        )
        """,
        selected_doc_id, scenario_id
    )
    assert doc_param_link, "Selected document should be linked to scenario's parameter items"


# ============================================================================
# EDGE CASE TESTS
# ============================================================================

async def test_no_documents_match_parameter_items_fallback_to_text_similarity(
    db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test edge case: no documents match parameter items, fallback to text similarity."""
    dept_id = await get_cs_dept_id(db)
    
    # Setup: Create scenario with parameter items, but documents not linked to those items
    scenario_id = await create_test_scenario_with_attributes(db, dept_id, "CS182 Homework", "CS182 homework problem")
    param_id, param_item_ids = await create_test_parameter_and_items(db, dept_id, "Course")
    
    # Create documents with different parameter items (not linked to scenario's items)
    other_param_id, other_param_item_ids = await create_test_parameter_and_items(db, dept_id, "Other Parameter")
    doc_ids = await create_test_documents_with_parameter_links(
        db, dept_id, other_param_item_ids, ["CS182-HW1.pdf", "CS253-PSO1.pdf"]
    )
    
    # Link scenario to first set of parameter items
    for param_item_id in param_item_ids:
        await db.execute(
            """
            INSERT INTO scenario_parameter_items (scenario_id, parameter_item_id, active)
            VALUES ($1, $2, true)
            """,
            scenario_id, param_item_id
        )
    
    # Execute: Call randomly_fill_scenario_attributes
    svc = ScenarioService(db)
    result = await svc.randomly_fill_scenario_attributes(
        {"id": scenario_id, "name": "CS182 Homework", "problem_statement": "CS182 homework problem"},
        uuid.UUID(dept_id)
    )
    
    # Assert: Should fall back to text similarity and still select a document
    new_scenario_id = result["id"]
    linked_docs = await db.fetch(
        "SELECT document_id FROM scenario_documents WHERE scenario_id = $1 AND active = true",
        new_scenario_id
    )
    assert len(linked_docs) == 1, "Should select 1 document via text similarity fallback"
    
    # The selected document should be one of the available documents
    selected_doc_id = linked_docs[0]["document_id"]
    # Check that a document was actually selected (not empty)
    assert selected_doc_id is not None, "Should have selected a document"


async def test_scenario_already_has_documents_skip_selection(
    db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test edge case: scenario already has documents, should skip document selection."""
    dept_id = await get_cs_dept_id(db)
    
    # Setup: Create scenario with existing documents
    scenario_id = await create_test_scenario_with_attributes(db, dept_id)
    
    # Create and link existing documents
    existing_doc_ids = []
    for i in range(2):
        doc_id = await db.fetchval(
            """
            INSERT INTO documents (name, type, file_path, mime_type, file_id, department_id, active)
            VALUES ($1, 'homework', '/test/path.pdf', 'application/pdf', 'test_file_id', $2, true)
            RETURNING id
            """,
            f"Existing Doc {i+1}", dept_id
        )
        existing_doc_ids.append(str(doc_id))
        
        await db.execute(
            """
            INSERT INTO scenario_documents (scenario_id, document_id, active)
            VALUES ($1, $2, true)
            """,
            scenario_id, doc_id
        )
    
    # Create parameter items that could trigger document selection
    param_id, param_item_ids = await create_test_parameter_and_items(db, dept_id, "Course")
    for param_item_id in param_item_ids:
        await db.execute(
            """
            INSERT INTO scenario_parameter_items (scenario_id, parameter_item_id, active)
            VALUES ($1, $2, true)
            """,
            scenario_id, param_item_id
        )
    
    # Execute: Call randomly_fill_scenario_attributes
    svc = ScenarioService(db)
    result = await svc.randomly_fill_scenario_attributes(
        {"id": scenario_id, "name": "Test Scenario", "problem_statement": "Test problem"},
        uuid.UUID(dept_id)
    )
    
    # Assert: Should keep existing documents, not add more
    new_scenario_id = result["id"]
    linked_docs = await db.fetch(
        "SELECT document_id FROM scenario_documents WHERE scenario_id = $1 AND active = true",
        new_scenario_id
    )
    assert len(linked_docs) == 2, "Should keep existing 2 documents"
    assert set(str(doc["document_id"]) for doc in linked_docs) == set(existing_doc_ids), "Should keep the same documents"
