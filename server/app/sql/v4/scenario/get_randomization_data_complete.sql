-- Drop existing types if they exist (for idempotent migrations)
DROP TYPE IF EXISTS types.get_randomization_data_persona_v4 CASCADE;
DROP TYPE IF EXISTS types.get_randomization_data_document_v4 CASCADE;
DROP TYPE IF EXISTS types.get_randomization_data_parameter_v4 CASCADE;
DROP TYPE IF EXISTS types.get_randomization_data_parameter_item_v4 CASCADE;
DROP TYPE IF EXISTS types.get_randomization_data_document_parameter_item_v4 CASCADE;

-- Create composite types for nested structures
CREATE TYPE types.get_randomization_data_persona_v4 AS (
    id uuid,
    name text,
    description text
);

CREATE TYPE types.get_randomization_data_document_v4 AS (
    id uuid,
    name text,
    type text,
    file_path text
);

CREATE TYPE types.get_randomization_data_parameter_v4 AS (
    id uuid,
    name text,
    description text,
    document_parameter boolean,
    persona_parameter boolean
);

CREATE TYPE types.get_randomization_data_parameter_item_v4 AS (
    id uuid,
    name text,
    description text,
    parameter_id uuid
);

CREATE TYPE types.get_randomization_data_document_parameter_item_v4 AS (
    document_id uuid,
    parameter_item_id uuid
);

-- Drop function if exists
DROP FUNCTION IF EXISTS api_get_randomization_data_v4(uuid[], uuid);

