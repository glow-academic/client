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
    SELECT DISTINCT d.id, d.name, d.type, d.file_path
    FROM documents d
    LEFT JOIN document_departments dd ON dd.document_id = d.id AND dd.active = true
    WHERE d.active = true
    GROUP BY d.id, d.name, d.type, d.file_path
    HAVING 
        -- If department_ids provided and not empty, filter by departments; otherwise include all
        (COALESCE(array_length($1::uuid[], 1), 0) = 0 OR
         COUNT(dd.document_id) FILTER (WHERE dd.department_id = ANY($1::uuid[])) > 0
         OR NOT EXISTS (SELECT 1 FROM document_departments dd2 WHERE dd2.document_id = d.id AND dd2.active = true))
),
filtered_parameters AS (
    SELECT DISTINCT p.id, p.name, p.description, p.document_parameter, p.persona_parameter
    FROM parameters p
    JOIN parameter_items pi ON pi.parameter_id = p.id
    LEFT JOIN parameter_item_departments pid ON pid.parameter_item_id = pi.id AND pid.active = true
    WHERE p.active = true
    GROUP BY p.id, p.name, p.description, p.document_parameter, p.persona_parameter
    HAVING 
        -- If department_ids provided and not empty, filter by departments; otherwise include all
        (COALESCE(array_length($1::uuid[], 1), 0) = 0 OR
         COUNT(pid.parameter_item_id) FILTER (WHERE pid.department_id = ANY($1::uuid[])) > 0
         OR NOT EXISTS (SELECT 1 FROM parameter_item_departments pid2 
                      JOIN parameter_items pi2 ON pi2.id = pid2.parameter_item_id 
                      WHERE pi2.parameter_id = p.id AND pid2.active = true))
),
parameter_items_data AS (
    SELECT DISTINCT pi.id, pi.name, pi.description, pi.value, pi.parameter_id
    FROM parameter_items pi
    JOIN filtered_parameters fp ON fp.id = pi.parameter_id
    LEFT JOIN parameter_item_departments pid ON pid.parameter_item_id = pi.id AND pid.active = true
    GROUP BY pi.id, pi.name, pi.description, pi.value, pi.parameter_id
    HAVING 
        -- If department_ids provided and not empty, filter by departments; otherwise include all
        (COALESCE(array_length($1::uuid[], 1), 0) = 0 OR
         COUNT(pid.parameter_item_id) FILTER (WHERE pid.department_id = ANY($1::uuid[])) > 0
         OR NOT EXISTS (SELECT 1 FROM parameter_item_departments pid2 WHERE pid2.parameter_item_id = pi.id AND pid2.active = true))
),
document_parameter_items_junction AS (
    SELECT DISTINCT dpi.document_id, dpi.parameter_item_id
    FROM document_parameter_items dpi
    JOIN filtered_documents fd ON fd.id = dpi.document_id
    JOIN parameter_items_data pid ON pid.id = dpi.parameter_item_id
    WHERE dpi.active = true
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
    SELECT ARRAY_AGG(parameter_item_id::text ORDER BY parameter_item_id) as parameter_item_ids
    FROM scenario_parameter_items
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

