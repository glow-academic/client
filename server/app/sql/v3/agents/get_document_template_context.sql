-- Get fields information for document template generation context
-- Parameters: $1=field_ids[] (uuid array)
-- Returns: JSON array with field and parameter information
SELECT 
    COALESCE(
        (SELECT json_agg(
            json_build_object(
                'item_name', f.name,
                'item_description', COALESCE(f.description, ''),
                'param_name', pa.name,
                'param_description', COALESCE(pa.description, '')
            )
            ORDER BY array_position($1::uuid[], f.id)
        )
        FROM fields f
        JOIN parameter_fields fp ON fp.field_id = f.id AND fp.active = true
        JOIN parameters pa ON pa.id = fp.parameter_id
        WHERE f.id = ANY($1::uuid[])
          AND pa.active = true
        ),
        '[]'::json
    ) as fields

