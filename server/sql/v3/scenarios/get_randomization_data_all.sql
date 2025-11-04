WITH all_personas AS (
    SELECT id, name, COALESCE(description, '') as description
    FROM personas
    WHERE active = true
),
all_documents AS (
    SELECT id, name, type, file_path
    FROM documents
    WHERE active = true
),
all_parameters AS (
    SELECT DISTINCT p.id, p.name, p.description, p.document_parameter
    FROM parameters p
    WHERE p.active = true
),
all_parameter_items AS (
    SELECT pi.id, pi.name, pi.description, pi.value, pi.parameter_id
    FROM parameter_items pi
    JOIN all_parameters ap ON ap.id = pi.parameter_id
),
all_document_parameter_items AS (
    SELECT DISTINCT dpi.document_id, dpi.parameter_item_id
    FROM document_parameter_items dpi
    JOIN all_documents ad ON ad.id = dpi.document_id
    JOIN all_parameter_items api ON api.id = dpi.parameter_item_id
    WHERE dpi.active = true
)
SELECT 
    (SELECT COALESCE(
        json_agg(DISTINCT jsonb_build_object(
            'id', ap.id,
            'name', ap.name,
            'description', ap.description
        )),
        '[]'::json
    ) FROM all_personas ap) as personas,
    (SELECT COALESCE(
        json_agg(DISTINCT jsonb_build_object(
            'id', ad.id,
            'name', ad.name,
            'type', ad.type,
            'file_path', ad.file_path
        )),
        '[]'::json
    ) FROM all_documents ad) as documents,
    (SELECT COALESCE(
        json_agg(DISTINCT jsonb_build_object(
            'id', ap2.id,
            'name', ap2.name,
            'description', ap2.description,
            'document_parameter', ap2.document_parameter
        )),
        '[]'::json
    ) FROM all_parameters ap2) as parameters,
    (SELECT COALESCE(
        json_agg(DISTINCT jsonb_build_object(
            'id', api.id,
            'name', api.name,
            'description', api.description,
            'value', api.value,
            'parameter_id', api.parameter_id
        )),
        '[]'::json
    ) FROM all_parameter_items api) as parameter_items,
    (SELECT COALESCE(
        json_agg(DISTINCT jsonb_build_object(
            'document_id', adpi.document_id,
            'parameter_item_id', adpi.parameter_item_id
        )),
        '[]'::json
    ) FROM all_document_parameter_items adpi) as document_parameter_items

