SELECT * FROM api_randomize_scenario_v3(
    $1::uuid,  -- scenario_id
    $2::uuid,  -- profile_id
    $3::text,  -- randomize_type
    $4::uuid[], -- department_ids
    $5::uuid[], -- persona_ids
    $6::uuid[], -- document_ids
    $7::uuid[], -- parameter_ids
    $8::uuid[], -- field_ids
    $9::integer, -- persona_min
    $10::integer, -- persona_max
    $11::integer, -- document_min
    $12::integer, -- document_max
    $13::integer, -- parameter_selection_min
    $14::integer, -- parameter_selection_max
    $15::jsonb  -- field_ranges_json
)