-- Create function
CREATE OR REPLACE FUNCTION api_get_randomization_data_v4(
    department_ids uuid[],
    scenario_id uuid
)
RETURNS TABLE (
    personas types.get_randomization_data_persona_v4[],
    documents types.get_randomization_data_document_v4[],
    parameters types.get_randomization_data_parameter_v4[],
    parameter_items types.get_randomization_data_parameter_item_v4[],
    document_parameter_items types.get_randomization_data_document_parameter_item_v4[],
    persona_ids text[],
    document_ids text[],
    parameter_item_ids text[]
)
LANGUAGE sql
STABLE
AS $$
WITH filtered_personas AS (
    SELECT DISTINCT p.id, p.name, COALESCE(p.description, '') as description
    FROM personas p
    LEFT JOIN persona_departments pd ON pd.persona_id = p.id AND pd.active = true
    WHERE p.active = true
    GROUP BY p.id, p.name, p.description
    HAVING 
        -- If department_ids provided and not empty, filter by departments; otherwise include all
        (COALESCE(array_length(api_get_randomization_data_v4.department_ids, 1), 0) = 0 OR
         COUNT(pd.persona_id) FILTER (WHERE pd.department_id = ANY(api_get_randomization_data_v4.department_ids)) > 0
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
        (COALESCE(array_length(api_get_randomization_data_v4.department_ids, 1), 0) = 0 OR
         COUNT(dd.document_id) FILTER (WHERE dd.department_id = ANY(api_get_randomization_data_v4.department_ids)) > 0
         OR NOT EXISTS (SELECT 1 FROM document_departments dd2 WHERE dd2.document_id = d.id AND dd2.active = true))
),
filtered_parameters AS (
    SELECT DISTINCT 
        p.id, 
        p.name, 
        p.description, 
        p.document_parameter,
        p.persona_parameter
    FROM parameters p
    JOIN fields f ON f.parameter_id = p.id AND f.active = true
    LEFT JOIN field_departments fd ON fd.field_id = f.id AND fd.active = true
    WHERE p.active = true
    GROUP BY p.id, p.name, p.description, p.document_parameter, p.persona_parameter
    HAVING 
        -- If department_ids provided and not empty, filter by departments; otherwise include all
        (COALESCE(array_length(api_get_randomization_data_v4.department_ids, 1), 0) = 0 OR
         COUNT(fd.field_id) FILTER (WHERE fd.department_id = ANY(api_get_randomization_data_v4.department_ids)) > 0
         OR NOT EXISTS (SELECT 1 FROM field_departments fd2 
                      JOIN fields f2 ON f2.id = fd2.field_id 
                      WHERE f2.parameter_id = p.id AND f2.active = true AND fd2.active = true))
),
parameter_items_data AS (
    SELECT DISTINCT f.id, f.name, f.description, f.parameter_id
    FROM fields f
    JOIN filtered_parameters fp2 ON fp2.id = f.parameter_id
    LEFT JOIN field_departments fd ON fd.field_id = f.id AND fd.active = true
    WHERE f.active = true
    GROUP BY f.id, f.name, f.description, f.parameter_id
    HAVING 
        -- If department_ids provided and not empty, filter by departments; otherwise include all
        (COALESCE(array_length(api_get_randomization_data_v4.department_ids, 1), 0) = 0 OR
         COUNT(fd.field_id) FILTER (WHERE fd.department_id = ANY(api_get_randomization_data_v4.department_ids)) > 0
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
    WHERE scenario_id = api_get_randomization_data_v4.scenario_id AND active = true
),
scenario_document_links AS (
    SELECT ARRAY_AGG(document_id::text ORDER BY document_id) as document_ids
    FROM scenario_documents
    WHERE scenario_id = api_get_randomization_data_v4.scenario_id AND active = true
),
scenario_parameter_item_links AS (
    SELECT ARRAY_AGG(field_id::text ORDER BY field_id) as parameter_item_ids
    FROM scenario_fields
    WHERE scenario_id = api_get_randomization_data_v4.scenario_id AND active = true
),
personas_agg AS (
    SELECT COALESCE(
        ARRAY_AGG(ROW(fp.id, fp.name, fp.description)::types.get_randomization_data_persona_v4 ORDER BY fp.id),
        ARRAY[]::types.get_randomization_data_persona_v4[]
    ) as personas
    FROM filtered_personas fp
),
documents_agg AS (
    SELECT COALESCE(
        ARRAY_AGG(ROW(fd.id, fd.name, fd.type, fd.file_path)::types.get_randomization_data_document_v4 ORDER BY fd.id),
        ARRAY[]::types.get_randomization_data_document_v4[]
    ) as documents
    FROM filtered_documents fd
),
parameters_agg AS (
    SELECT COALESCE(
        ARRAY_AGG(ROW(fp2.id, fp2.name, fp2.description, fp2.document_parameter, fp2.persona_parameter)::types.get_randomization_data_parameter_v4 ORDER BY fp2.id),
        ARRAY[]::types.get_randomization_data_parameter_v4[]
    ) as parameters
    FROM filtered_parameters fp2
),
parameter_items_agg AS (
    SELECT COALESCE(
        ARRAY_AGG(ROW(pid.id, pid.name, pid.description, pid.parameter_id)::types.get_randomization_data_parameter_item_v4 ORDER BY pid.id),
        ARRAY[]::types.get_randomization_data_parameter_item_v4[]
    ) as parameter_items
    FROM parameter_items_data pid
),
document_parameter_items_agg AS (
    SELECT COALESCE(
        ARRAY_AGG(ROW(dpi.document_id, dpi.parameter_item_id)::types.get_randomization_data_document_parameter_item_v4 ORDER BY dpi.document_id, dpi.parameter_item_id),
        ARRAY[]::types.get_randomization_data_document_parameter_item_v4[]
    ) as document_parameter_items
    FROM document_parameter_items_junction dpi
)
SELECT 
    pa.personas,
    da.documents,
    pra.parameters,
    pia.parameter_items,
    dpia.document_parameter_items,
    COALESCE((SELECT persona_ids FROM scenario_persona_links), ARRAY[]::text[]) as persona_ids,
    COALESCE((SELECT document_ids FROM scenario_document_links), ARRAY[]::text[]) as document_ids,
    COALESCE((SELECT parameter_item_ids FROM scenario_parameter_item_links), ARRAY[]::text[]) as parameter_item_ids
FROM personas_agg pa
CROSS JOIN documents_agg da
CROSS JOIN parameters_agg pra
CROSS JOIN parameter_items_agg pia
CROSS JOIN document_parameter_items_agg dpia
$$;