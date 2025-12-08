-- Get randomization data for scenarios (personas, documents, parameters) and existing scenario links
-- Parameters: 
--   $1=department_ids (uuid array, nullable)
--   $2=scenario_id (uuid, nullable) - if provided, also returns existing scenario links
-- Returns: personas, documents, parameters, parameter_items, document_parameter_items, persona_ids, document_ids, parameter_item_ids as JSON
WITH filtered_personas AS (
    SELECT DISTINCT p.id, p.name, COALESCE(p.description, '') as description
    FROM personas p
    LEFT JOIN persona_departments pd ON pd.persona_id = p.id AND pd.active = true
    WHERE p.active = true
    GROUP BY p.id, p.name, p.description
    HAVING 
        -- If department_ids provided and not empty, filter by departments; otherwise include all
        (COALESCE(array_length($1::uuid[], 1), 0) = 0 OR
         COUNT(pd.persona_id) FILTER (WHERE pd.department_id = ANY($1::uuid[])) > 0
         OR NOT EXISTS (SELECT 1 FROM persona_departments pd2 WHERE pd2.persona_id = p.id AND pd2.active = true))
),
filtered_documents AS (
    SELECT DISTINCT d.id, d.name, NULL::text as type, u.file_path
    FROM documents d
    INNER JOIN document_uploads du ON du.document_id = d.id AND du.active = true
    INNER JOIN uploads u ON u.id = du.upload_id AND u.file_path IS NOT NULL
    LEFT JOIN document_departments dd ON dd.document_id = d.id AND dd.active = true
    WHERE d.active = true
    GROUP BY d.id, d.name, u.file_path
    HAVING 
        -- If department_ids provided and not empty, filter by departments; otherwise include all
        (COALESCE(array_length($1::uuid[], 1), 0) = 0 OR
         COUNT(dd.document_id) FILTER (WHERE dd.department_id = ANY($1::uuid[])) > 0
         OR NOT EXISTS (SELECT 1 FROM document_departments dd2 WHERE dd2.document_id = d.id AND dd2.active = true))
),
filtered_parameters AS (
    SELECT DISTINCT 
        p.id, 
        p.name, 
        p.description, 
        CASE WHEN EXISTS (SELECT 1 FROM parameter_documents pd WHERE pd.parameter_id = p.id AND pd.active = true) THEN true ELSE false END as document_parameter,
        CASE WHEN EXISTS (SELECT 1 FROM parameter_personas pp WHERE pp.parameter_id = p.id AND pp.active = true) THEN true ELSE false END as persona_parameter
    FROM parameters p
    JOIN field_parameters fp ON fp.parameter_id = p.id AND fp.active = true
    LEFT JOIN field_departments fd ON fd.field_id = fp.field_id AND fd.active = true
    WHERE p.active = true
    GROUP BY p.id, p.name, p.description
    HAVING 
        -- If department_ids provided and not empty, filter by departments; otherwise include all
        (COALESCE(array_length($1::uuid[], 1), 0) = 0 OR
         COUNT(fd.field_id) FILTER (WHERE fd.department_id = ANY($1::uuid[])) > 0
         OR NOT EXISTS (SELECT 1 FROM field_departments fd2 
                      JOIN field_parameters fp2 ON fp2.field_id = fd2.field_id 
                      WHERE fp2.parameter_id = p.id AND fp2.active = true AND fd2.active = true))
),
parameter_items_data AS (
    SELECT DISTINCT f.id, f.name, f.description, f.value, fp.parameter_id
    FROM fields f
    JOIN field_parameters fp ON fp.field_id = f.id AND fp.active = true
    JOIN filtered_parameters fp2 ON fp2.id = fp.parameter_id
    LEFT JOIN field_departments fd ON fd.field_id = f.id AND fd.active = true
    GROUP BY f.id, f.name, f.description, f.value, fp.parameter_id
    HAVING 
        -- If department_ids provided and not empty, filter by departments; otherwise include all
        (COALESCE(array_length($1::uuid[], 1), 0) = 0 OR
         COUNT(fd.field_id) FILTER (WHERE fd.department_id = ANY($1::uuid[])) > 0
         OR NOT EXISTS (SELECT 1 FROM field_departments fd2 WHERE fd2.field_id = f.id AND fd2.active = true))
),
document_parameter_items_junction AS (
    SELECT DISTINCT df.document_id, df.field_id as parameter_item_id
    FROM document_fields df
    JOIN filtered_documents fd ON fd.id = df.document_id
    JOIN parameter_items_data pid ON pid.id = df.field_id
    WHERE df.active = true
),
scenario_persona_links AS (
    SELECT ARRAY_AGG(persona_id::text ORDER BY persona_id) as persona_ids
    FROM scenario_personas
    WHERE scenario_id = $2::uuid AND active = true
),
scenario_document_links AS (
    SELECT ARRAY_AGG(document_id::text ORDER BY document_id) as document_ids
    FROM scenario_documents
    WHERE scenario_id = $2::uuid AND active = true
),
scenario_parameter_item_links AS (
    SELECT ARRAY_AGG(field_id::text ORDER BY field_id) as parameter_item_ids
    FROM scenario_fields
    WHERE scenario_id = $2::uuid AND active = true
)
SELECT 
    (SELECT COALESCE(
        json_agg(DISTINCT jsonb_build_object(
            'id', fp.id,
            'name', fp.name,
            'description', fp.description
        )),
        '[]'::json
    ) FROM filtered_personas fp) as personas,
    (SELECT COALESCE(
        json_agg(DISTINCT jsonb_build_object(
            'id', fd.id,
            'name', fd.name,
            'type', fd.type,
            'file_path', fd.file_path
        )),
        '[]'::json
    ) FROM filtered_documents fd) as documents,
    (SELECT COALESCE(
        json_agg(DISTINCT jsonb_build_object(
            'id', fp2.id,
            'name', fp2.name,
            'description', fp2.description,
            'document_parameter', fp2.document_parameter,
            'persona_parameter', fp2.persona_parameter
        )),
        '[]'::json
    ) FROM filtered_parameters fp2) as parameters,
    (SELECT COALESCE(
        json_agg(DISTINCT jsonb_build_object(
            'id', pid.id,
            'name', pid.name,
            'description', pid.description,
            'value', pid.value,
            'parameter_id', pid.parameter_id
        )),
        '[]'::json
    ) FROM parameter_items_data pid) as parameter_items,
    (SELECT COALESCE(
        json_agg(DISTINCT jsonb_build_object(
            'document_id', dpi.document_id,
            'parameter_item_id', dpi.parameter_item_id
        )),
        '[]'::json
    ) FROM document_parameter_items_junction dpi) as document_parameter_items,
    COALESCE((SELECT persona_ids FROM scenario_persona_links), ARRAY[]::text[]) as persona_ids,
    COALESCE((SELECT document_ids FROM scenario_document_links), ARRAY[]::text[]) as document_ids,
    COALESCE((SELECT parameter_item_ids FROM scenario_parameter_item_links), ARRAY[]::text[]) as parameter_item_ids

