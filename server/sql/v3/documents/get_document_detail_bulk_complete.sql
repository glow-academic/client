WITH document_data AS (
    SELECT 
        d.id,
        NULL::text as type,
        (SELECT ARRAY_AGG(dd.department_id::text) FROM document_departments dd WHERE dd.document_id = d.id AND dd.active = true) as department_ids
    FROM documents d
    WHERE d.id = ANY($1)
),
aggregated_data AS (
    SELECT 
        array_agg(DISTINCT type) FILTER (WHERE type IS NOT NULL) as types,
        COALESCE(array_agg(DISTINCT dept_id) FILTER (WHERE dept_id IS NOT NULL), ARRAY[]::text[]) as department_ids
    FROM document_data dd
    CROSS JOIN LATERAL UNNEST(COALESCE(dd.department_ids, ARRAY[]::text[])) as dept_id
    WHERE EXISTS (SELECT 1 FROM document_data)
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
    LEFT JOIN parameter_fields fp ON fp.parameter_id = p.id AND fp.active = true
    LEFT JOIN field_departments fd ON fd.field_id = fp.field_id AND fd.active = true
    WHERE (fd.department_id = ud.id OR NOT EXISTS (SELECT 1 FROM field_departments fd2 
                                                     JOIN parameter_fields fp2 ON fp2.field_id = fd2.field_id 
                                                     WHERE fp2.parameter_id = p.id AND fp2.active = true AND fd2.active = true))
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
                f.id::text,
                jsonb_build_object(
                    'name', f.name,
                    'description', COALESCE(f.description, ''),
                    'parameter_id', fp.parameter_id::text,
                    'parameter_name', p.name
                )
            ),
            '{}'::jsonb
        ) as param_item_mapping,
        array_agg(f.id::text ORDER BY f.name) as param_item_ids
    FROM fields f
    JOIN parameter_fields fp ON fp.field_id = f.id AND fp.active = true
    JOIN parameters p ON p.id = fp.parameter_id
    CROSS JOIN aggregated_data ad
    LEFT JOIN field_departments fd ON fd.field_id = f.id AND fd.active = true
    WHERE p.active = true
      AND (
          (ad.department_ids IS NULL OR array_length(ad.department_ids, 1) = 0)
          AND NOT EXISTS (SELECT 1 FROM field_departments fd2 WHERE fd2.field_id = f.id AND fd2.active = true)
      )
      OR (
          ad.department_ids IS NOT NULL 
          AND array_length(ad.department_ids, 1) > 0
          AND fd.department_id = ANY(SELECT unnest(ad.department_ids)::uuid)
      )
)
SELECT 
    ad.types,
    ad.department_ids,
    vd.dept_mapping as department_mapping,
    vd.dept_ids as valid_department_ids,
    vpi.param_item_mapping as field_mapping,
    vpi.param_item_ids as valid_field_ids
FROM aggregated_data ad
CROSS JOIN valid_depts vd
CROSS JOIN valid_param_items vpi

