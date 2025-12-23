WITH params AS (
    -- Explicitly cast all parameters for asyncpg type inference
    -- Parameters: $1=profileId (uuid), $2=useImage (boolean, unused), $3=useObjectives (boolean, unused),
    --             $4=documentIds (uuid[]), $5=problemStatementIds (uuid[]), $6=templateDocumentIds (uuid[]),
    --             $7=objectiveIds (uuid[]), $8=imageIds (uuid[]), $9=useVideo (boolean, for video parameter filtering)
    SELECT 
        $1::uuid as profile_id,
        $2::boolean as use_image,
        $3::boolean as use_objectives,
        $4::uuid[] as document_ids,
        $5::uuid[] as problem_statement_ids,
        $6::uuid[] as template_document_ids,
        $7::uuid[] as objective_ids,
        $8::uuid[] as image_ids,
        $9::boolean as use_video
),
user_profile AS (
    SELECT 
        first_name || ' ' || last_name as actor_name,
        role as user_role
    FROM profiles WHERE id = $1
),
user_departments AS (
    SELECT DISTINCT d.id
    FROM departments d
    JOIN profile_departments pd ON pd.department_id = d.id
    CROSS JOIN params p
    WHERE pd.profile_id = p.profile_id AND pd.active = true AND d.active = true
),
department_persona_ids AS (
    SELECT 
        d.id as department_id,
        COALESCE(ARRAY_AGG(p.id::text ORDER BY p.id) FILTER (WHERE p.id IS NOT NULL), ARRAY[]::text[]) as persona_ids
    FROM departments d
    INNER JOIN user_departments ud ON d.id = ud.id
    LEFT JOIN personas p ON p.active = true
    LEFT JOIN persona_departments pd ON pd.persona_id = p.id AND pd.active = true
    WHERE (
        pd.department_id = d.id 
        OR NOT EXISTS (SELECT 1 FROM persona_departments pd2 WHERE pd2.persona_id = p.id AND pd2.active = true)
    )
    GROUP BY d.id
),
department_document_ids AS (
    SELECT 
        d.id as department_id,
        COALESCE(ARRAY_AGG(doc.id::text ORDER BY doc.id) FILTER (WHERE doc.id IS NOT NULL), ARRAY[]::text[]) as document_ids
    FROM departments d
    INNER JOIN user_departments ud ON d.id = ud.id
    LEFT JOIN documents doc ON doc.active = true
    LEFT JOIN document_departments dd ON dd.document_id = doc.id AND dd.active = true
    WHERE (dd.department_id = d.id OR NOT EXISTS (SELECT 1 FROM document_departments dd2 WHERE dd2.document_id = doc.id AND dd2.active = true))
    GROUP BY d.id
),
department_parameter_ids AS (
    SELECT 
        d.id as department_id,
        COALESCE(ARRAY_AGG(DISTINCT p.id::text) FILTER (WHERE p.id IS NOT NULL), ARRAY[]::text[]) as parameter_ids
    FROM departments d
    INNER JOIN user_departments ud ON d.id = ud.id
    LEFT JOIN parameters p ON p.active = true
    LEFT JOIN parameter_fields pf ON pf.parameter_id = p.id AND pf.active = true
    LEFT JOIN field_departments fd ON fd.field_id = pf.field_id AND fd.active = true
    WHERE (fd.department_id = d.id OR NOT EXISTS (SELECT 1 FROM field_departments fd2 
                                                 JOIN parameter_fields pf2 ON pf2.field_id = fd2.field_id 
                                                 WHERE pf2.parameter_id = p.id AND pf2.active = true AND fd2.active = true))
    GROUP BY d.id
),
department_parameter_item_ids AS (
    SELECT 
        d.id as department_id,
        COALESCE(ARRAY_AGG(f.id::text ORDER BY f.id) FILTER (WHERE f.id IS NOT NULL), ARRAY[]::text[]) as parameter_item_ids
    FROM departments d
    INNER JOIN user_departments ud ON d.id = ud.id
    LEFT JOIN fields f ON true
    LEFT JOIN field_departments fd ON fd.field_id = f.id AND fd.active = true
    WHERE (
        fd.department_id = d.id 
        OR NOT EXISTS (SELECT 1 FROM field_departments fd2 WHERE fd2.field_id = f.id AND fd2.active = true)
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
                'persona_ids', CASE WHEN dpi.persona_ids IS NOT NULL AND array_length(dpi.persona_ids, 1) > 0 THEN to_jsonb(dpi.persona_ids) ELSE NULL END,
                'document_ids', CASE WHEN ddi.document_ids IS NOT NULL AND array_length(ddi.document_ids, 1) > 0 THEN to_jsonb(ddi.document_ids) ELSE NULL END,
                'parameter_ids', CASE WHEN dparami.parameter_ids IS NOT NULL AND array_length(dparami.parameter_ids, 1) > 0 THEN to_jsonb(dparami.parameter_ids) ELSE NULL END,
                'parameter_item_ids', CASE WHEN dparamitems.parameter_item_ids IS NOT NULL AND array_length(dparamitems.parameter_item_ids, 1) > 0 THEN to_jsonb(dparamitems.parameter_item_ids) ELSE NULL END
            )
        ),
        '{}'::jsonb
    ) as mapping
    FROM departments d
    INNER JOIN user_departments ud ON d.id = ud.id
    LEFT JOIN department_persona_ids dpi ON dpi.department_id = d.id
    LEFT JOIN department_document_ids ddi ON ddi.department_id = d.id
    LEFT JOIN department_parameter_ids dparami ON dparami.department_id = d.id
    LEFT JOIN department_parameter_item_ids dparamitems ON dparamitems.department_id = d.id
),
persona_data AS (
    SELECT 
        p.id,
        p.name,
        COALESCE(p.description, '') as description,
        p.color,
        p.icon,
        false as image_model  -- No longer checking via persona agents
    FROM personas p
    LEFT JOIN persona_departments pd ON pd.persona_id = p.id AND pd.active = true
    WHERE p.active = true
    GROUP BY p.id, p.name, p.description, p.color, p.icon
    HAVING 
        (
            COUNT(pd.persona_id) FILTER (WHERE pd.department_id IN (SELECT id FROM user_departments)) > 0
            OR NOT EXISTS (SELECT 1 FROM persona_departments pd2 WHERE pd2.persona_id = p.id AND pd2.active = true)
        )
        AND (
            CASE 
                WHEN (SELECT use_video FROM params LIMIT 1) = true THEN
                    -- Include video_parameter OR general parameters
                    EXISTS (
                        SELECT 1 
                        FROM persona_fields pf
                        JOIN parameter_fields pfield ON pfield.field_id = pf.field_id
                        JOIN parameters param ON param.id = pfield.parameter_id
                        WHERE pf.persona_id = p.id
                        AND pf.active = true
                        AND pfield.active = true
                        AND param.active = true
                        AND param.video_parameter = true
                    )
                    OR EXISTS (
                        SELECT 1 
                        FROM persona_fields pf
                        JOIN field_conditional_parameters fcp ON fcp.field_id = pf.field_id
                        JOIN parameters cp ON cp.id = fcp.conditional_parameter_id
                        WHERE pf.persona_id = p.id
                        AND pf.active = true
                        AND fcp.active = true
                        AND cp.video_parameter = true
                    )
                    OR EXISTS (
                        SELECT 1 
                        FROM persona_fields pf
                        JOIN parameter_fields pfield ON pfield.field_id = pf.field_id
                        JOIN parameters param ON param.id = pfield.parameter_id
                        WHERE pf.persona_id = p.id
                        AND pf.active = true
                        AND pfield.active = true
                        AND param.active = true
                        AND param.video_parameter = false
                        AND param.scenario_parameter = false
                    )
                ELSE
                    -- Include scenario_parameter OR general parameters
                    EXISTS (
                        SELECT 1 
                        FROM persona_fields pf
                        JOIN parameter_fields pfield ON pfield.field_id = pf.field_id
                        JOIN parameters param ON param.id = pfield.parameter_id
                        WHERE pf.persona_id = p.id
                        AND pf.active = true
                        AND pfield.active = true
                        AND param.active = true
                        AND param.scenario_parameter = true
                    )
                    OR EXISTS (
                        SELECT 1 
                        FROM persona_fields pf
                        JOIN field_conditional_parameters fcp ON fcp.field_id = pf.field_id
                        JOIN parameters cp ON cp.id = fcp.conditional_parameter_id
                        WHERE pf.persona_id = p.id
                        AND pf.active = true
                        AND fcp.active = true
                        AND cp.scenario_parameter = true
                    )
                    OR EXISTS (
                        SELECT 1 
                        FROM persona_fields pf
                        JOIN parameter_fields pfield ON pfield.field_id = pf.field_id
                        JOIN parameters param ON param.id = pfield.parameter_id
                        WHERE pf.persona_id = p.id
                        AND pf.active = true
                        AND pfield.active = true
                        AND param.active = true
                        AND param.video_parameter = false
                        AND param.scenario_parameter = false
                    )
            END
        )
    ORDER BY p.name
),
-- Persona parameter relationships: via fields (persona_fields → parameter_fields) and persona_parameter flag
-- Note: parameter_personas junction table removed - use persona_parameter boolean flag instead
persona_parameter_relationships AS (
    SELECT DISTINCT
        p.id as persona_id,
        param.id as parameter_id
    FROM persona_data p
    CROSS JOIN parameters param
    WHERE param.active = true
    AND param.persona_parameter = true
    AND (
        -- Indirect relationship via persona_fields → parameter_fields
        EXISTS (
            SELECT 1 FROM persona_fields pf
            JOIN parameter_fields pfield ON pfield.field_id = pf.field_id
            WHERE pf.persona_id = p.id
            AND pfield.parameter_id = param.id
            AND pf.active = true
            AND pfield.active = true
        )
        -- If parameter has persona_parameter flag, it's valid for all personas (no junction table restrictions)
    )
),
persona_parameter_mapping AS (
    SELECT COALESCE(
        jsonb_object_agg(
            ppr.persona_id::text,
            COALESCE(
                (SELECT jsonb_agg(ppr2.parameter_id::text ORDER BY ppr2.parameter_id)
                 FROM persona_parameter_relationships ppr2
                 WHERE ppr2.persona_id = ppr.persona_id),
                '[]'::jsonb
            )
        ),
        '{}'::jsonb
    ) as mapping
    FROM persona_parameter_relationships ppr
),
persona_examples_data AS (
    -- Get top example per persona (ordered by idx, take first)
    SELECT DISTINCT ON (pe.persona_id)
        pe.persona_id,
        e.example
    FROM persona_examples pe
    JOIN examples e ON e.id = pe.example_id
    WHERE pe.persona_id IN (SELECT id FROM persona_data)
    ORDER BY pe.persona_id, pe.idx
),
persona_mapping_data AS (
    SELECT COALESCE(
        jsonb_object_agg(
            p.id::text,
            jsonb_build_object(
                'name', p.name,
                'description', p.description,
                'color', p.color,
                'icon', p.icon,
                'image_model', COALESCE(p.image_model, false),
                'parameter_ids', COALESCE(
                    (SELECT jsonb_agg(ppr.parameter_id::text ORDER BY ppr.parameter_id)
                     FROM persona_parameter_relationships ppr
                     WHERE ppr.persona_id = p.id),
                    '[]'::jsonb
                ),
                'field_ids', COALESCE(
                    (SELECT jsonb_agg(pf.field_id::text ORDER BY pf.field_id)
                     FROM persona_fields pf
                     WHERE pf.persona_id = p.id AND pf.active = true),
                    '[]'::jsonb
                ),
                'example', CASE WHEN ped.example IS NOT NULL THEN ped.example ELSE NULL END
            )
        ),
        '{}'::jsonb
    ) as mapping
    FROM persona_data p
    LEFT JOIN persona_examples_data ped ON ped.persona_id = p.id
),
document_data AS (
    -- Department-filtered documents
    SELECT 
        d.id,
        d.name,
        ''::text as description
    FROM documents d
    LEFT JOIN document_departments dd ON dd.document_id = d.id AND dd.active = true
    WHERE d.active = true
    GROUP BY d.id, d.name
    HAVING 
        (
            COUNT(dd.document_id) FILTER (WHERE dd.department_id IN (SELECT id FROM user_departments)) > 0
            OR NOT EXISTS (SELECT 1 FROM document_departments dd2 WHERE dd2.document_id = d.id AND dd2.active = true)
        )
        AND (
            CASE 
                WHEN (SELECT use_video FROM params LIMIT 1) = true THEN
                    -- Include ONLY video_parameter relationships (direct or conditional)
                    -- Do NOT include general parameters for documents
                    EXISTS (
                        SELECT 1 
                        FROM document_fields df
                        JOIN parameter_fields pfield ON pfield.field_id = df.field_id
                        JOIN parameters param ON param.id = pfield.parameter_id
                        WHERE df.document_id = d.id
                        AND df.active = true
                        AND pfield.active = true
                        AND param.active = true
                        AND param.video_parameter = true
                    )
                    OR EXISTS (
                        SELECT 1 
                        FROM document_fields df
                        JOIN field_conditional_parameters fcp ON fcp.field_id = df.field_id
                        JOIN parameters cp ON cp.id = fcp.conditional_parameter_id
                        WHERE df.document_id = d.id
                        AND df.active = true
                        AND fcp.active = true
                        AND cp.video_parameter = true
                    )
                ELSE
                    -- Include scenario_parameter OR general parameters
                    EXISTS (
                        SELECT 1 
                        FROM document_fields df
                        JOIN parameter_fields pfield ON pfield.field_id = df.field_id
                        JOIN parameters param ON param.id = pfield.parameter_id
                        WHERE df.document_id = d.id
                        AND df.active = true
                        AND pfield.active = true
                        AND param.active = true
                        AND param.scenario_parameter = true
                    )
                    OR EXISTS (
                        SELECT 1 
                        FROM document_fields df
                        JOIN field_conditional_parameters fcp ON fcp.field_id = df.field_id
                        JOIN parameters cp ON cp.id = fcp.conditional_parameter_id
                        WHERE df.document_id = d.id
                        AND df.active = true
                        AND fcp.active = true
                        AND cp.scenario_parameter = true
                    )
                    OR EXISTS (
                        SELECT 1 
                        FROM document_fields df
                        JOIN parameter_fields pfield ON pfield.field_id = df.field_id
                        JOIN parameters param ON param.id = pfield.parameter_id
                        WHERE df.document_id = d.id
                        AND df.active = true
                        AND pfield.active = true
                        AND param.active = true
                        AND param.video_parameter = false
                        AND param.scenario_parameter = false
                    )
            END
        )
    UNION
    -- Include provided documentIds even if they don't match department filters
    SELECT DISTINCT
        d.id,
        d.name,
        ''::text as description
    FROM documents d
    WHERE d.active = true
    AND $4::uuid[] IS NOT NULL
    AND array_length($4::uuid[], 1) > 0
    AND d.id = ANY($4::uuid[])
    AND (
        CASE 
            WHEN (SELECT use_video FROM params LIMIT 1) = true THEN
                -- Include ONLY video_parameter relationships (direct or conditional)
                -- Do NOT include general parameters for documents
                EXISTS (
                    SELECT 1 
                    FROM document_fields df
                    JOIN parameter_fields pfield ON pfield.field_id = df.field_id
                    JOIN parameters param ON param.id = pfield.parameter_id
                    WHERE df.document_id = d.id
                    AND df.active = true
                    AND pfield.active = true
                    AND param.active = true
                    AND param.video_parameter = true
                )
                OR EXISTS (
                    SELECT 1 
                    FROM document_fields df
                    JOIN field_conditional_parameters fcp ON fcp.field_id = df.field_id
                    JOIN parameters cp ON cp.id = fcp.conditional_parameter_id
                    WHERE df.document_id = d.id
                    AND df.active = true
                    AND fcp.active = true
                    AND cp.video_parameter = true
                )
            ELSE
                -- Include scenario_parameter OR general parameters
                EXISTS (
                    SELECT 1 
                    FROM document_fields df
                    JOIN parameter_fields pfield ON pfield.field_id = df.field_id
                    JOIN parameters param ON param.id = pfield.parameter_id
                    WHERE df.document_id = d.id
                    AND df.active = true
                    AND pfield.active = true
                    AND param.active = true
                    AND param.scenario_parameter = true
                )
                OR EXISTS (
                    SELECT 1 
                    FROM document_fields df
                    JOIN field_conditional_parameters fcp ON fcp.field_id = df.field_id
                    JOIN parameters cp ON cp.id = fcp.conditional_parameter_id
                    WHERE df.document_id = d.id
                    AND df.active = true
                    AND fcp.active = true
                    AND cp.scenario_parameter = true
                )
                OR EXISTS (
                    SELECT 1 
                    FROM document_fields df
                    JOIN parameter_fields pfield ON pfield.field_id = df.field_id
                    JOIN parameters param ON param.id = pfield.parameter_id
                    WHERE df.document_id = d.id
                    AND df.active = true
                    AND pfield.active = true
                    AND param.active = true
                    AND param.video_parameter = false
                    AND param.scenario_parameter = false
                )
        END
    )
    UNION
    -- Include provided templateDocumentIds even if they don't match department filters
    SELECT DISTINCT
        d.id,
        d.name,
        ''::text as description
    FROM documents d
    WHERE d.active = true
    AND $6::uuid[] IS NOT NULL
    AND array_length($6::uuid[], 1) > 0
    AND d.id = ANY($6::uuid[])
    AND (
        CASE 
            WHEN (SELECT use_video FROM params LIMIT 1) = true THEN
                -- Include ONLY video_parameter relationships (direct or conditional)
                -- Do NOT include general parameters for documents
                EXISTS (
                    SELECT 1 
                    FROM document_fields df
                    JOIN parameter_fields pfield ON pfield.field_id = df.field_id
                    JOIN parameters param ON param.id = pfield.parameter_id
                    WHERE df.document_id = d.id
                    AND df.active = true
                    AND pfield.active = true
                    AND param.active = true
                    AND param.video_parameter = true
                )
                OR EXISTS (
                    SELECT 1 
                    FROM document_fields df
                    JOIN field_conditional_parameters fcp ON fcp.field_id = df.field_id
                    JOIN parameters cp ON cp.id = fcp.conditional_parameter_id
                    WHERE df.document_id = d.id
                    AND df.active = true
                    AND fcp.active = true
                    AND cp.video_parameter = true
                )
            ELSE
                -- Include scenario_parameter OR general parameters
                EXISTS (
                    SELECT 1 
                    FROM document_fields df
                    JOIN parameter_fields pfield ON pfield.field_id = df.field_id
                    JOIN parameters param ON param.id = pfield.parameter_id
                    WHERE df.document_id = d.id
                    AND df.active = true
                    AND pfield.active = true
                    AND param.active = true
                    AND param.scenario_parameter = true
                )
                OR EXISTS (
                    SELECT 1 
                    FROM document_fields df
                    JOIN field_conditional_parameters fcp ON fcp.field_id = df.field_id
                    JOIN parameters cp ON cp.id = fcp.conditional_parameter_id
                    WHERE df.document_id = d.id
                    AND df.active = true
                    AND fcp.active = true
                    AND cp.scenario_parameter = true
                )
                OR EXISTS (
                    SELECT 1 
                    FROM document_fields df
                    JOIN parameter_fields pfield ON pfield.field_id = df.field_id
                    JOIN parameters param ON param.id = pfield.parameter_id
                    WHERE df.document_id = d.id
                    AND df.active = true
                    AND pfield.active = true
                    AND param.active = true
                    AND param.video_parameter = false
                    AND param.scenario_parameter = false
                )
        END
    )
    ORDER BY name
),
-- Document parameter relationships: via fields (document_fields → parameter_fields) and document_parameter flag
-- Note: parameter_documents junction table removed - use document_parameter boolean flag instead
document_parameter_relationships AS (
    SELECT DISTINCT
        d.id as document_id,
        param.id as parameter_id
    FROM document_data d
    CROSS JOIN parameters param
    WHERE param.active = true
    AND param.document_parameter = true
    AND (
        -- Indirect relationship via document_fields → parameter_fields
        EXISTS (
            SELECT 1 FROM document_fields df
            JOIN parameter_fields pfield ON pfield.field_id = df.field_id
            WHERE df.document_id = d.id
            AND pfield.parameter_id = param.id
            AND df.active = true
            AND pfield.active = true
        )
        -- If parameter has document_parameter flag, it's valid for all documents (no junction table restrictions)
    )
),
document_mapping_data AS (
    SELECT COALESCE(
        jsonb_object_agg(
            d.id::text,
            jsonb_build_object(
                'name', d.name,
                'description', d.description,
                'parameter_ids', COALESCE(
                    (SELECT jsonb_agg(dpr.parameter_id::text ORDER BY dpr.parameter_id)
                     FROM document_parameter_relationships dpr
                     WHERE dpr.document_id = d.id),
                    '[]'::jsonb
                ),
                'field_ids', COALESCE(
                    (SELECT jsonb_agg(df.field_id::text ORDER BY df.field_id)
                     FROM document_fields df
                     WHERE df.document_id = d.id AND df.active = true),
                    '[]'::jsonb
                ),
                'parent_document_id', (
                    SELECT dt.parent_id::text
                    FROM document_tree dt
                    WHERE dt.child_id = d.id AND dt.active = true
                    LIMIT 1
                )
            )
        ),
        '{}'::jsonb
    ) as mapping
    FROM document_data d
),
available_scenario_parameters AS (
    -- Get all parameters with scenario_parameter = true that have fields accessible to the user
    -- Filter by scenario_parameter flag instead of checking scenario_parameters junction table
    SELECT DISTINCT
        p.id,
        p.name,
        COALESCE(p.description, '') as description,
        p.document_parameter,
        p.persona_parameter,
        p.scenario_parameter,
        p.video_parameter,
        false as numerical
    FROM parameters p
    WHERE p.active = true
    AND p.scenario_parameter = true
    AND (
        -- Parameters referenced by accessible fields (for document/persona parameters)
        EXISTS (
            SELECT 1 FROM parameter_fields pf
            JOIN fields f ON f.id = pf.field_id
            LEFT JOIN field_departments fd ON fd.field_id = f.id AND fd.active = true
            WHERE pf.parameter_id = p.id
            AND pf.active = true
            AND f.active = true
            AND (
                fd.department_id IN (SELECT id FROM user_departments)
                OR NOT EXISTS (SELECT 1 FROM field_departments fd2 WHERE fd2.field_id = f.id AND fd2.active = true)
            )
        )
    )
),
parameter_data AS (
    SELECT DISTINCT 
        p.id,
        p.name,
        COALESCE(p.description, '') as description,
        p.document_parameter,
        p.persona_parameter
    FROM parameters p
    JOIN parameter_fields pf ON pf.parameter_id = p.id AND pf.active = true
    LEFT JOIN field_departments fd ON fd.field_id = pf.field_id AND fd.active = true
    CROSS JOIN user_departments ud
    WHERE p.active = true
    GROUP BY p.id, p.name, p.description, p.document_parameter, p.persona_parameter
    HAVING 
        COUNT(fd.field_id) FILTER (WHERE fd.department_id = ANY(SELECT id FROM user_departments)) > 0
        OR NOT EXISTS (SELECT 1 FROM field_departments fd2 
                      JOIN parameter_fields pf2 ON pf2.field_id = fd2.field_id 
                      WHERE pf2.parameter_id = p.id AND pf2.active = true)
    ORDER BY p.name
),
parameter_mapping_data AS (
    SELECT COALESCE(
        jsonb_object_agg(
            p.id::text,
            jsonb_build_object(
                'name', p.name,
                'description', p.description,
                'document_parameter', p.document_parameter,
                'persona_parameter', p.persona_parameter,
                'scenario_parameter', p.scenario_parameter,
                'video_parameter', p.video_parameter,
                'numerical', false
            )
        ),
        '{}'::jsonb
    ) as mapping,
    array_agg(p.id::text ORDER BY p.name) as parameter_ids
    FROM available_scenario_parameters p
),
parameter_item_data AS (
    SELECT 
        f.id,
        f.name,
        COALESCE(f.description, '') as description,
        pf.parameter_id,
        p.name as parameter_name
    FROM fields f
    JOIN parameter_fields pf ON pf.field_id = f.id AND pf.active = true
    JOIN parameters p ON p.id = pf.parameter_id
    LEFT JOIN field_departments fd ON fd.field_id = f.id AND fd.active = true
    WHERE p.active = true AND f.active = true
    GROUP BY f.id, f.name, f.description, pf.parameter_id, p.id, p.name
    HAVING 
        COUNT(fd.field_id) FILTER (WHERE fd.department_id IN (SELECT id FROM user_departments)) > 0
        OR NOT EXISTS (SELECT 1 FROM field_departments fd2 WHERE fd2.field_id = f.id AND fd2.active = true)
    ORDER BY p.name, f.name
),
-- Conditional parameter relationships (field → conditional_parameter)
field_conditional_parameters_data AS (
    SELECT 
        fcp.field_id,
        ARRAY_AGG(fcp.conditional_parameter_id::text ORDER BY fcp.conditional_parameter_id) as conditional_parameter_ids
    FROM field_conditional_parameters fcp
    WHERE fcp.active = true
    GROUP BY fcp.field_id
),
field_mapping_data AS (
    SELECT COALESCE(
        jsonb_object_agg(
            pi.id::text,
            jsonb_build_object(
                'name', pi.name,
                'description', pi.description,
                'parameter_id', pi.parameter_id::text,
                'parameter_name', pi.parameter_name,
                'conditional_parameter_ids', COALESCE(
                    (SELECT to_jsonb(fcpd.conditional_parameter_ids)
                     FROM field_conditional_parameters_data fcpd
                     WHERE fcpd.field_id::text = pi.id::text),
                    '[]'::jsonb
                )
            )
        ),
        '{}'::jsonb
    ) as mapping
    FROM parameter_item_data pi
),
-- Conditional parameters mapping (for easy lookup)
conditional_parameters_mapping AS (
    SELECT COALESCE(
        jsonb_object_agg(
            fcpd.field_id::text,
            to_jsonb(fcpd.conditional_parameter_ids)
        ),
        '{}'::jsonb
    ) as mapping
    FROM field_conditional_parameters_data fcpd
),
parameters_structure AS (
    SELECT COALESCE(
        jsonb_object_agg(
            pd.id::text,
            jsonb_build_object(
                'parameter_item_ids', '[]'::jsonb,
                'valid_parameter_item_ids', COALESCE((
                    SELECT jsonb_agg(f.id::text ORDER BY f.id)
                    FROM fields f
                    JOIN parameter_fields pf ON pf.field_id = f.id AND pf.active = true
                    WHERE pf.parameter_id = pd.id AND f.active = true
                ), '[]'::jsonb)
            )
        ),
        '{}'::jsonb
    ) as parameters_json
    FROM parameter_data pd
),
document_details_data AS (
    SELECT COALESCE(
        (
            SELECT jsonb_agg(
                jsonb_build_object(
                    'document_id', d.id::text,
                    'name', d.name,
                    'updatedAt', d.updated_at::text,
                    'extension', CASE 
                        WHEN u.file_path IS NOT NULL THEN SUBSTRING(u.file_path FROM '\\.([^\\.]+)$')
                        WHEN template_u.file_path IS NOT NULL THEN SUBSTRING(template_u.file_path FROM '\\.([^\\.]+)$')
                        ELSE NULL 
                    END,
                    'scenario_ids', '[]'::jsonb,
                    'can_edit', true,
                    'can_delete', true,
                    'active', d.active,
                    'file_path', COALESCE(u.file_path, template_u.file_path),
                    'mime_type', COALESCE(u.mime_type, template_u.mime_type),
                    'upload_id', COALESCE(u.id::text, template_u.id::text),
                    'parameter_item_ids', COALESCE((
                        SELECT jsonb_agg(df.field_id::text)
                        FROM document_fields df
                        WHERE df.document_id = d.id AND df.active = true
                    ), '[]'::jsonb),
                    'is_template', CASE 
                        WHEN d.template = true THEN true
                        WHEN EXISTS(
                            SELECT 1 FROM document_templates dt2 
                            WHERE dt2.document_id = d.id AND dt2.active = true
                        ) THEN true
                        ELSE false
                    END,
                    'parent_document_id', (
                        SELECT dtree.parent_id::text
                        FROM document_tree dtree
                        WHERE dtree.child_id = d.id AND dtree.active = true
                        LIMIT 1
                    )
                ) ORDER BY d.name
            )
            FROM documents d
            LEFT JOIN document_uploads du ON du.document_id = d.id AND du.active = true
            LEFT JOIN uploads u ON u.id = du.upload_id
            LEFT JOIN document_templates dt ON dt.document_id = d.id AND dt.active = true
            LEFT JOIN templates t ON t.id = dt.template_id
            LEFT JOIN uploads template_u ON template_u.id = t.upload_id
            WHERE (
                d.id IN (SELECT id FROM document_data)
                OR (
                    $4::uuid[] IS NOT NULL
                    AND array_length($4::uuid[], 1) > 0
                    AND d.id = ANY($4::uuid[])
                )
                OR (
                    -- Include child documents when their parent is requested
                    $4::uuid[] IS NOT NULL
                    AND array_length($4::uuid[], 1) > 0
                    AND EXISTS (
                        SELECT 1 FROM document_tree dtree
                        WHERE dtree.child_id = d.id
                        AND dtree.parent_id = ANY($4::uuid[])
                        AND dtree.active = true
                    )
                )
            )
            AND d.active = true
        ),
        '[]'::jsonb
    ) as document_details
),
accessible_scenarios_default AS (
    SELECT DISTINCT s.id as scenario_id
    FROM scenarios s
    LEFT JOIN scenario_departments sd ON sd.scenario_id = s.id AND sd.active = true
    WHERE s.active = true
    AND (
        sd.department_id IN (SELECT id FROM user_departments)
        OR NOT EXISTS (SELECT 1 FROM scenario_departments sd2 WHERE sd2.scenario_id = s.id AND sd2.active = true)
    )
),
objectives_with_departments_default AS (
    SELECT
        o.objective,
        COALESCE(
            (
                SELECT ARRAY_AGG(DISTINCT dept_id ORDER BY dept_id)
                FROM (
                    SELECT DISTINCT sd.department_id::text as dept_id
                    FROM scenario_objectives so2
                    JOIN objectives o2 ON o2.id = so2.objective_id
                    JOIN accessible_scenarios_default acs2 ON acs2.scenario_id = so2.scenario_id
                    LEFT JOIN scenario_departments sd ON sd.scenario_id = so2.scenario_id AND sd.active = true
                    WHERE o2.objective = o.objective
                        AND o2.objective IS NOT NULL 
                        AND o2.objective != ''
                        AND sd.department_id IS NOT NULL
                ) dept_list
            ),
            ARRAY[]::text[]
        ) as department_ids
    FROM scenario_objectives so
    JOIN objectives o ON o.id = so.objective_id
    JOIN accessible_scenarios_default acs ON acs.scenario_id = so.scenario_id
    WHERE o.objective IS NOT NULL AND o.objective != ''
    GROUP BY o.objective
),
objectives_history_data_default AS (
    SELECT COALESCE(
        (
            SELECT jsonb_agg(
                jsonb_build_object(
                    'objective', objective,
                    'department_ids', department_ids
                )
            )
            FROM (
                SELECT objective, department_ids
                FROM objectives_with_departments_default
                ORDER BY objective
            ) sorted
        ),
        '[]'::jsonb
    ) as objectives_history
),
problem_statement_mapping_data_default AS (
    SELECT COALESCE(
        (
            SELECT jsonb_object_agg(
                ps.id::text,
                jsonb_build_object(
                    'name', ps.name,
                    'problem_statement', ps.problem_statement,
                    'created_at', ps.created_at::text,
                    'updated_at', ps.updated_at::text,
                    'is_from_scenario', false  -- Always false for new scenario
                )
            )
            FROM problem_statements ps
            LEFT JOIN problem_statement_departments psd_dept ON psd_dept.problem_statement_id = ps.id AND psd_dept.active = true
            WHERE (
                psd_dept.department_id IN (SELECT id FROM user_departments)
                OR NOT EXISTS (SELECT 1 FROM problem_statement_departments psd2 WHERE psd2.problem_statement_id = ps.id AND psd2.active = true)
            )
            AND (
                -- If problemStatementIds provided, filter by them; otherwise return all valid problem statements
                ($5::uuid[] IS NULL OR array_length($5::uuid[], 1) = 0)
                OR ps.id = ANY($5::uuid[])
            )
        ),
        '{}'::jsonb
    ) as problem_statement_mapping
),
primary_department_id AS (
    SELECT department_id::text
    FROM profile_departments
    WHERE profile_id = $1 AND is_primary = TRUE
    LIMIT 1
),
first_user_department AS (
    SELECT ud.id
    FROM user_departments ud
    ORDER BY ud.id
    LIMIT 1
),
resolved_department_for_agents AS (
    -- Use primary department if available, otherwise first accessible department
    SELECT COALESCE(
        (SELECT pd.department_id FROM profile_departments pd WHERE pd.profile_id = $1 AND pd.is_primary = TRUE LIMIT 1),
        (SELECT id FROM first_user_department)
    ) as department_id
),
-- Check if any provided documentIds are templates
has_template_documents AS (
    SELECT 
        CASE 
            WHEN $4::uuid[] IS NOT NULL AND array_length($4::uuid[], 1) > 0 THEN
                EXISTS (
                    SELECT 1 
                    FROM documents d
                    WHERE d.id = ANY($4::uuid[])
                    AND (
                        d.template = true
                        OR EXISTS (
                            SELECT 1 
                            FROM document_templates dt 
                            WHERE dt.document_id = d.id 
                            AND dt.active = true
                        )
                    )
                )
            ELSE false
        END as has_templates
),
-- Determine expected agent role - always 'scenario' (variant roles removed)
expected_agent_role AS (
    SELECT 'scenario'::agent_role as role
),
default_scenario_agent AS (
    -- Get best scenario agent for the resolved department based on expected role
    -- Only match the expected role (no fallback to base scenario - base scenario only when expected role IS 'scenario')
    SELECT a.id::text as agent_id
    FROM agents a
    LEFT JOIN agent_departments ad ON ad.agent_id = a.id AND ad.active = true
    CROSS JOIN resolved_department_for_agents rdfa
    CROSS JOIN expected_agent_role ear
    WHERE a.role = ear.role  -- Only match the expected role
    AND a.active = true
    AND (
        -- Include if agent is linked to the resolved department
        ad.department_id = rdfa.department_id
        -- OR agent has no department links (cross-department)
        OR NOT EXISTS (SELECT 1 FROM agent_departments ad2 WHERE ad2.agent_id = a.id AND ad2.active = true)
    )
    ORDER BY 
        -- Prioritize department-specific agents over cross-department agents
        CASE WHEN ad.department_id = rdfa.department_id THEN 0 ELSE 1 END
    LIMIT 1
),
default_image_agent AS (
    -- Get best image agent for the resolved department
    SELECT a.id::text as agent_id
    FROM agents a
    LEFT JOIN agent_departments ad ON ad.agent_id = a.id AND ad.active = true
    CROSS JOIN resolved_department_for_agents rdfa
    WHERE a.role = 'image'
    AND a.active = true
    AND (
        -- Include if agent is linked to the resolved department
        ad.department_id = rdfa.department_id
        -- OR agent has no department links (cross-department)
        OR NOT EXISTS (SELECT 1 FROM agent_departments ad2 WHERE ad2.agent_id = a.id AND ad2.active = true)
    )
    ORDER BY 
        -- Prioritize department-specific agents over cross-department agents
        CASE WHEN ad.department_id = rdfa.department_id THEN 0 ELSE 1 END
    LIMIT 1
),
default_video_agent AS (
    -- Get best video agent for the resolved department
    SELECT a.id::text as agent_id
    FROM agents a
    LEFT JOIN agent_departments ad ON ad.agent_id = a.id AND ad.active = true
    CROSS JOIN resolved_department_for_agents rdfa
    WHERE a.role = 'video'
    AND a.active = true
    AND (
        -- Include if agent is linked to the resolved department
        ad.department_id = rdfa.department_id
        -- OR agent has no department links (cross-department)
        OR NOT EXISTS (SELECT 1 FROM agent_departments ad2 WHERE ad2.agent_id = a.id AND ad2.active = true)
    )
    ORDER BY 
        -- Prioritize department-specific agents over cross-department agents
        CASE WHEN ad.department_id = rdfa.department_id THEN 0 ELSE 1 END
    LIMIT 1
),
agent_filtered AS (
    -- Filter agents by department access and expected role
    -- Include agents matching expected role AND always include image agents
    SELECT a.id, a.name, a.description, a.role
    FROM agents a
    LEFT JOIN agent_departments ad ON ad.agent_id = a.id AND ad.active = true
    CROSS JOIN expected_agent_role ear
    WHERE a.active = true 
    AND (
        -- Match expected role only (no fallback to base scenario)
        a.role = ear.role
        -- OR always include image agents (for image agent picker)
        OR a.role = 'image'
        -- OR always include video agents (for video agent picker)
        OR a.role = 'video'
    )
    GROUP BY a.id, a.name, a.description, a.role, ear.role
    HAVING 
        COUNT(ad.agent_id) FILTER (WHERE ad.department_id IN (SELECT id FROM user_departments)) > 0
        OR NOT EXISTS (SELECT 1 FROM agent_departments ad2 WHERE ad2.agent_id = a.id AND ad2.active = true)
),
valid_agents AS (
    -- Aggregate all filtered agents into a single row
    SELECT 
        COALESCE(
            jsonb_object_agg(
                af.id::text,
                jsonb_build_object(
                    'name', af.name,
                    'description', COALESCE(af.description, ''),
                    'roles', ARRAY[af.role::text]
                )
            ),
            '{}'::jsonb
        ) as agent_mapping,
        COALESCE(array_agg(af.id::text ORDER BY af.name), ARRAY[]::text[]) as agent_ids
    FROM agent_filtered af
)
SELECT 
    COALESCE(
        (SELECT array_agg(id::text ORDER BY id) FROM user_departments),
        ARRAY[]::text[]
    ) as department_ids,
    COALESCE(
        (SELECT array_agg(id::text) FROM persona_data),
        ARRAY[]::text[]
    ) as valid_persona_ids,
    COALESCE(
        (SELECT array_agg(id::text) FROM document_data),
        ARRAY[]::text[]
    ) as valid_document_ids,
    (SELECT mapping FROM department_mapping_data) as department_mapping,
    (SELECT mapping FROM persona_mapping_data) as persona_mapping,
    (SELECT mapping FROM document_mapping_data) as document_mapping,
    (SELECT mapping FROM parameter_mapping_data) as parameter_mapping,
    (SELECT parameter_ids FROM parameter_mapping_data) as valid_parameter_ids,
    (SELECT mapping FROM field_mapping_data) as field_mapping,
    (SELECT parameters_json FROM parameters_structure) as parameters_json,
    (SELECT document_details FROM document_details_data) as document_details,
    (SELECT problem_statement_mapping FROM problem_statement_mapping_data_default) as problem_statement_mapping,
    (SELECT objectives_history FROM objectives_history_data_default) as objectives_history,
    (SELECT user_role FROM user_profile) as user_role,
    (SELECT department_id FROM primary_department_id) as primary_department_id,
    COALESCE((SELECT agent_id FROM default_scenario_agent), '') as scenario_agent_id,
    COALESCE((SELECT agent_id FROM default_image_agent), '') as image_agent_id,
    COALESCE((SELECT agent_mapping FROM valid_agents), '{}'::jsonb) as agent_mapping,
    COALESCE((SELECT agent_ids FROM valid_agents), ARRAY[]::text[]) as valid_agent_ids,
    -- Selected template document IDs (filtered to valid ones)
    COALESCE(
        (SELECT array_agg(d.id::text)
         FROM documents d
         WHERE d.active = true
         AND $6::uuid[] IS NOT NULL
         AND array_length($6::uuid[], 1) > 0
         AND d.id = ANY($6::uuid[])
         AND d.id IN (SELECT id FROM document_data)),
        ARRAY[]::text[]
    ) as selected_template_document_ids,
    -- Objective mapping from provided objective IDs (filtered by department)
    -- Note: For new scenario, we return all matching objectives, not just provided ones
    COALESCE(
        (SELECT jsonb_object_agg(
            o.id::text,
            jsonb_build_object(
                'name', o.objective, 
                'description', o.objective,
                'is_from_scenario', false  -- Always false for new scenario
            )
        )
        FROM objectives o
        LEFT JOIN objective_departments od_dept ON od_dept.objective_id = o.id AND od_dept.active = true
        WHERE (
            ($7::uuid[] IS NOT NULL AND array_length($7::uuid[], 1) > 0 AND o.id = ANY($7::uuid[]))
            OR ($7::uuid[] IS NULL OR array_length($7::uuid[], 1) = 0)
        )
        AND (
            od_dept.department_id IN (SELECT id FROM user_departments)
            OR NOT EXISTS (SELECT 1 FROM objective_departments od2 WHERE od2.objective_id = o.id AND od2.active = true)
        )),
        '{}'::jsonb
    ) as objective_mapping,
    -- Scenario images (list of ALL available images for selection, filtered by department)
    -- Items from current scenario (if any) are sorted first
    COALESCE(
        (SELECT jsonb_agg(
            jsonb_build_object(
                'id', COALESCE(iu.upload_id::text, i.id::text),
                'name', i.name,
                'upload_id', COALESCE(iu.upload_id::text, i.id::text),
                'file_path', u.file_path,
                'mime_type', u.mime_type,
                'active', i.active,
                'created_at', i.created_at::text,
                'updated_at', i.updated_at::text,
                'is_from_scenario', false  -- Always false for new scenario
            )
            ORDER BY i.created_at DESC
        )
        FROM images i
        LEFT JOIN image_uploads iu ON iu.image_id = i.id AND iu.active = true
        LEFT JOIN uploads u ON u.id = iu.upload_id
        LEFT JOIN image_departments id_dept ON id_dept.image_id = i.id AND id_dept.active = true
        WHERE i.active = true
        AND (
            id_dept.department_id IN (SELECT id FROM user_departments)
            OR NOT EXISTS (SELECT 1 FROM image_departments id2 WHERE id2.image_id = i.id AND id2.active = true)
        )),
        '[]'::jsonb
    ) as scenario_images,
    -- Scenario videos (list of ALL available videos for selection, filtered by department)
    -- Items from current scenario (if any) are sorted first
    COALESCE(
        (SELECT jsonb_agg(
            jsonb_build_object(
                'id', v.id::text,
                'name', v.name,
                'length_seconds', v.length_seconds,
                'completed', v.completed,
                'active', v.active,
                'image_enabled', v.image_enabled,
                'file_path', u.file_path,
                'mime_type', u.mime_type,
                'upload_id', u.id::text,
                'is_from_scenario', false  -- Always false for new scenario
            )
            ORDER BY v.created_at DESC
        )
        FROM videos v
        LEFT JOIN video_uploads vu ON vu.video_id = v.id AND vu.active = true
        LEFT JOIN uploads u ON u.id = vu.upload_id
        LEFT JOIN video_departments vd_dept ON vd_dept.video_id = v.id AND vd_dept.active = true
        WHERE v.active = true
        AND (
            vd_dept.department_id IN (SELECT id FROM user_departments)
            OR NOT EXISTS (SELECT 1 FROM video_departments vd2 WHERE vd2.video_id = v.id AND vd2.active = true)
        )),
        '[]'::jsonb
    ) as scenario_videos,
    -- Scenario questions (empty for new scenario)
    ARRAY[]::text[] as question_ids,
    '[]'::jsonb as questions,
    -- Video agent ID (default)
    COALESCE((SELECT agent_id FROM default_video_agent), '') as video_agent_id,
    -- Video enabled flag (default false)
    false as video_enabled,
    -- Questions enabled flag (default false)
    false as questions_enabled,
    -- Randomization ranges (defaults for new scenarios)
    1 as persona_range_min,
    3 as persona_range_max,
    0 as document_range_min,
    3 as document_range_max,
    0 as parameter_range_min,
    3 as parameter_range_max,
    '{}'::jsonb as field_ranges_json,
    (SELECT actor_name FROM user_profile LIMIT 1) as actor_name
FROM params
WHERE ($2::boolean IS NOT NULL OR TRUE) AND ($3::boolean IS NOT NULL OR TRUE) AND ($9::boolean IS NOT NULL OR TRUE)

