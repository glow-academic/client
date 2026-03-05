-- Export personas with full resource IDs and values for round-trip CSV
-- 1) Drop function first
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_export_personas_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_export_personas_v4(%s)', r.sig);
    END LOOP;
END $$;

-- 2) Drop types
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT typname
        FROM pg_type
        WHERE typname LIKE 'q_export_personas_v4_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I', r.typname);
    END LOOP;
END $$;

-- 3) Recreate types
CREATE TYPE types.q_export_personas_v4_row AS (
    persona_id uuid,
    -- Single-select: ID + value
    name_id uuid,
    name text,
    description_id uuid,
    description text,
    color_id uuid,
    color text,
    icon_id uuid,
    icon text,
    instructions_id uuid,
    instructions text,
    -- Flag
    is_inactive boolean,
    -- Multi-select: ID arrays + value arrays
    department_ids uuid[],
    departments text[],
    example_ids uuid[],
    examples text[],
    parameter_field_ids uuid[],
    parameter_fields text[],
    voice_ids uuid[],
    voices text[]
);

-- 4) Recreate function
CREATE OR REPLACE FUNCTION api_export_personas_v4(
    profile_id uuid,
    search text DEFAULT NULL,
    scenario_ids uuid[] DEFAULT NULL,
    field_ids uuid[] DEFAULT NULL,
    filter_department_ids uuid[] DEFAULT NULL
)
RETURNS TABLE (
    rows types.q_export_personas_v4_row[]
)
LANGUAGE sql
STABLE
AS $$
WITH params AS (
    SELECT profile_id AS profile_id
),
user_departments AS (
    SELECT department_id
    FROM params x
    JOIN profile_departments_junction ON profile_departments_junction.profile_id = x.profile_id AND profile_departments_junction.active = true
),
-- Scenario linkage for filtering
persona_scenarios AS (
    SELECT
        ppj.persona_id,
        ARRAY_AGG(DISTINCT sr.id) as scenario_ids
    FROM persona_personas_junction ppj
    JOIN personas_resource pr ON pr.id = ppj.personas_id
    JOIN scenarios_resource sr ON pr.id = ANY(sr.persona_ids)
    GROUP BY ppj.persona_id
),
-- Field linkage for filtering
persona_fields_data AS (
    SELECT
        ppfj.persona_id,
        ARRAY_AGG(DISTINCT fr.id) as field_ids
    FROM persona_parameter_fields_junction ppfj
    JOIN parameter_fields_resource pfr ON pfr.id = ppfj.parameter_field_id
    JOIN fields_resource fr ON fr.id = pfr.field_id
    WHERE ppfj.active = true
    GROUP BY ppfj.persona_id
),
-- Department data
persona_departments_data AS (
    SELECT
        pd.persona_id,
        ARRAY_AGG(pd.department_id ORDER BY pd.created_at) as department_ids,
        ARRAY_AGG(dr.name ORDER BY pd.created_at) as department_names
    FROM persona_departments_junction pd
    JOIN departments_resource dr ON dr.id = pd.department_id
    GROUP BY pd.persona_id
),
-- Example data
persona_examples_data AS (
    SELECT
        pej.persona_id,
        ARRAY_AGG(pej.example_id ORDER BY pej.created_at) as example_ids,
        ARRAY_AGG(er.example ORDER BY pej.created_at) as example_values
    FROM persona_examples_junction pej
    JOIN examples_resource er ON er.id = pej.example_id
    WHERE pej.active = true
    GROUP BY pej.persona_id
),
-- Parameter field data (name comes from fields_resource via parameter_fields_resource.field_id)
persona_pf_data AS (
    SELECT
        ppfj.persona_id,
        ARRAY_AGG(ppfj.parameter_field_id ORDER BY ppfj.created_at) as parameter_field_ids,
        ARRAY_AGG(fr.name ORDER BY ppfj.created_at) as parameter_field_names
    FROM persona_parameter_fields_junction ppfj
    JOIN parameter_fields_resource pfr ON pfr.id = ppfj.parameter_field_id
    JOIN fields_resource fr ON fr.id = pfr.field_id
    WHERE ppfj.active = true
    GROUP BY ppfj.persona_id
),
-- Voice data
persona_voices_data AS (
    SELECT
        pvj.persona_id,
        ARRAY_AGG(pvj.voice_id ORDER BY pvj.created_at) as voice_ids,
        ARRAY_AGG(vr.voice ORDER BY pvj.created_at) as voice_values
    FROM persona_voices_junction pvj
    JOIN voices_resource vr ON vr.id = pvj.voice_id
    WHERE pvj.active = true
    GROUP BY pvj.persona_id
),
persona_data AS (
    SELECT
        p.id as persona_id,
        -- Name
        (SELECT pn.name_id FROM persona_names_junction pn WHERE pn.persona_id = p.id LIMIT 1) as name_id,
        (SELECT n.name FROM persona_names_junction pn JOIN names_resource n ON pn.name_id = n.id WHERE pn.persona_id = p.id LIMIT 1) as name,
        -- Description
        (SELECT pd.description_id FROM persona_descriptions_junction pd WHERE pd.persona_id = p.id LIMIT 1) as description_id,
        (SELECT d.description FROM persona_descriptions_junction pd JOIN descriptions_resource d ON pd.description_id = d.id WHERE pd.persona_id = p.id LIMIT 1) as description,
        -- Color (name, not hex_code — save matches on name)
        (SELECT pc.color_id FROM persona_colors_junction pc WHERE pc.persona_id = p.id LIMIT 1) as color_id,
        (SELECT c.name FROM persona_colors_junction pc JOIN colors_resource c ON pc.color_id = c.id WHERE pc.persona_id = p.id LIMIT 1) as color,
        -- Icon (name, not value — save matches on name)
        (SELECT pi.icon_id FROM persona_icons_junction pi WHERE pi.persona_id = p.id LIMIT 1) as icon_id,
        (SELECT i.name FROM persona_icons_junction pi JOIN icons_resource i ON pi.icon_id = i.id WHERE pi.persona_id = p.id LIMIT 1) as icon,
        -- Instructions
        (SELECT pij.instruction_id FROM persona_instructions_junction pij WHERE pij.persona_id = p.id LIMIT 1) as instructions_id,
        (SELECT ir.template FROM persona_instructions_junction pij JOIN instructions_resource ir ON pij.instruction_id = ir.id WHERE pij.persona_id = p.id LIMIT 1) as instructions,
        -- Flag
        NOT EXISTS (SELECT 1 FROM persona_flags_junction pf JOIN flags_resource f ON pf.flag_id = f.id WHERE pf.persona_id = p.id AND f.type = 'persona_active' AND f.value = TRUE) as is_inactive,
        -- Multi-select
        pdd.department_ids,
        pdd.department_names as departments,
        ped.example_ids,
        ped.example_values as examples,
        ppfd.parameter_field_ids,
        ppfd.parameter_field_names as parameter_fields,
        pvd.voice_ids,
        pvd.voice_values as voices,
        -- For filtering
        COALESCE(ps.scenario_ids, ARRAY[]::uuid[]) as scenario_ids,
        COALESCE(pfd.field_ids, ARRAY[]::uuid[]) as f_field_ids,
        p.updated_at,
        (SELECT n.name FROM persona_names_junction pn JOIN names_resource n ON pn.name_id = n.id WHERE pn.persona_id = p.id LIMIT 1) as persona_name_for_search,
        (SELECT d.description FROM persona_descriptions_junction pd JOIN descriptions_resource d ON pd.description_id = d.id WHERE pd.persona_id = p.id LIMIT 1) as description_for_search
    FROM persona_artifact p
    LEFT JOIN persona_scenarios ps ON ps.persona_id = p.id
    LEFT JOIN persona_fields_data pfd ON pfd.persona_id = p.id
    LEFT JOIN persona_departments_data pdd ON pdd.persona_id = p.id
    LEFT JOIN persona_examples_data ped ON ped.persona_id = p.id
    LEFT JOIN persona_pf_data ppfd ON ppfd.persona_id = p.id
    LEFT JOIN persona_voices_data pvd ON pvd.persona_id = p.id
    -- Access check: user shares at least one department (or persona has no departments)
    LEFT JOIN persona_departments_junction pdj ON pdj.persona_id = p.id AND pdj.department_id IN (SELECT department_id FROM user_departments)
    WHERE p.active = true
    GROUP BY p.id, p.updated_at,
        pdd.department_ids, pdd.department_names,
        ped.example_ids, ped.example_values,
        ppfd.parameter_field_ids, ppfd.parameter_field_names,
        pvd.voice_ids, pvd.voice_values,
        ps.scenario_ids, pfd.field_ids
    HAVING COUNT(pdj.persona_id) > 0 OR NOT EXISTS (
        SELECT 1 FROM persona_departments_junction pd2 WHERE pd2.persona_id = p.id
    )
),
-- Apply filters (same as list query)
filtered_personas AS (
    SELECT pd.*
    FROM persona_data pd
    WHERE
        (search IS NULL OR LOWER(pd.persona_name_for_search) LIKE '%' || LOWER(search) || '%' OR LOWER(pd.description_for_search) LIKE '%' || LOWER(search) || '%')
        AND (api_export_personas_v4.scenario_ids IS NULL OR pd.scenario_ids && api_export_personas_v4.scenario_ids)
        AND (api_export_personas_v4.field_ids IS NULL OR pd.f_field_ids && api_export_personas_v4.field_ids)
        AND (filter_department_ids IS NULL OR pd.department_ids::text[] && filter_department_ids::text[])
)
SELECT
    COALESCE(
        (SELECT ARRAY_AGG(
            (fp.persona_id,
             fp.name_id, fp.name,
             fp.description_id, fp.description,
             fp.color_id, fp.color,
             fp.icon_id, fp.icon,
             fp.instructions_id, fp.instructions,
             fp.is_inactive,
             fp.department_ids, fp.departments,
             fp.example_ids, fp.examples,
             fp.parameter_field_ids, fp.parameter_fields,
             fp.voice_ids, fp.voices
            )::types.q_export_personas_v4_row
            ORDER BY fp.updated_at DESC NULLS LAST
        ) FROM filtered_personas fp),
        '{}'::types.q_export_personas_v4_row[]
    ) as rows
FROM params
$$;
