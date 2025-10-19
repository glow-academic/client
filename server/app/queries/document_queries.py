"""Document queries - SQL query builders."""

from typing import Any


class DocumentQueries:
    """Query builders for document operations."""

    def list_documents(
        self, department_ids: list[str], profile_id: str
    ) -> tuple[str, list[Any]]:
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

    # get_tag_mapping removed - simulation_tags table dropped
    # Use get_parameter_item_mapping instead

    def get_scenario_mapping(self, scenario_ids: list[str]) -> tuple[str, list[Any]]:
        """Build query for scenario mapping."""
        query = "SELECT id, name FROM scenarios WHERE id = ANY($1)"
        return (query, [scenario_ids])

    def get_document_by_id(self, document_id: str) -> tuple[str, list[Any]]:
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

    def get_document_parameter_items(self, document_id: str) -> tuple[str, list[Any]]:
        """Build query to get parameter items linked to document."""
        query = """
        SELECT 
            dpi.parameter_item_id,
            dpi.document_id,
            dpi.active,
            dpi.created_at
        FROM document_parameter_items dpi
        WHERE dpi.document_id = $1 AND dpi.active = true
        """
        return (query, [document_id])

    def get_valid_departments_for_profile(
        self, profile_id: str
    ) -> tuple[str, list[Any]]:
        """Build query for valid departments."""
        query = """
        SELECT DISTINCT d.id
        FROM departments d
        JOIN profile_departments pd ON pd.department_id = d.id
        WHERE pd.profile_id = $1 AND d.active = true
        ORDER BY d.title
        """
        return (query, [profile_id])

    def get_valid_parameter_items(self, dept_ids: list[str]) -> tuple[str, list[Any]]:
        """Build query for valid parameter items for departments."""
        query = """
        SELECT DISTINCT
            pi.id,
            pi.name,
            pi.value,
            pi.parameter_id
        FROM parameter_items pi
        JOIN parameters p ON p.id = pi.parameter_id
        WHERE p.department_id = ANY($1) AND p.active = true
        ORDER BY pi.name
        """
        return (query, [dept_ids])

    def get_documents_by_ids(self, document_ids: list[str]) -> tuple[str, list[Any]]:
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

    def get_document_tags_bulk(self, document_ids: list[str]) -> tuple[str, list[Any]]:
        """Build query to get parameter items for multiple documents."""
        query = """
        SELECT DISTINCT
            dpi.document_id,
            dpi.parameter_item_id
        FROM document_parameter_items dpi
        WHERE dpi.document_id = ANY($1) AND dpi.active = true
        """
        return (query, [document_ids])

    def get_departments_mapping(self, dept_ids: list[str]) -> tuple[str, list[Any]]:
        """Build query for departments mapping."""
        query = """
        SELECT id, title as name, description 
        FROM departments 
        WHERE id = ANY($1)
        ORDER BY title
        """
        return (query, [dept_ids])

    def update_document(self) -> tuple[str, list[Any]]:
        """Build query to update document."""
        query = """
        UPDATE documents SET
            type = $2,
            department_id = $3,
            updated_at = NOW()
        WHERE id = $1
        """
        return (query, [])  # Will be filled at execution time

    def delete_document_parameter_items(
        self, document_id: str
    ) -> tuple[str, list[Any]]:
        """Build query to delete document parameter items."""
        query = """
        DELETE FROM document_parameter_items WHERE document_id = $1
        """
        return (query, [document_id])

    def insert_document_parameter_item(self) -> tuple[str, list[Any]]:
        """Build query to insert document parameter item.

        Params order: document_id, parameter_item_id
        """
        query = """
        INSERT INTO document_parameter_items (
            document_id,
            parameter_item_id
        )
        VALUES ($1, $2)
        ON CONFLICT (document_id, parameter_item_id)
        DO UPDATE SET active = true, updated_at = NOW()
        """
        return (query, [])  # Will be filled at execution time

    def get_document_name(self, document_id: str) -> tuple[str, list[Any]]:
        """Build query to get document name."""
        query = "SELECT name FROM documents WHERE id = $1"
        return (query, [document_id])

    def delete_document(self, document_id: str) -> tuple[str, list[Any]]:
        """Build query to delete document."""
        query = "DELETE FROM documents WHERE id = $1"
        return (query, [document_id])

    def bulk_update_documents(self) -> tuple[str, list[Any]]:
        """Build query to bulk update documents."""
        query = """
        UPDATE documents SET
            type = $2,
            department_id = $3,
            updated_at = NOW()
        WHERE id = ANY($1)
        """
        return (query, [])  # Will be filled at execution time

    def delete_document_parameter_items_bulk(
        self, document_ids: list[str]
    ) -> tuple[str, list[Any]]:
        """Build query to delete parameter items for multiple documents."""
        query = """
        DELETE FROM document_parameter_items WHERE document_id = ANY($1)
        """
        return (query, [document_ids])

    def bulk_delete_documents(self, document_ids: list[str]) -> tuple[str, list[Any]]:
        """Build query to bulk delete documents."""
        query = "DELETE FROM documents WHERE id = ANY($1)"
        return (query, [document_ids])

    def get_parameter_items_for_departments(
        self, department_ids: list[str]
    ) -> tuple[str, list[Any]]:
        """Build query to get parameter items for departments."""
        query = """
            SELECT 
                pi.id,
                pi.name,
                COALESCE(pi.description, '') as description,
                pi.parameter_id,
                p.name as parameter_name
            FROM parameter_items pi
            JOIN parameters p ON p.id = pi.parameter_id
            WHERE p.department_id = ANY($1) AND p.active = true
        """
        return (query, [department_ids])

    def get_parameter_items_for_department(
        self, department_id: str
    ) -> tuple[str, list[Any]]:
        """Build query to get parameter items for a single department."""
        query = """
            SELECT pi.id
            FROM parameter_items pi
            JOIN parameters p ON p.id = pi.parameter_id
            WHERE p.department_id = $1 AND pi.active = true
        """
        return (query, [department_id])

    def get_parameter_item_mapping(
        self, parameter_item_ids: list[str]
    ) -> tuple[str, list[Any]]:
        """Build query to get parameter item mapping."""
        query = """
            SELECT 
                pi.id,
                pi.name,
                COALESCE(pi.description, '') as description,
                pi.parameter_id,
                p.name as parameter_name
            FROM parameter_items pi
            JOIN parameters p ON p.id = pi.parameter_id
            WHERE pi.id = ANY($1)
        """
        return (query, [parameter_item_ids])

    def get_valid_parameter_items_for_departments(
        self, department_ids: list[str]
    ) -> tuple[str, list[Any]]:
        """Build query to get valid parameter items for multiple departments."""
        query = """
            SELECT pi.id
            FROM parameter_items pi
            JOIN parameters p ON p.id = pi.parameter_id
            WHERE p.department_id = ANY($1) AND pi.active = true
        """
        return (query, [department_ids])

    def get_document_info_with_path(self, document_id: str) -> tuple[str, list[Any]]:
        """Build query to get document info including file path."""
        query = """
        SELECT name, file_path FROM documents WHERE id = $1
        """
        return (query, [document_id])

    def get_documents_info_with_path(
        self, document_ids: list[str]
    ) -> tuple[str, list[Any]]:
        """Build query to get multiple documents info including file paths."""
        query = """
        SELECT id, name, file_path FROM documents WHERE id = ANY($1)
        """
        return (query, [document_ids])

    def insert_document(self) -> tuple[str, list[Any]]:
        """Build query to insert a new document."""
        query = """
        INSERT INTO documents (id, name, file_path, mime_type, department_id)
        VALUES ($1, $2, $3, $4, $5)
        """
        return (query, [])  # Parameters filled at execution time

    def get_document_file_info(self, document_id: str) -> tuple[str, list[Any]]:
        """Build query to get document file info for download."""
        query = """
        SELECT name, file_path, mime_type FROM documents WHERE id = $1
        """
        return (query, [document_id])
