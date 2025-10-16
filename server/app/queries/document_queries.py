"""Document queries - SQL query builders."""

from typing import Any, List, Tuple


class DocumentQueries:
    """Query builders for document operations."""

    def list_documents(
        self, department_ids: List[str], profile_id: str
    ) -> Tuple[str, List[Any]]:
        """Build query for documents list with permissions and relationships."""
        # TODO: Create document_parameter_items junction table and query specific items per document
        query = """
        WITH document_scenarios AS (
            SELECT 
                sd.document_id,
                ARRAY_AGG(DISTINCT sd.scenario_id) as scenario_ids
            FROM scenario_documents sd
            WHERE sd.active = true
            GROUP BY sd.document_id
        ),
        document_data AS (
            SELECT 
                d.id as document_id,
                d.name,
                d.type,
                d.updated_at,
                d.mime_type,
                d.active,
                d.department_id,
                d.file_path,
                COALESCE(ds.scenario_ids, ARRAY[]::uuid[]) as scenario_ids,
                ARRAY[]::uuid[] as parameter_item_ids
            FROM documents d
            LEFT JOIN document_scenarios ds ON ds.document_id = d.id
            WHERE d.department_id = ANY($1)
        ),
        user_profile AS (
            SELECT role FROM profiles WHERE id = $2
        )
        SELECT 
            dd.*,
            SUBSTRING(dd.mime_type FROM '\\.([^\\.]+)$') as extension,
            CASE 
                WHEN up.role IN ('admin', 'superadmin') THEN true
                ELSE false
            END as can_edit,
            CASE 
                WHEN up.role IN ('admin', 'superadmin') THEN true
                ELSE false
            END as can_delete
        FROM document_data dd
        CROSS JOIN user_profile up
        ORDER BY dd.updated_at DESC
        """

        return (query, [department_ids, profile_id])

    def get_tag_mapping(
        self, sim_ids: List[str], tag_idxs: List[int]
    ) -> Tuple[str, List[Any]]:
        """Build query for tag mapping."""
        query = """
        SELECT 
            simulation_id,
            idx,
            name,
            (simulation_id::text || '_' || idx::text) as tag_id
        FROM simulation_tags
        WHERE (simulation_id, idx) IN (
            SELECT unnest($1::uuid[]), unnest($2::integer[])
        )
        """
        return (query, [sim_ids, tag_idxs])

    def get_scenario_mapping(
        self, scenario_ids: List[str]
    ) -> Tuple[str, List[Any]]:
        """Build query for scenario mapping."""
        query = "SELECT id, name FROM scenarios WHERE id = ANY($1)"
        return (query, [scenario_ids])

    def get_document_by_id(
        self, document_id: str
    ) -> Tuple[str, List[Any]]:
        """Build query to get document by ID."""
        query = """
        SELECT 
            d.name,
            d.active,
            d.type,
            d.department_id
        FROM documents d
        WHERE d.id = $1
        """
        return (query, [document_id])

    def get_document_tags(self, document_id: str) -> Tuple[str, List[Any]]:
        """Build query to get document tags."""
        query = """
        SELECT 
            (simulation_id::text || '_' || tag_idx::text) as tag_id
        FROM simulation_tag_documents
        WHERE document_id = $1 AND active = true
        """
        return (query, [document_id])

    def get_valid_departments_for_profile(
        self, profile_id: str
    ) -> Tuple[str, List[Any]]:
        """Build query for valid departments."""
        query = """
        SELECT DISTINCT d.id
        FROM departments d
        JOIN profile_departments pd ON pd.department_id = d.id
        WHERE pd.profile_id = $1 AND d.active = true
        ORDER BY d.name
        """
        return (query, [profile_id])

    def get_valid_tags(self, dept_ids: List[str]) -> Tuple[str, List[Any]]:
        """Build query for valid tags."""
        query = """
        SELECT DISTINCT
            (st.simulation_id::text || '_' || st.idx::text) as tag_id
        FROM simulation_tags st
        JOIN simulations s ON s.id = st.simulation_id
        WHERE s.department_id = ANY($1) AND s.active = true
        """
        return (query, [dept_ids])

    def get_documents_by_ids(
        self, document_ids: List[str]
    ) -> Tuple[str, List[Any]]:
        """Build query to get multiple documents."""
        query = """
        SELECT 
            d.id,
            d.type,
            d.department_id
        FROM documents d
        WHERE d.id = ANY($1)
        """
        return (query, [document_ids])

    def get_document_tags_bulk(
        self, document_ids: List[str]
    ) -> Tuple[str, List[Any]]:
        """Build query to get tags for multiple documents."""
        query = """
        SELECT DISTINCT
            (simulation_id::text || '_' || tag_idx::text) as tag_id
        FROM simulation_tag_documents
        WHERE document_id = ANY($1) AND active = true
        """
        return (query, [document_ids])

    def get_departments_mapping(
        self, dept_ids: List[str]
    ) -> Tuple[str, List[Any]]:
        """Build query for departments mapping."""
        query = """
        SELECT id, name, description 
        FROM departments 
        WHERE id = ANY($1)
        ORDER BY name
        """
        return (query, [dept_ids])

    def update_document(self) -> Tuple[str, List[Any]]:
        """Build query to update document."""
        query = """
        UPDATE documents SET
            type = $2,
            department_id = $3,
            updated_at = NOW()
        WHERE id = $1
        """
        return (query, [])  # Will be filled at execution time

    def delete_document_tags(
        self, document_id: str
    ) -> Tuple[str, List[Any]]:
        """Build query to delete document tags."""
        query = """
        DELETE FROM simulation_tag_documents WHERE document_id = $1
        """
        return (query, [document_id])

    def insert_document_tag(self) -> Tuple[str, List[Any]]:
        """Build query to insert document tag."""
        query = """
        INSERT INTO simulation_tag_documents (
            simulation_id,
            tag_idx,
            document_id,
            active
        )
        VALUES (
            $1,
            $2,
            $3,
            true
        )
        ON CONFLICT DO NOTHING
        """
        return (query, [])  # Will be filled at execution time

    def get_document_name(self, document_id: str) -> Tuple[str, List[Any]]:
        """Build query to get document name."""
        query = "SELECT name FROM documents WHERE id = $1"
        return (query, [document_id])

    def delete_document(self, document_id: str) -> Tuple[str, List[Any]]:
        """Build query to delete document."""
        query = "DELETE FROM documents WHERE id = $1"
        return (query, [document_id])

    def bulk_update_documents(self) -> Tuple[str, List[Any]]:
        """Build query to bulk update documents."""
        query = """
        UPDATE documents SET
            type = $2,
            department_id = $3,
            updated_at = NOW()
        WHERE id = ANY($1)
        """
        return (query, [])  # Will be filled at execution time

    def delete_document_tags_bulk(
        self, document_ids: List[str]
    ) -> Tuple[str, List[Any]]:
        """Build query to delete tags for multiple documents."""
        query = """
        DELETE FROM simulation_tag_documents WHERE document_id = ANY($1)
        """
        return (query, [document_ids])

    def bulk_delete_documents(
        self, document_ids: List[str]
    ) -> Tuple[str, List[Any]]:
        """Build query to bulk delete documents."""
        query = "DELETE FROM documents WHERE id = ANY($1)"
        return (query, [document_ids])
