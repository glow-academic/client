"""Document queries - SQL query builders."""

from typing import Any


class DocumentQueries:
    """Query builders for document operations."""

    def list_documents(
        self, department_ids: list[str], profile_id: str
    ) -> tuple[str, list[Any]]:
        """Build query for documents list with permissions and embedded mappings."""
        query = """
        WITH document_active_scenario_links AS (
            SELECT 
                sd.document_id,
                COUNT(*) as active_scenario_count
            FROM scenario_documents sd
            WHERE sd.active = true
            GROUP BY sd.document_id
        ),
        document_all_scenario_links AS (
            SELECT 
                sd.document_id,
                COUNT(*) as total_scenario_links
            FROM scenario_documents sd
            GROUP BY sd.document_id
        ),
        document_scenarios AS (
            SELECT 
                sd.document_id,
                ARRAY_AGG(DISTINCT st.parent_id) as scenario_ids
            FROM scenario_documents sd
            -- Join with scenario_tree to get root scenario for each linked scenario
            JOIN scenario_tree st ON st.child_id = sd.scenario_id AND st.parent_id = st.child_id
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
                ARRAY[]::uuid[] as parameter_item_ids,
                COALESCE(dasl.active_scenario_count, 0) as active_scenario_count,
                COALESCE(dasl_all.total_scenario_links, 0) as total_scenario_links
            FROM documents d
            LEFT JOIN document_scenarios ds ON ds.document_id = d.id
            LEFT JOIN document_active_scenario_links dasl ON dasl.document_id = d.id
            LEFT JOIN document_all_scenario_links dasl_all ON dasl_all.document_id = d.id
            WHERE d.department_id = ANY($1)
        ),
        user_profile AS (
            SELECT role FROM profiles WHERE id = $2
        ),
        all_scenario_ids AS (
            SELECT DISTINCT unnest(scenario_ids) as scenario_id
            FROM document_data
        ),
        scenario_mapping_data AS (
            SELECT COALESCE(
                jsonb_object_agg(
                    s.id::text,
                    jsonb_build_object(
                        'name', s.name,
                        'description', COALESCE(s.problem_statement, ''),
                        'active', s.active,
                        'persona_id', NULL,
                        'persona_mapping', '{}'::jsonb,
                        'document_mapping', '{}'::jsonb,
                        'parameter_item_mapping', '{}'::jsonb,
                        'parameter_item_ids', ARRAY[]::text[],
                        'document_ids', ARRAY[]::text[]
                    )
                ) FILTER (WHERE s.id IS NOT NULL AND st.parent_id IS NOT NULL),
                '{}'::jsonb
            ) as mapping
            FROM all_scenario_ids asi
            LEFT JOIN scenarios s ON s.id = asi.scenario_id
            -- Only include root scenarios (parent_id = child_id in scenario_tree)
            LEFT JOIN scenario_tree st ON st.parent_id = s.id AND st.child_id = s.id
        ),
        parameter_item_mapping_data AS (
            SELECT COALESCE(
                jsonb_object_agg(
                    pi.id::text,
                    jsonb_build_object(
                        'name', pi.name,
                        'description', COALESCE(pi.description, ''),
                        'parameter_id', pi.parameter_id::text,
                        'parameter_name', p.name
                    )
                ) FILTER (WHERE pi.id IS NOT NULL),
                '{}'::jsonb
            ) as mapping
            FROM parameter_items pi
            JOIN parameters p ON p.id = pi.parameter_id
            WHERE p.department_id = ANY($1)
        ),
        department_mapping_data AS (
            SELECT COALESCE(
                jsonb_object_agg(
                    d.id::text,
                    jsonb_build_object(
                        'name', d.title,
                        'description', COALESCE(d.description, '')
                    )
                ) FILTER (WHERE d.id IS NOT NULL),
                '{}'::jsonb
            ) as mapping
            FROM departments d
            WHERE d.id = ANY($1)
        )
        SELECT 
            dd.*,
            SUBSTRING(dd.mime_type FROM '\\.([^\\.]+)$') as extension,
            CASE 
                WHEN dd.active_scenario_count > 0 THEN false
                WHEN up.role IN ('admin', 'instructional', 'superadmin') THEN true
                ELSE false
            END as can_edit,
            CASE 
                WHEN dd.total_scenario_links > 0 THEN false
                WHEN up.role IN ('admin', 'instructional', 'superadmin') THEN true
                ELSE false
            END as can_delete,
            sm.mapping as scenario_mapping,
            pim.mapping as parameter_item_mapping,
            dm.mapping as department_mapping
        FROM document_data dd
        CROSS JOIN user_profile up
        CROSS JOIN scenario_mapping_data sm
        CROSS JOIN parameter_item_mapping_data pim
        CROSS JOIN department_mapping_data dm
        ORDER BY dd.updated_at DESC
        """

        return (query, [department_ids, profile_id])

    # get_tag_mapping removed - simulation_tags table dropped
    # Use get_parameter_item_mapping instead

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

    def get_document_detail_complete(
        self, document_id: str, profile_id: str
    ) -> tuple[str, list[Any]]:
        """Build optimized query to get document detail with all mappings in ONE query.

        Consolidates 5 queries into 1 using CTEs and JSONB aggregation.

        Args:
            document_id: UUID of the document
            profile_id: UUID of the profile for permissions

        Returns:
            Tuple of (query string, params list)
        """
        query = """
        WITH document_data AS (
            SELECT 
                d.name,
                d.active,
                d.type,
                d.department_id
            FROM documents d
            WHERE d.id = $1
        ),
        valid_depts AS (
            SELECT 
                COALESCE(
                    jsonb_object_agg(
                        d.id::text,
                        jsonb_build_object(
                            'name', d.title,
                            'description', COALESCE(d.description, '')
                        )
                    ),
                    '{}'::jsonb
                ) as dept_mapping,
                array_agg(d.id::text ORDER BY d.title) as dept_ids
            FROM departments d
            JOIN profile_departments pd ON d.id = pd.department_id
            WHERE pd.profile_id = $2 AND d.active = true
        ),
        valid_param_items AS (
            SELECT 
                COALESCE(
                    jsonb_object_agg(
                        pi.id::text,
                        jsonb_build_object(
                            'name', pi.name,
                            'description', COALESCE(pi.description, ''),
                            'parameter_id', pi.parameter_id::text,
                            'parameter_name', p.name
                        )
                    ),
                    '{}'::jsonb
                ) as param_item_mapping,
                array_agg(pi.id::text ORDER BY pi.name) as param_item_ids
            FROM parameter_items pi
            JOIN parameters p ON p.id = pi.parameter_id
            JOIN document_data dd ON p.department_id = dd.department_id
            WHERE p.active = true
        )
        SELECT 
            doc.*,
            vd.dept_mapping as department_mapping,
            vd.dept_ids as valid_department_ids,
            vpi.param_item_mapping as parameter_item_mapping,
            vpi.param_item_ids as valid_parameter_item_ids
        FROM document_data doc
        CROSS JOIN valid_depts vd
        CROSS JOIN valid_param_items vpi
        """
        return (query, [document_id, profile_id])

    def get_document_detail_bulk_complete(
        self, document_ids: list[str], profile_id: str
    ) -> tuple[str, list[Any]]:
        """Build optimized query to get bulk document detail with all mappings in ONE query.

        Consolidates multiple queries into 1 using CTEs and JSONB aggregation.

        Args:
            document_ids: List of document UUIDs
            profile_id: UUID of the profile for permissions

        Returns:
            Tuple of (query string, params list)
        """
        query = """
        WITH document_data AS (
            SELECT 
                d.id,
                d.type,
                d.department_id
            FROM documents d
            WHERE d.id = ANY($1)
        ),
        aggregated_data AS (
            SELECT 
                array_agg(DISTINCT type) as types,
                array_agg(DISTINCT department_id::text) as department_ids
            FROM document_data
        ),
        valid_depts AS (
            SELECT 
                COALESCE(
                    jsonb_object_agg(
                        d.id::text,
                        jsonb_build_object(
                            'name', d.title,
                            'description', COALESCE(d.description, '')
                        )
                    ),
                    '{}'::jsonb
                ) as dept_mapping,
                array_agg(d.id::text ORDER BY d.title) as dept_ids
            FROM departments d
            JOIN profile_departments pd ON d.id = pd.department_id
            WHERE pd.profile_id = $2 AND d.active = true
        ),
        doc_dept_ids AS (
            SELECT UNNEST(department_ids) as dept_id FROM aggregated_data
        ),
        valid_param_items AS (
            SELECT 
                COALESCE(
                    jsonb_object_agg(
                        pi.id::text,
                        jsonb_build_object(
                            'name', pi.name,
                            'description', COALESCE(pi.description, ''),
                            'parameter_id', pi.parameter_id::text,
                            'parameter_name', p.name
                        )
                    ),
                    '{}'::jsonb
                ) as param_item_mapping,
                array_agg(pi.id::text ORDER BY pi.name) as param_item_ids
            FROM parameter_items pi
            JOIN parameters p ON p.id = pi.parameter_id
            JOIN doc_dept_ids ddi ON p.department_id::text = ddi.dept_id
            WHERE p.active = true
        )
        SELECT 
            ad.types,
            ad.department_ids,
            vd.dept_mapping as department_mapping,
            vd.dept_ids as valid_department_ids,
            vpi.param_item_mapping as parameter_item_mapping,
            vpi.param_item_ids as valid_parameter_item_ids
        FROM aggregated_data ad
        CROSS JOIN valid_depts vd
        CROSS JOIN valid_param_items vpi
        """
        return (query, [document_ids, profile_id])
