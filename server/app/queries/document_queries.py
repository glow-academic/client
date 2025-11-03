"""Document queries - SQL query builders."""

from typing import Any


class DocumentQueries:
    """Query builders for document operations."""

    def list_documents(
        self, profile_id: str
    ) -> tuple[str, list[Any]]:
        """Build query for documents list with permissions and embedded mappings."""
        query = """
        WITH user_departments AS (
            SELECT department_id
            FROM profile_departments
            WHERE profile_id = $1 AND active = true
        ),
        document_active_scenario_links AS (
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
        document_parameter_items_cte AS (
            SELECT 
                dpi.document_id,
                ARRAY_AGG(dpi.parameter_item_id) as parameter_item_ids
            FROM document_parameter_items dpi
            WHERE dpi.active = true
            GROUP BY dpi.document_id
        ),
        document_departments_data AS (
            SELECT 
                dd.document_id,
                ARRAY_AGG(dd.department_id::text ORDER BY dd.created_at) as department_ids
            FROM document_departments dd
            WHERE dd.active = true
            GROUP BY dd.document_id
        ),
        document_data AS (
            SELECT 
                d.id as document_id,
                d.name,
                d.type,
                d.updated_at,
                d.mime_type,
                d.active,
                d.file_path,
                COALESCE(ddd.department_ids, NULL) as department_ids,
                COALESCE(ds.scenario_ids, ARRAY[]::uuid[]) as scenario_ids,
                COALESCE(dpic.parameter_item_ids, ARRAY[]::uuid[]) as parameter_item_ids,
                COALESCE(dasl.active_scenario_count, 0) as active_scenario_count,
                COALESCE(dasl_all.total_scenario_links, 0) as total_scenario_links
            FROM documents d
            LEFT JOIN document_departments dd ON dd.document_id = d.id AND dd.active = true
            LEFT JOIN document_departments_data ddd ON ddd.document_id = d.id
            LEFT JOIN document_scenarios ds ON ds.document_id = d.id
            LEFT JOIN document_parameter_items_cte dpic ON dpic.document_id = d.id
            LEFT JOIN document_active_scenario_links dasl ON dasl.document_id = d.id
            LEFT JOIN document_all_scenario_links dasl_all ON dasl_all.document_id = d.id
            GROUP BY d.id, d.name, d.type, d.updated_at, d.mime_type, d.active, d.file_path, 
                     ddd.department_ids, ds.scenario_ids, dpic.parameter_item_ids, dasl.active_scenario_count, dasl_all.total_scenario_links
            HAVING 
                -- Include if has matching department link OR has no department links at all (cross-dept)
                COUNT(dd.document_id) FILTER (WHERE dd.department_id IN (SELECT department_id FROM user_departments)) > 0
                OR NOT EXISTS (SELECT 1 FROM document_departments dd2 WHERE dd2.document_id = d.id AND dd2.active = true)
        ),
        user_profile AS (
            SELECT role FROM profiles WHERE id = $1
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
                        'description', COALESCE(sps.problem_statement, ''),
                        'active', s.active,
                        'persona_id', NULL,
                        'persona_mapping', '{}'::jsonb,
                        'document_mapping', '{}'::jsonb,
                        'parameter_item_mapping', '{}'::jsonb,
                        'parameter_item_ids', ARRAY[]::text[],
                        'document_ids', ARRAY[]::text[]
                    )
                ) FILTER (WHERE s.id IS NOT NULL),
                '{}'::jsonb
            ) as mapping
            FROM all_scenario_ids asi
            LEFT JOIN scenarios s ON s.id = asi.scenario_id
            LEFT JOIN scenario_problem_statements sps ON sps.scenario_id = s.id AND sps.active = true
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
                        'parameter_name', pi.parameter_name,
                        'value', COALESCE(pi.value, '')
                    )
                ) FILTER (WHERE pi.id IS NOT NULL),
                '{}'::jsonb
            ) as mapping
            FROM (
                SELECT DISTINCT
                    pi.id,
                    pi.name,
                    pi.description,
                    pi.value,
                    pi.parameter_id,
                    p.name as parameter_name
                FROM parameter_items pi
                JOIN parameters p ON p.id = pi.parameter_id
                LEFT JOIN parameter_item_departments pid ON pid.parameter_item_id = pi.id AND pid.active = true
                WHERE p.active = true
                GROUP BY pi.id, pi.name, pi.description, pi.value, pi.parameter_id, p.name
                HAVING 
                    -- Include if has matching department link OR has no department links at all (cross-dept)
                    COUNT(pid.parameter_item_id) FILTER (WHERE pid.department_id IN (SELECT department_id FROM user_departments)) > 0
                    OR NOT EXISTS (SELECT 1 FROM parameter_item_departments pid2 WHERE pid2.parameter_item_id = pi.id AND pid2.active = true)
            ) pi
        ),
        department_parameter_ids AS (
            SELECT 
                d.id as department_id,
                COALESCE(ARRAY_AGG(DISTINCT p.id::text) FILTER (WHERE p.id IS NOT NULL), ARRAY[]::text[]) as parameter_ids
            FROM departments d
            LEFT JOIN parameters p ON p.active = true
            LEFT JOIN parameter_items pi ON pi.parameter_id = p.id
            LEFT JOIN parameter_item_departments pid ON pid.parameter_item_id = pi.id AND pid.active = true
            WHERE d.id IN (SELECT department_id FROM user_departments)
            AND (pid.department_id = d.id OR NOT EXISTS (SELECT 1 FROM parameter_item_departments pid2 
                                                         JOIN parameter_items pi2 ON pi2.id = pid2.parameter_item_id 
                                                         WHERE pi2.parameter_id = p.id AND pid2.active = true))
            GROUP BY d.id
        ),
        department_parameter_item_ids AS (
            SELECT 
                d.id as department_id,
                COALESCE(ARRAY_AGG(pi.id::text ORDER BY pi.id) FILTER (WHERE pi.id IS NOT NULL), ARRAY[]::text[]) as parameter_item_ids
            FROM departments d
            LEFT JOIN parameter_items pi ON true
            LEFT JOIN parameters p ON p.id = pi.parameter_id AND p.active = true
            LEFT JOIN parameter_item_departments pid ON pid.parameter_item_id = pi.id AND pid.active = true
            WHERE d.id IN (SELECT department_id FROM user_departments)
            AND p.id IS NOT NULL  -- Only include items from active parameters
            AND (
                -- Include parameter item if linked to this specific department
                pid.department_id = d.id 
                -- OR parameter item is cross-department (no department links) - include in all departments
                OR NOT EXISTS (SELECT 1 FROM parameter_item_departments pid2 WHERE pid2.parameter_item_id = pi.id AND pid2.active = true)
            )
            GROUP BY d.id
        ),
        department_mapping_data AS (
            SELECT COALESCE(
                jsonb_object_agg(
                    d.id::text,
                    jsonb_build_object(
                        'name', d.title,
                        'description', COALESCE(d.description, ''),
                        'parameter_ids', CASE WHEN dparami.parameter_ids IS NOT NULL AND array_length(dparami.parameter_ids, 1) > 0 THEN to_jsonb(dparami.parameter_ids) ELSE NULL END,
                        'parameter_item_ids', CASE WHEN dparamitems.parameter_item_ids IS NOT NULL AND array_length(dparamitems.parameter_item_ids, 1) > 0 THEN to_jsonb(dparamitems.parameter_item_ids) ELSE NULL END
                    )
                ) FILTER (WHERE d.id IS NOT NULL),
                '{}'::jsonb
            ) as mapping
            FROM departments d
            LEFT JOIN department_parameter_ids dparami ON dparami.department_id = d.id
            LEFT JOIN department_parameter_item_ids dparamitems ON dparamitems.department_id = d.id
            WHERE d.id IN (SELECT department_id FROM user_departments)
        ),
        parameter_data AS (
            SELECT DISTINCT 
                p.id,
                p.name,
                COALESCE(p.description, '') as description,
                p.numerical,
                p.document_parameter
            FROM parameters p
            JOIN parameter_items pi ON pi.parameter_id = p.id
            LEFT JOIN parameter_item_departments pid ON pid.parameter_item_id = pi.id AND pid.active = true
            WHERE p.active = true
            GROUP BY p.id, p.name, p.description, p.numerical, p.document_parameter
            HAVING 
                -- Include if has matching department link via parameter_items OR has no department links at all (cross-dept)
                COUNT(pid.parameter_item_id) FILTER (WHERE pid.department_id IN (SELECT department_id FROM user_departments)) > 0
                OR NOT EXISTS (SELECT 1 FROM parameter_item_departments pid2 
                              JOIN parameter_items pi2 ON pi2.id = pid2.parameter_item_id 
                              WHERE pi2.parameter_id = p.id AND pid2.active = true)
            ORDER BY p.name
        ),
        parameter_mapping_data AS (
            SELECT COALESCE(
                jsonb_object_agg(
                    p.id::text,
                    jsonb_build_object(
                        'name', p.name,
                        'description', p.description,
                        'numerical', p.numerical,
                        'document_parameter', p.document_parameter
                    )
                ),
                '{}'::jsonb
            ) as mapping
            FROM parameter_data p
        )
        SELECT 
            dd.*,
            SUBSTRING(dd.file_path FROM '\\.([^\\.]+)$') as extension,
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
            dm.mapping as department_mapping,
            pm.mapping as parameter_mapping
        FROM document_data dd
        CROSS JOIN user_profile up
        CROSS JOIN scenario_mapping_data sm
        CROSS JOIN parameter_item_mapping_data pim
        CROSS JOIN department_mapping_data dm
        CROSS JOIN parameter_mapping_data pm
        ORDER BY dd.updated_at DESC
        """

        return (query, [profile_id])

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
        LEFT JOIN parameter_item_departments pid ON pid.parameter_item_id = pi.id AND pid.active = true
        WHERE p.active = true
        GROUP BY pi.id, pi.name, pi.value, pi.parameter_id
        HAVING 
            -- Include if has matching department link OR has no department links at all (cross-dept)
            COUNT(pid.parameter_item_id) FILTER (WHERE pid.department_id = ANY($1)) > 0
            OR NOT EXISTS (SELECT 1 FROM parameter_item_departments pid2 WHERE pid2.parameter_item_id = pi.id AND pid2.active = true)
        ORDER BY pi.name
        """
        return (query, [dept_ids])

    def get_documents_by_ids(self, document_ids: list[str]) -> tuple[str, list[Any]]:
        """Build query to get multiple documents."""
        query = """
        SELECT 
            d.id,
            d.type
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
            LEFT JOIN parameter_item_departments pid ON pid.parameter_item_id = pi.id AND pid.active = true
            WHERE p.active = true
            GROUP BY pi.id, pi.name, pi.description, pi.parameter_id, p.name
            HAVING 
                -- Include if has matching department link OR has no department links at all (cross-dept)
                COUNT(pid.parameter_item_id) FILTER (WHERE pid.department_id = ANY($1)) > 0
                OR NOT EXISTS (SELECT 1 FROM parameter_item_departments pid2 WHERE pid2.parameter_item_id = pi.id AND pid2.active = true)
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
        """Build query to insert a new document.
        
        Params order: id, name, file_path, mime_type
        """
        query = """
        INSERT INTO documents (id, name, file_path, mime_type)
        VALUES ($1, $2, $3, $4)
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
                (SELECT ARRAY_AGG(dd.department_id::text) FROM document_departments dd WHERE dd.document_id = d.id AND dd.active = true) as department_ids
            FROM documents d
            WHERE d.id = $1
        ),
        user_departments AS (
            SELECT DISTINCT d.id, d.title as name, d.description
            FROM departments d
            JOIN profile_departments pd ON d.id = pd.department_id
            WHERE pd.profile_id = $2 AND d.active = true
        ),
        department_parameter_ids AS (
            SELECT 
                ud.id as department_id,
                COALESCE(ARRAY_AGG(DISTINCT p.id::text) FILTER (WHERE p.id IS NOT NULL), ARRAY[]::text[]) as parameter_ids
            FROM user_departments ud
            LEFT JOIN parameters p ON p.active = true
            LEFT JOIN parameter_items pi ON pi.parameter_id = p.id
            LEFT JOIN parameter_item_departments pid ON pid.parameter_item_id = pi.id AND pid.active = true
            WHERE (pid.department_id = ud.id OR NOT EXISTS (SELECT 1 FROM parameter_item_departments pid2 
                                                             JOIN parameter_items pi2 ON pi2.id = pid2.parameter_item_id 
                                                             WHERE pi2.parameter_id = p.id AND pid2.active = true))
            GROUP BY ud.id
        ),
        valid_depts AS (
            SELECT 
                COALESCE(
                    jsonb_object_agg(
                        ud.id::text,
                        jsonb_build_object(
                            'name', ud.name,
                            'description', COALESCE(ud.description, ''),
                            'parameter_ids', CASE WHEN dparami.parameter_ids IS NOT NULL AND array_length(dparami.parameter_ids, 1) > 0 THEN to_jsonb(dparami.parameter_ids) ELSE NULL END
                        )
                    ),
                    '{}'::jsonb
                ) as dept_mapping,
                array_agg(ud.id::text ORDER BY ud.name) as dept_ids
            FROM user_departments ud
            LEFT JOIN department_parameter_ids dparami ON dparami.department_id = ud.id
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
            CROSS JOIN document_data dd
            LEFT JOIN parameter_item_departments pid ON pid.parameter_item_id = pi.id AND pid.active = true
            WHERE p.active = true
              AND (
                  -- Document has no department links (cross-department) -> show items with no department links
                  (dd.department_ids IS NULL OR array_length(dd.department_ids, 1) = 0)
                  AND NOT EXISTS (SELECT 1 FROM parameter_item_departments pid2 WHERE pid2.parameter_item_id = pi.id AND pid2.active = true)
              )
              OR (
                  -- Document has department links -> show items linked to same departments
                  dd.department_ids IS NOT NULL 
                  AND array_length(dd.department_ids, 1) > 0
                  AND pid.department_id = ANY(SELECT unnest(dd.department_ids)::uuid)
              )
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
        user_departments AS (
            SELECT DISTINCT d.id, d.title as name, d.description
            FROM departments d
            JOIN profile_departments pd ON d.id = pd.department_id
            WHERE pd.profile_id = $2 AND d.active = true
        ),
        department_parameter_ids AS (
            SELECT 
                ud.id as department_id,
                COALESCE(ARRAY_AGG(DISTINCT p.id::text) FILTER (WHERE p.id IS NOT NULL), ARRAY[]::text[]) as parameter_ids
            FROM user_departments ud
            LEFT JOIN parameters p ON p.active = true
            LEFT JOIN parameter_items pi ON pi.parameter_id = p.id
            LEFT JOIN parameter_item_departments pid ON pid.parameter_item_id = pi.id AND pid.active = true
            WHERE (pid.department_id = ud.id OR NOT EXISTS (SELECT 1 FROM parameter_item_departments pid2 
                                                             JOIN parameter_items pi2 ON pi2.id = pid2.parameter_item_id 
                                                             WHERE pi2.parameter_id = p.id AND pid2.active = true))
            GROUP BY ud.id
        ),
        valid_depts AS (
            SELECT 
                COALESCE(
                    jsonb_object_agg(
                        ud.id::text,
                        jsonb_build_object(
                            'name', ud.name,
                            'description', COALESCE(ud.description, ''),
                            'parameter_ids', CASE WHEN dparami.parameter_ids IS NOT NULL AND array_length(dparami.parameter_ids, 1) > 0 THEN to_jsonb(dparami.parameter_ids) ELSE NULL END
                        )
                    ),
                    '{}'::jsonb
                ) as dept_mapping,
                array_agg(ud.id::text ORDER BY ud.name) as dept_ids
            FROM user_departments ud
            LEFT JOIN department_parameter_ids dparami ON dparami.department_id = ud.id
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
