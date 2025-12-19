-- Update standard descriptions for rubric grid cells
-- Parameters: $1=rubric_id (uuid), $2=descriptions (JSONB array of {standard_group_id, standard_id, description})
-- Updates the description column in standards table for each grid cell
-- Returns: count of updated standards

WITH descriptions_data AS (
    -- Unnest descriptions array
    SELECT 
        (desc_item->>'standard_group_id')::uuid as standard_group_id,
        (desc_item->>'standard_id')::uuid as standard_id,
        desc_item->>'description' as description
    FROM jsonb_array_elements($2::jsonb) as desc_item
),
updated_standards AS (
    UPDATE standards s
    SET description = dd.description
    FROM descriptions_data dd
    WHERE s.id = dd.standard_id
      AND s.standard_group_id = dd.standard_group_id
      AND EXISTS (
          SELECT 1 FROM standard_groups sg
          WHERE sg.id = s.standard_group_id
          AND sg.rubric_id = $1::uuid
      )
    RETURNING s.id
)
SELECT COUNT(*)::int as updated_count
FROM updated_standards

