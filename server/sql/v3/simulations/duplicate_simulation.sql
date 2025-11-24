WITH source_simulation AS (
    SELECT 
        s.id as source_id,
        s.title,
        s.description
    FROM simulations s
    WHERE s.id = $1::uuid
),
new_simulation AS (
    INSERT INTO simulations (
        title,
        description,
        active,
        practice_simulation,
        created_at,
        updated_at
    )
    SELECT 
        ss.title || ' Copy',
        ss.description,
        false,
        false,
        NOW(),
        NOW()
    FROM source_simulation ss
    RETURNING id::text as simulation_id
),
copy_scenarios AS (
    INSERT INTO simulation_scenarios (simulation_id, scenario_id, active, position, rubric_id, created_at, updated_at)
    SELECT 
        ns.simulation_id::uuid,
        ss.scenario_id,
        ss.active,
        ss.position,
        ss.rubric_id,
        NOW(),
        NOW()
    FROM source_simulation ssim
    JOIN simulation_scenarios ss ON ss.simulation_id = ssim.source_id
    CROSS JOIN new_simulation ns
),
copy_departments AS (
    INSERT INTO simulation_departments (simulation_id, department_id, active, created_at, updated_at)
    SELECT 
        ns.simulation_id::uuid,
        sd.department_id,
        sd.active,
        NOW(),
        NOW()
    FROM source_simulation ssim
    JOIN simulation_departments sd ON sd.simulation_id = ssim.source_id AND sd.active = true
    CROSS JOIN new_simulation ns
)
SELECT simulation_id FROM new_simulation

