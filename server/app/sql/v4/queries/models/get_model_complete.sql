-- Unified get model function - handles both new (model_id = NULL) and detail (model_id provided)
-- Converted to function with composite types
-- Follows ARTIFACT.md pattern
-- 1) Drop function first (breaks dependency on types)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'api_get_model_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_model_v4(%s)', r.sig);
    END LOOP;
END $$;

-- 2) Drop types WITHOUT CASCADE
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT typname 
        FROM pg_type 
        WHERE typname LIKE 'q_get_model_v4_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I', r.typname);
    END LOOP;
END $$;

-- 3) Recreate types
-- Single-select resource types (following Persona pattern)
CREATE TYPE types.q_get_model_v4_name_resource AS (
    id uuid,
    name text,
    generated boolean
);

CREATE TYPE types.q_get_model_v4_description_resource AS (
    id uuid,
    description text,
    generated boolean
);

CREATE TYPE types.q_get_model_v4_flag_resource AS (
    id uuid,
    name text,
    description text,
    icon text,
    generated boolean
);

CREATE TYPE types.q_get_model_v4_value_resource AS (
    id uuid,
    value text,
    generated boolean
);

CREATE TYPE types.q_get_model_v4_endpoint_resource AS (
    id uuid,
    base_url text,
    generated boolean
);

-- Single-select option types
CREATE TYPE types.q_get_model_v4_name_option AS (
    id uuid,
    name text,
    generated boolean
);

CREATE TYPE types.q_get_model_v4_description_option AS (
    id uuid,
    description text,
    generated boolean
);

CREATE TYPE types.q_get_model_v4_flag_option AS (
    id uuid,
    name text,
    description text,
    icon text,
    generated boolean
);

CREATE TYPE types.q_get_model_v4_value_option AS (
    id uuid,
    value text,
    generated boolean
);

CREATE TYPE types.q_get_model_v4_endpoint_option AS (
    id uuid,
    base_url text,
    generated boolean
);

-- Multi-select resource types
CREATE TYPE types.q_get_model_v4_modality_resource AS (
    modality_id uuid,
    modality text,
    generated boolean
);

CREATE TYPE types.q_get_model_v4_modality_option AS (
    modality_id uuid,
    modality text,
    generated boolean
);

CREATE TYPE types.q_get_model_v4_temperature_level_resource AS (
    temperature_level_id uuid,
    temperature real,
    is_upper boolean,
    generated boolean
);

CREATE TYPE types.q_get_model_v4_temperature_level_option AS (
    temperature_level_id uuid,
    temperature real,
    is_upper boolean,
    generated boolean
);

CREATE TYPE types.q_get_model_v4_reasoning_level_resource AS (
    reasoning_level_id uuid,
    reasoning_level text,
    generated boolean
);

CREATE TYPE types.q_get_model_v4_reasoning_level_option AS (
    reasoning_level_id uuid,
    reasoning_level text,
    generated boolean
);

CREATE TYPE types.q_get_model_v4_quality_resource AS (
    quality_id uuid,
    quality text,
    generated boolean
);

CREATE TYPE types.q_get_model_v4_quality_option AS (
    quality_id uuid,
    quality text,
    generated boolean
);

CREATE TYPE types.q_get_model_v4_pricing_resource AS (
    pricing_id uuid,
    pricing_type text,
    unit_id uuid,
    unit_name text,
    unit_category text,
    price real,
    generated boolean
);

CREATE TYPE types.q_get_model_v4_pricing_option AS (
    pricing_id uuid,
    pricing_type text,
    unit_id uuid,
    unit_name text,
    unit_category text,
    price real,
    generated boolean
);

-- Existing types
CREATE TYPE types.q_get_model_v4_provider_resource AS (
    id uuid,
    name text,
    description text,
    generated boolean
);

CREATE TYPE types.q_get_model_v4_provider_option AS (
    id uuid,
    name text,
    description text,
    generated boolean
);

CREATE TYPE types.q_get_model_v4_department AS (
    department_id uuid,
    name text,
    description text,
    generated boolean
);

CREATE TYPE types.q_get_model_v4_key_resource AS (
    id uuid,
    name text,
    description text,
    key_masked text,
    active boolean,
    department_ids uuid[],
    generated boolean
);

CREATE TYPE types.q_get_model_v4_key_option AS (
    id uuid,
    name text,
    description text,
    key_masked text,
    active boolean,
    department_ids uuid[],
    generated boolean
);

CREATE TYPE types.q_get_model_v4_voice_resource AS (
    id uuid,
    voice text,
    generated boolean
);

CREATE TYPE types.q_get_model_v4_voice_option AS (
    id uuid,
    voice text,
    generated boolean
);

-- 4) Recreate function
CREATE OR REPLACE FUNCTION api_get_model_v4(
    profile_id uuid,
    model_id uuid DEFAULT NULL,
    draft_id uuid DEFAULT NULL,
    mcp boolean DEFAULT false
)
RETURNS TABLE (
    -- Required fields (first 5)
    actor_name text,
    model_exists boolean,
    can_edit boolean,
    disabled_reason text,
    group_id uuid,
    -- Single-select resources: name
    name_id uuid,
    name_resource types.q_get_model_v4_name_resource,
    show_name boolean,
    name_agent_id uuid,
    name_required boolean,
    name_suggestions uuid[],
    names types.q_get_model_v4_name_option[],
    -- Single-select resources: description
    description_id uuid,
    description_resource types.q_get_model_v4_description_resource,
    show_description boolean,
    description_agent_id uuid,
    description_required boolean,
    description_suggestions uuid[],
    descriptions types.q_get_model_v4_description_option[],
    -- Single-select resources: flag (active)
    active_flag_id uuid,
    flag_resource types.q_get_model_v4_flag_resource,
    show_flag boolean,
    flag_agent_id uuid,
    flag_required boolean,
    flags types.q_get_model_v4_flag_option[],
    -- Single-select resources: modalities_enabled flag
    modalities_enabled_flag_id uuid,
    modalities_enabled_flag_resource types.q_get_model_v4_flag_resource,
    show_modalities_enabled_flag boolean,
    modalities_enabled_flag_agent_id uuid,
    modalities_enabled_flag_required boolean,
    -- Single-select resources: temperature_enabled flag
    temperature_enabled_flag_id uuid,
    temperature_enabled_flag_resource types.q_get_model_v4_flag_resource,
    show_temperature_enabled_flag boolean,
    temperature_enabled_flag_agent_id uuid,
    temperature_enabled_flag_required boolean,
    -- Single-select resources: pricing_enabled flag
    pricing_enabled_flag_id uuid,
    pricing_enabled_flag_resource types.q_get_model_v4_flag_resource,
    show_pricing_enabled_flag boolean,
    pricing_enabled_flag_agent_id uuid,
    pricing_enabled_flag_required boolean,
    -- Single-select resources: voices_enabled flag
    voices_enabled_flag_id uuid,
    voices_enabled_flag_resource types.q_get_model_v4_flag_resource,
    show_voices_enabled_flag boolean,
    voices_enabled_flag_agent_id uuid,
    voices_enabled_flag_required boolean,
    -- Single-select resources: reasoning_levels_enabled flag
    reasoning_levels_enabled_flag_id uuid,
    reasoning_levels_enabled_flag_resource types.q_get_model_v4_flag_resource,
    show_reasoning_levels_enabled_flag boolean,
    reasoning_levels_enabled_flag_agent_id uuid,
    reasoning_levels_enabled_flag_required boolean,
    -- Single-select resources: qualities_enabled flag
    qualities_enabled_flag_id uuid,
    qualities_enabled_flag_resource types.q_get_model_v4_flag_resource,
    show_qualities_enabled_flag boolean,
    qualities_enabled_flag_agent_id uuid,
    qualities_enabled_flag_required boolean,
    -- Single-select resources: value
    value_id uuid,
    value_resource types.q_get_model_v4_value_resource,
    show_value boolean,
    value_agent_id uuid,
    value_required boolean,
    value_suggestions uuid[],
    "values" types.q_get_model_v4_value_option[],
    -- Single-select resources: endpoint
    endpoint_id uuid,
    endpoint_resource types.q_get_model_v4_endpoint_resource,
    show_endpoint boolean,
    endpoint_agent_id uuid,
    endpoint_required boolean,
    endpoint_suggestions uuid[],
    endpoints types.q_get_model_v4_endpoint_option[],
    -- Single-select resources: provider
    provider_id uuid,
    provider_resource types.q_get_model_v4_provider_resource,
    show_provider boolean,
    provider_agent_id uuid,
    provider_required boolean,
    provider_suggestions uuid[],
    providers types.q_get_model_v4_provider_option[],
    -- Single-select resources: key
    key_id uuid,
    key_resource types.q_get_model_v4_key_resource,
    show_key boolean,
    key_agent_id uuid,
    key_required boolean,
    key_suggestions uuid[],
    keys types.q_get_model_v4_key_option[],
    -- Multi-select resources: departments
    department_ids uuid[],
    department_resources types.q_get_model_v4_department[],
    show_departments boolean,
    departments_agent_id uuid,
    departments_required boolean,
    department_suggestions uuid[],
    departments types.q_get_model_v4_department[],
    -- Multi-select resources: input modalities
    input_modality_ids uuid[],
    input_modality_resources types.q_get_model_v4_modality_resource[],
    show_input_modalities boolean,
    input_modalities_agent_id uuid,
    input_modalities_required boolean,
    input_modality_suggestions uuid[],
    input_modalities types.q_get_model_v4_modality_option[],
    -- Multi-select resources: output modalities
    output_modality_ids uuid[],
    output_modality_resources types.q_get_model_v4_modality_resource[],
    show_output_modalities boolean,
    output_modalities_agent_id uuid,
    output_modalities_required boolean,
    output_modality_suggestions uuid[],
    output_modalities types.q_get_model_v4_modality_option[],
    -- Multi-select resources: temperature levels
    temperature_level_ids uuid[],
    temperature_level_resources types.q_get_model_v4_temperature_level_resource[],
    show_temperature_levels boolean,
    temperature_levels_agent_id uuid,
    temperature_levels_required boolean,
    temperature_level_suggestions uuid[],
    temperature_levels types.q_get_model_v4_temperature_level_option[],
    -- Multi-select resources: reasoning levels
    reasoning_level_ids uuid[],
    reasoning_level_resources types.q_get_model_v4_reasoning_level_resource[],
    show_reasoning_levels boolean,
    reasoning_levels_agent_id uuid,
    reasoning_levels_required boolean,
    reasoning_level_suggestions uuid[],
    reasoning_levels types.q_get_model_v4_reasoning_level_option[],
    -- Multi-select resources: qualities
    quality_ids uuid[],
    quality_resources types.q_get_model_v4_quality_resource[],
    show_qualities boolean,
    qualities_agent_id uuid,
    qualities_required boolean,
    quality_suggestions uuid[],
    qualities types.q_get_model_v4_quality_option[],
    -- Multi-select resources: pricing
    pricing_ids uuid[],
    pricing_resources types.q_get_model_v4_pricing_resource[],
    show_pricing boolean,
    pricing_agent_id uuid,
    pricing_required boolean,
    pricing_suggestions uuid[],
    pricings types.q_get_model_v4_pricing_option[],
    -- Multi-select resources: voices
    voice_ids uuid[],
    voice_resources types.q_get_model_v4_voice_resource[],
    show_voices boolean,
    voices_agent_id uuid,
    voices_required boolean,
    voice_suggestions uuid[],
    voices types.q_get_model_v4_voice_option[]
)
LANGUAGE sql
STABLE
AS $$
WITH params AS (
    SELECT 
        model_id AS model_id,
        profile_id AS profile_id,
        draft_id AS draft_id,
        COALESCE(mcp, false) AS mcp
),
-- Conditional: Only check model existence if model_id provided
model_exists_check AS (
    SELECT 
        CASE 
            WHEN (SELECT model_id FROM params) IS NULL THEN NULL::boolean
            ELSE EXISTS(SELECT 1 FROM model_artifact WHERE id = (SELECT model_id FROM params))::boolean
        END as model_exists
),
-- Get group_id from draft (should always exist after migration, but handle NULL case)
draft_group_data AS (
    SELECT 
        COALESCE(
            d.group_id,
            (SELECT id FROM view_groups_entry ORDER BY created_at DESC LIMIT 1)
        ) as group_id,
        COALESCE(d.version, 0) as draft_version
    FROM params x
    LEFT JOIN view_drafts_entry d ON d.id = x.draft_id
    WHERE TRUE
    LIMIT 1
),
resolve_profile_id AS (
    SELECT 
        CASE 
            WHEN (SELECT profile_id FROM params)::text IS NULL OR (SELECT profile_id FROM params)::text = '' THEN NULL::uuid
            ELSE (SELECT profile_id FROM params)::uuid
        END as resolved_profile_id
),
actor_profile AS (
    SELECT 
        (SELECT profile_id FROM params)::uuid as profile_id,
        COALESCE(COALESCE((SELECT n.name FROM profile_names_junction pn JOIN names_resource n ON pn.name_id = n.id WHERE pn.profile_id = p.id LIMIT 1), ''), 'System') as actor_name
    FROM profile_artifact p
    WHERE p.id = (SELECT profile_id FROM params)::uuid
),
user_profile AS (
    SELECT role, actor_name
    FROM view_user_profile_context
    WHERE profile_id = (SELECT profile_id FROM params)
),
user_departments AS (
    SELECT DISTINCT pd.department_id
    FROM resolve_profile_id rpi
    JOIN profile_departments_junction pd ON pd.profile_id = rpi.resolved_profile_id
    WHERE pd.active = true
),
user_departments_data AS (
    SELECT DISTINCT
        dr.id,
        (SELECT n.name FROM department_names_junction dn JOIN names_resource n ON dn.name_id = n.id WHERE dn.department_id = d.id LIMIT 1) as name,
        (SELECT d2.description FROM department_descriptions_junction dd JOIN descriptions_resource d2 ON dd.description_id = d2.id WHERE dd.department_id = d.id LIMIT 1) as description
    FROM departments_resource dr
    JOIN department_departments_junction ddj ON ddj.departments_id = dr.id
    JOIN department_artifact d ON d.id = ddj.department_id
    JOIN resolve_profile_id rpi ON true
    JOIN profile_departments_junction pd ON dr.id = pd.department_id
    WHERE EXISTS (SELECT 1 FROM department_flags_junction df JOIN flags_resource f ON df.flag_id = f.id WHERE df.department_id = d.id AND f.name = 'department_active' AND df.value = true)
    AND pd.profile_id = rpi.resolved_profile_id
    AND pd.active = true
),
-- Resource data CTEs - query from model_* tables or draft_* tables if draft_id provided
-- NOTE: These must be defined BEFORE they are referenced in other CTEs
name_resource_data AS (
    SELECT 
        COALESCE(
            (SELECT dn.names_id FROM names_drafts_connection dn WHERE dn.draft_id = (SELECT draft_id FROM params) LIMIT 1),
            (SELECT mn.name_id FROM model_names_junction mn WHERE mn.model_id = (SELECT model_id FROM params) LIMIT 1)
        ) as name_id,
        (SELECT ROW(n.id, n.name, COALESCE(n.generated, false))::types.q_get_model_v4_name_resource FROM names_drafts_connection dn JOIN names_resource n ON dn.names_id = n.id WHERE dn.draft_id = (SELECT draft_id FROM params) LIMIT 1) as draft_name_resource,
        (SELECT ROW(n.id, n.name, COALESCE(n.generated, false))::types.q_get_model_v4_name_resource FROM model_names_junction mn JOIN names_resource n ON mn.name_id = n.id WHERE mn.model_id = (SELECT model_id FROM params) LIMIT 1) as model_name_resource
    FROM params
),
description_resource_data AS (
    SELECT 
        COALESCE(
            (SELECT dd.descriptions_id FROM descriptions_drafts_connection dd WHERE dd.draft_id = (SELECT draft_id FROM params) LIMIT 1),
            (SELECT md.description_id FROM model_descriptions_junction md WHERE md.model_id = (SELECT model_id FROM params) LIMIT 1)
        ) as description_id,
        (SELECT ROW(d.id, d.description, COALESCE(d.generated, false))::types.q_get_model_v4_description_resource FROM descriptions_drafts_connection dd JOIN descriptions_resource d ON dd.descriptions_id = d.id WHERE dd.draft_id = (SELECT draft_id FROM params) LIMIT 1) as draft_description_resource,
        (SELECT ROW(d.id, d.description, COALESCE(d.generated, false))::types.q_get_model_v4_description_resource FROM model_descriptions_junction md JOIN descriptions_resource d ON md.description_id = d.id WHERE md.model_id = (SELECT model_id FROM params) LIMIT 1) as model_description_resource
    FROM params
),
flag_resource_data AS (
    SELECT 
        CASE
            WHEN (SELECT draft_id FROM params) IS NULL THEN
                (SELECT mf.flag_id FROM model_flags_junction mf JOIN flags_resource f ON mf.flag_id = f.id WHERE mf.model_id = (SELECT model_id FROM params) AND f.name = 'model_active' AND mf.value = TRUE LIMIT 1)
            ELSE
                (SELECT df.flags_id
                 FROM flags_drafts_connection df
                 JOIN flags_resource f ON f.id = df.flags_id
                 WHERE df.draft_id = (SELECT draft_id FROM params)
                 AND f.name = 'model_active'
                 LIMIT 1)
        END as active_flag_id,
        (SELECT ROW(f.id, f.name, f.description, f.icon, COALESCE(f.generated, false))::types.q_get_model_v4_flag_resource
         FROM flags_drafts_connection df
         JOIN flags_resource f ON df.flags_id = f.id
         WHERE df.draft_id = (SELECT draft_id FROM params)
         AND f.name = 'model_active'
         LIMIT 1) as draft_flag_resource,
        (SELECT ROW(f.id, f.name, f.description, f.icon, COALESCE(f.generated, false))::types.q_get_model_v4_flag_resource FROM model_flags_junction mf JOIN flags_resource f ON mf.flag_id = f.id WHERE mf.model_id = (SELECT model_id FROM params) AND f.name = 'model_active' AND mf.value = TRUE LIMIT 1) as model_flag_resource
    FROM params
),
modalities_enabled_flag_resource_data AS (
    SELECT 
        CASE
            WHEN (SELECT draft_id FROM params) IS NULL THEN
                (SELECT mf.flag_id FROM model_flags_junction mf JOIN flags_resource f ON mf.flag_id = f.id WHERE mf.model_id = (SELECT model_id FROM params) AND f.type = 'modalities_enabled'::flag_type AND mf.value = TRUE LIMIT 1)
            ELSE
                (SELECT df.flags_id
                 FROM flags_drafts_connection df
                 JOIN flags_resource f ON f.id = df.flags_id
                 WHERE df.draft_id = (SELECT draft_id FROM params)
                 AND f.type = 'modalities_enabled'::flag_type
                 LIMIT 1)
        END as modalities_enabled_flag_id,
        CASE
            WHEN (SELECT draft_id FROM params) IS NULL THEN
                (SELECT ROW(f.id, f.name, f.description, f.icon, COALESCE(f.generated, false))::types.q_get_model_v4_flag_resource FROM model_flags_junction mf JOIN flags_resource f ON mf.flag_id = f.id WHERE mf.model_id = (SELECT model_id FROM params) AND f.type = 'modalities_enabled'::flag_type AND mf.value = TRUE LIMIT 1)
            ELSE
                (SELECT ROW(f.id, f.name, f.description, f.icon, COALESCE(f.generated, false))::types.q_get_model_v4_flag_resource
                 FROM flags_drafts_connection df
                 JOIN flags_resource f ON df.flags_id = f.id
                 WHERE df.draft_id = (SELECT draft_id FROM params)
                 AND f.type = 'modalities_enabled'::flag_type
                 LIMIT 1)
        END as modalities_enabled_flag_resource
    FROM params
),
temperature_enabled_flag_resource_data AS (
    SELECT 
        CASE
            WHEN (SELECT draft_id FROM params) IS NULL THEN
                (SELECT mf.flag_id FROM model_flags_junction mf JOIN flags_resource f ON mf.flag_id = f.id WHERE mf.model_id = (SELECT model_id FROM params) AND f.type = 'temperature_enabled'::flag_type AND mf.value = TRUE LIMIT 1)
            ELSE
                (SELECT df.flags_id
                 FROM flags_drafts_connection df
                 JOIN flags_resource f ON f.id = df.flags_id
                 WHERE df.draft_id = (SELECT draft_id FROM params)
                 AND f.type = 'temperature_enabled'::flag_type
                 LIMIT 1)
        END as temperature_enabled_flag_id,
        CASE
            WHEN (SELECT draft_id FROM params) IS NULL THEN
                (SELECT ROW(f.id, f.name, f.description, f.icon, COALESCE(f.generated, false))::types.q_get_model_v4_flag_resource FROM model_flags_junction mf JOIN flags_resource f ON mf.flag_id = f.id WHERE mf.model_id = (SELECT model_id FROM params) AND f.type = 'temperature_enabled'::flag_type AND mf.value = TRUE LIMIT 1)
            ELSE
                (SELECT ROW(f.id, f.name, f.description, f.icon, COALESCE(f.generated, false))::types.q_get_model_v4_flag_resource
                 FROM flags_drafts_connection df
                 JOIN flags_resource f ON df.flags_id = f.id
                 WHERE df.draft_id = (SELECT draft_id FROM params)
                 AND f.type = 'temperature_enabled'::flag_type
                 LIMIT 1)
        END as temperature_enabled_flag_resource
    FROM params
),
pricing_enabled_flag_resource_data AS (
    SELECT 
        CASE
            WHEN (SELECT draft_id FROM params) IS NULL THEN
                (SELECT mf.flag_id FROM model_flags_junction mf JOIN flags_resource f ON mf.flag_id = f.id WHERE mf.model_id = (SELECT model_id FROM params) AND f.type = 'pricing_enabled'::flag_type AND mf.value = TRUE LIMIT 1)
            ELSE
                (SELECT df.flags_id
                 FROM flags_drafts_connection df
                 JOIN flags_resource f ON f.id = df.flags_id
                 WHERE df.draft_id = (SELECT draft_id FROM params)
                 AND f.type = 'pricing_enabled'::flag_type
                 LIMIT 1)
        END as pricing_enabled_flag_id,
        CASE
            WHEN (SELECT draft_id FROM params) IS NULL THEN
                (SELECT ROW(f.id, f.name, f.description, f.icon, COALESCE(f.generated, false))::types.q_get_model_v4_flag_resource FROM model_flags_junction mf JOIN flags_resource f ON mf.flag_id = f.id WHERE mf.model_id = (SELECT model_id FROM params) AND f.type = 'pricing_enabled'::flag_type AND mf.value = TRUE LIMIT 1)
            ELSE
                (SELECT ROW(f.id, f.name, f.description, f.icon, COALESCE(f.generated, false))::types.q_get_model_v4_flag_resource
                 FROM flags_drafts_connection df
                 JOIN flags_resource f ON df.flags_id = f.id
                 WHERE df.draft_id = (SELECT draft_id FROM params)
                 AND f.type = 'pricing_enabled'::flag_type
                 LIMIT 1)
        END as pricing_enabled_flag_resource
    FROM params
),
voices_enabled_flag_resource_data AS (
    SELECT 
        CASE
            WHEN (SELECT draft_id FROM params) IS NULL THEN
                (SELECT mf.flag_id FROM model_flags_junction mf JOIN flags_resource f ON mf.flag_id = f.id WHERE mf.model_id = (SELECT model_id FROM params) AND f.type = 'voices_enabled'::flag_type AND mf.value = TRUE LIMIT 1)
            ELSE
                (SELECT df.flags_id
                 FROM flags_drafts_connection df
                 JOIN flags_resource f ON f.id = df.flags_id
                 WHERE df.draft_id = (SELECT draft_id FROM params)
                 AND f.type = 'voices_enabled'::flag_type
                 LIMIT 1)
        END as voices_enabled_flag_id,
        CASE
            WHEN (SELECT draft_id FROM params) IS NULL THEN
                (SELECT ROW(f.id, f.name, f.description, f.icon, COALESCE(f.generated, false))::types.q_get_model_v4_flag_resource FROM model_flags_junction mf JOIN flags_resource f ON mf.flag_id = f.id WHERE mf.model_id = (SELECT model_id FROM params) AND f.type = 'voices_enabled'::flag_type AND mf.value = TRUE LIMIT 1)
            ELSE
                (SELECT ROW(f.id, f.name, f.description, f.icon, COALESCE(f.generated, false))::types.q_get_model_v4_flag_resource
                 FROM flags_drafts_connection df
                 JOIN flags_resource f ON df.flags_id = f.id
                 WHERE df.draft_id = (SELECT draft_id FROM params)
                 AND f.type = 'voices_enabled'::flag_type
                 LIMIT 1)
        END as voices_enabled_flag_resource
    FROM params
),
reasoning_levels_enabled_flag_resource_data AS (
    SELECT 
        CASE
            WHEN (SELECT draft_id FROM params) IS NULL THEN
                (SELECT mf.flag_id FROM model_flags_junction mf JOIN flags_resource f ON mf.flag_id = f.id WHERE mf.model_id = (SELECT model_id FROM params) AND f.type = 'reasoning_levels_enabled'::flag_type AND mf.value = TRUE LIMIT 1)
            ELSE
                (SELECT df.flags_id
                 FROM flags_drafts_connection df
                 JOIN flags_resource f ON f.id = df.flags_id
                 WHERE df.draft_id = (SELECT draft_id FROM params)
                 AND f.type = 'reasoning_levels_enabled'::flag_type
                 LIMIT 1)
        END as reasoning_levels_enabled_flag_id,
        CASE
            WHEN (SELECT draft_id FROM params) IS NULL THEN
                (SELECT ROW(f.id, f.name, f.description, f.icon, COALESCE(f.generated, false))::types.q_get_model_v4_flag_resource FROM model_flags_junction mf JOIN flags_resource f ON mf.flag_id = f.id WHERE mf.model_id = (SELECT model_id FROM params) AND f.type = 'reasoning_levels_enabled'::flag_type AND mf.value = TRUE LIMIT 1)
            ELSE
                (SELECT ROW(f.id, f.name, f.description, f.icon, COALESCE(f.generated, false))::types.q_get_model_v4_flag_resource
                 FROM flags_drafts_connection df
                 JOIN flags_resource f ON df.flags_id = f.id
                 WHERE df.draft_id = (SELECT draft_id FROM params)
                 AND f.type = 'reasoning_levels_enabled'::flag_type
                 LIMIT 1)
        END as reasoning_levels_enabled_flag_resource
    FROM params
),
qualities_enabled_flag_resource_data AS (
    SELECT 
        CASE
            WHEN (SELECT draft_id FROM params) IS NULL THEN
                (SELECT mf.flag_id FROM model_flags_junction mf JOIN flags_resource f ON mf.flag_id = f.id WHERE mf.model_id = (SELECT model_id FROM params) AND f.type = 'qualities_enabled'::flag_type AND mf.value = TRUE LIMIT 1)
            ELSE
                (SELECT df.flags_id
                 FROM flags_drafts_connection df
                 JOIN flags_resource f ON f.id = df.flags_id
                 WHERE df.draft_id = (SELECT draft_id FROM params)
                 AND f.type = 'qualities_enabled'::flag_type
                 LIMIT 1)
        END as qualities_enabled_flag_id,
        CASE
            WHEN (SELECT draft_id FROM params) IS NULL THEN
                (SELECT ROW(f.id, f.name, f.description, f.icon, COALESCE(f.generated, false))::types.q_get_model_v4_flag_resource FROM model_flags_junction mf JOIN flags_resource f ON mf.flag_id = f.id WHERE mf.model_id = (SELECT model_id FROM params) AND f.type = 'qualities_enabled'::flag_type AND mf.value = TRUE LIMIT 1)
            ELSE
                (SELECT ROW(f.id, f.name, f.description, f.icon, COALESCE(f.generated, false))::types.q_get_model_v4_flag_resource
                 FROM flags_drafts_connection df
                 JOIN flags_resource f ON df.flags_id = f.id
                 WHERE df.draft_id = (SELECT draft_id FROM params)
                 AND f.type = 'qualities_enabled'::flag_type
                 LIMIT 1)
        END as qualities_enabled_flag_resource
    FROM params
),
value_resource_data AS (
    SELECT 
        COALESCE(
            (SELECT dv.values_id FROM values_drafts_connection dv WHERE dv.draft_id = (SELECT draft_id FROM params) LIMIT 1),
            (SELECT mv.value_id FROM model_values_junction mv WHERE mv.model_id = (SELECT model_id FROM params) LIMIT 1)
        ) as value_id,
        (SELECT ROW(v.id, v.value, COALESCE(v.generated, false))::types.q_get_model_v4_value_resource
         FROM values_drafts_connection dv
         JOIN values_resource v ON dv.values_id = v.id
         WHERE dv.draft_id = (SELECT draft_id FROM params)
         LIMIT 1) as draft_value_resource,
        (SELECT ROW(v.id, v.value, COALESCE(v.generated, false))::types.q_get_model_v4_value_resource FROM model_values_junction mv JOIN values_resource v ON mv.value_id = v.id WHERE mv.model_id = (SELECT model_id FROM params) LIMIT 1) as model_value_resource
    FROM params
),
endpoint_resource_data AS (
    SELECT 
        COALESCE(
            (SELECT de.endpoints_id FROM endpoints_drafts_connection de WHERE de.draft_id = (SELECT draft_id FROM params) LIMIT 1),
            (SELECT me.endpoint_id FROM model_endpoints_junction me WHERE me.model_id = (SELECT model_id FROM params) AND me.active = true LIMIT 1)
        ) as endpoint_id,
        (SELECT ROW(e.id, e.base_url, COALESCE(e.generated, false))::types.q_get_model_v4_endpoint_resource FROM endpoints_drafts_connection de JOIN endpoints_resource e ON de.endpoints_id = e.id WHERE de.draft_id = (SELECT draft_id FROM params) LIMIT 1) as draft_endpoint_resource,
        (SELECT ROW(e.id, e.base_url, COALESCE(e.generated, false))::types.q_get_model_v4_endpoint_resource FROM model_endpoints_junction me JOIN endpoints_resource e ON me.endpoint_id = e.id WHERE me.model_id = (SELECT model_id FROM params) AND me.active = true LIMIT 1) as model_endpoint_resource
    FROM params
),
model_endpoint_data AS (
    SELECT 
        COALESCE(e.base_url, '') as base_url
    FROM model_artifact m
    LEFT JOIN model_endpoints_junction me_j ON me_j.model_id = m.id
    LEFT JOIN endpoints_resource e ON e.id = me_j.endpoint_id AND e.active = true
    WHERE m.id = (SELECT model_id FROM params)
    AND (SELECT model_id FROM params) IS NOT NULL
    LIMIT 1
),
model_departments_data AS (
    SELECT 
        md.model_id,
        ARRAY_AGG(md.department_id ORDER BY md.created_at) as department_ids
    FROM model_departments_junction md
    WHERE md.model_id = (SELECT model_id FROM params)
    AND (SELECT model_id FROM params) IS NOT NULL
    AND md.active = true
    GROUP BY md.model_id
),
departments_draft_data AS (
    SELECT 
        CASE 
            WHEN (SELECT draft_id FROM params) IS NULL THEN NULL::uuid[]
            ELSE COALESCE(ARRAY_AGG(dd.departments_id ORDER BY dd.created_at), ARRAY[]::uuid[])
        END as department_ids
    FROM departments_drafts_connection dd
    WHERE dd.draft_id = (SELECT draft_id FROM params)
),
model_departments_fallback AS (
    SELECT ARRAY[]::uuid[] as department_ids
    WHERE NOT EXISTS (SELECT 1 FROM model_departments_data WHERE model_id = (SELECT model_id FROM params))
),
model_temperature_data AS (
    SELECT 
        mtl.model_id,
        MIN(tl.temperature) FILTER (WHERE tl.is_upper = false) as temperature_lower,
        MAX(tl.temperature) FILTER (WHERE tl.is_upper = true) as temperature_upper,
        ARRAY_AGG(DISTINCT tl.temperature::text ORDER BY tl.temperature::text) FILTER (WHERE tl.is_upper = false) as temperature_values
    FROM model_temperature_levels_junction mtl
    JOIN temperature_levels_resource tl ON tl.id = mtl.temperature_level_id
    WHERE mtl.model_id = (SELECT model_id FROM params)
    AND (SELECT model_id FROM params) IS NOT NULL
    AND tl.active = true
    GROUP BY mtl.model_id
),
model_pricing_data AS (
    SELECT 
        pr.pricing_type::text as pricing_type,
        u.id as unit_id,
        u.name as unit_name,
        u.unit_category::text as unit_category,
        pr.price
    FROM model_pricing_junction mp
    JOIN pricing_resource pr ON pr.id = mp.pricing_id
    JOIN artifact_units_relation u ON u.id = pr.unit_id
    WHERE mp.model_id = (SELECT model_id FROM params)
    AND (SELECT model_id FROM params) IS NOT NULL
    AND mp.active = true AND pr.active = true AND u.active = true
    ORDER BY pr.pricing_type, u.name
),
-- Multi-select resource IDs data
input_modality_ids_data AS (
    SELECT 
        CASE 
            WHEN (SELECT model_id FROM params) IS NULL THEN ARRAY[]::uuid[]
            ELSE ARRAY_AGG(mr.id ORDER BY mr.modality::text)::uuid[]
        END as input_modality_ids
    FROM model_modalities_junction mm
    JOIN modalities_resource mr ON mr.id = mm.modality_id
    WHERE mm.model_id = (SELECT model_id FROM params)
    AND (SELECT model_id FROM params) IS NOT NULL
    AND mm.type = 'input'::direction_type
    AND mm.active = true AND mr.active = true
),
output_modality_ids_data AS (
    SELECT 
        CASE 
            WHEN (SELECT model_id FROM params) IS NULL THEN ARRAY[]::uuid[]
            ELSE ARRAY_AGG(mr.id ORDER BY mr.modality::text)::uuid[]
        END as output_modality_ids
    FROM model_modalities_junction mm
    JOIN modalities_resource mr ON mr.id = mm.modality_id
    WHERE mm.model_id = (SELECT model_id FROM params)
    AND (SELECT model_id FROM params) IS NOT NULL
    AND mm.type = 'output'::direction_type
    AND mm.active = true AND mr.active = true
),
modalities_draft_data AS (
    SELECT 
        CASE 
            WHEN (SELECT draft_id FROM params) IS NULL THEN NULL::uuid[]
            ELSE COALESCE(ARRAY_AGG(dm.modalities_id ORDER BY mr.modality::text), ARRAY[]::uuid[])
        END as modality_ids
    FROM modalities_drafts_connection dm
    JOIN modalities_resource mr ON mr.id = dm.modalities_id
    WHERE dm.draft_id = (SELECT draft_id FROM params)
    AND mr.active = true
),
temperature_level_ids_data AS (
    SELECT 
        CASE 
            WHEN (SELECT model_id FROM params) IS NULL THEN ARRAY[]::uuid[]
            ELSE ARRAY_AGG(tl.id ORDER BY tl.temperature, tl.is_upper)::uuid[]
        END as temperature_level_ids
    FROM model_temperature_levels_junction mtl
    JOIN temperature_levels_resource tl ON tl.id = mtl.temperature_level_id
    WHERE mtl.model_id = (SELECT model_id FROM params)
    AND (SELECT model_id FROM params) IS NOT NULL
    AND mtl.active = true AND tl.active = true
),
temperature_levels_draft_data AS (
    SELECT 
        CASE 
            WHEN (SELECT draft_id FROM params) IS NULL THEN NULL::uuid[]
            ELSE COALESCE(ARRAY_AGG(dt.temperature_levels_id ORDER BY tl.temperature, tl.is_upper), ARRAY[]::uuid[])
        END as temperature_level_ids
    FROM temperature_levels_drafts_connection dt
    JOIN temperature_levels_resource tl ON tl.id = dt.temperature_levels_id
    WHERE dt.draft_id = (SELECT draft_id FROM params)
    AND tl.active = true
),
reasoning_level_ids_data AS (
    SELECT 
        CASE 
            WHEN (SELECT model_id FROM params) IS NULL THEN ARRAY[]::uuid[]
            ELSE ARRAY_AGG(rl.id ORDER BY 
                CASE rl.reasoning_level
                    WHEN 'none' THEN 1
                    WHEN 'minimal' THEN 2
                    WHEN 'low' THEN 3
                    WHEN 'medium' THEN 4
                    WHEN 'high' THEN 5
                END
            )::uuid[]
        END as reasoning_level_ids
    FROM model_reasoning_levels_junction mrl
    JOIN reasoning_levels_resource rl ON rl.id = mrl.reasoning_level_id
    WHERE mrl.model_id = (SELECT model_id FROM params)
    AND (SELECT model_id FROM params) IS NOT NULL
    AND mrl.active = true AND rl.active = true
),
reasoning_levels_draft_data AS (
    SELECT 
        CASE 
            WHEN (SELECT draft_id FROM params) IS NULL THEN NULL::uuid[]
            ELSE COALESCE(ARRAY_AGG(rl.id ORDER BY 
                CASE rl.reasoning_level
                    WHEN 'none' THEN 1
                    WHEN 'minimal' THEN 2
                    WHEN 'low' THEN 3
                    WHEN 'medium' THEN 4
                    WHEN 'high' THEN 5
                END
            ), ARRAY[]::uuid[])
        END as reasoning_level_ids
    FROM reasoning_levels_drafts_connection drl
    JOIN reasoning_levels_resource rl ON rl.id = drl.reasoning_levels_id
    WHERE drl.draft_id = (SELECT draft_id FROM params)
    AND rl.active = true
),
quality_ids_data AS (
    SELECT 
        CASE 
            WHEN (SELECT model_id FROM params) IS NULL THEN ARRAY[]::uuid[]
            ELSE ARRAY_AGG(qr.id ORDER BY 
                CASE qr.quality
                    WHEN 'low' THEN 1
                    WHEN 'medium' THEN 2
                    WHEN 'high' THEN 3
                END
            )::uuid[]
        END as quality_ids
    FROM model_qualities_junction mq
    JOIN qualities_resource qr ON qr.id = mq.quality_id
    WHERE mq.model_id = (SELECT model_id FROM params)
    AND (SELECT model_id FROM params) IS NOT NULL
    AND mq.active = true AND qr.active = true
),
draft_quality_ids_data AS (
    SELECT 
        CASE 
            WHEN (SELECT draft_id FROM params) IS NULL THEN NULL::uuid[]
            ELSE COALESCE(ARRAY_AGG(qr.id ORDER BY 
                CASE qr.quality
                    WHEN 'low' THEN 1
                    WHEN 'medium' THEN 2
                    WHEN 'high' THEN 3
                END
            ), ARRAY[]::uuid[])
        END as quality_ids
    FROM qualities_drafts_connection dq
    JOIN qualities_resource qr ON qr.id = dq.qualities_id
    WHERE dq.draft_id = (SELECT draft_id FROM params)
    AND qr.active = true
),
pricing_ids_data AS (
    SELECT 
        CASE 
            WHEN (SELECT model_id FROM params) IS NULL THEN ARRAY[]::uuid[]
            ELSE ARRAY_AGG(pr.id ORDER BY pr.pricing_type, u.name)::uuid[]
        END as pricing_ids
    FROM model_pricing_junction mp
    JOIN pricing_resource pr ON pr.id = mp.pricing_id
    JOIN artifact_units_relation u ON u.id = pr.unit_id
    WHERE mp.model_id = (SELECT model_id FROM params)
    AND (SELECT model_id FROM params) IS NOT NULL
    AND mp.active = true AND pr.active = true AND u.active = true
),
pricing_draft_ids_data AS (
    SELECT 
        CASE 
            WHEN (SELECT draft_id FROM params) IS NULL THEN NULL::uuid[]
            ELSE COALESCE(ARRAY_AGG(pr.id ORDER BY pr.pricing_type, u.name), ARRAY[]::uuid[])
        END as pricing_ids
    FROM pricing_drafts_connection dp
    JOIN pricing_resource pr ON pr.id = dp.pricing_id
    JOIN artifact_units_relation u ON u.id = pr.unit_id
    WHERE dp.draft_id = (SELECT draft_id FROM params)
    AND pr.active = true AND u.active = true
),
model_voices_data AS (
    SELECT 
        v.id as voice_id,
        v.voice::text as voice
    FROM model_voices_junction mv
    JOIN voices_resource v ON v.id = mv.voice_id
    WHERE mv.model_id = (SELECT model_id FROM params)
    AND (SELECT model_id FROM params) IS NOT NULL
    AND v.active = true
    ORDER BY v.voice::text
),
voices_draft_data AS (
    SELECT 
        CASE 
            WHEN (SELECT draft_id FROM params) IS NULL THEN NULL::uuid[]
            ELSE COALESCE(ARRAY_AGG(v.id ORDER BY v.voice::text), ARRAY[]::uuid[])
        END as voice_ids
    FROM voices_drafts_connection dv
    JOIN voices_resource v ON v.id = dv.voices_id
    WHERE dv.draft_id = (SELECT draft_id FROM params)
    AND v.active = true
),
-- Providers data (all available providers)
providers_data AS (
    SELECT DISTINCT
        p.id as provider_id,
        n.name as name,
        COALESCE((SELECT d.description FROM provider_descriptions_junction pd JOIN descriptions_resource d ON pd.description_id = d.id WHERE pd.provider_id = pr.id LIMIT 1), '') as description
    FROM providers_resource p
    JOIN provider_providers_junction ppj ON ppj.providers_id = p.id
    JOIN provider_artifact pr ON pr.id = ppj.provider_id
    JOIN provider_names_junction pn ON pn.provider_id = pr.id
    JOIN names_resource n ON n.id = pn.name_id
    WHERE p.active = true
    ORDER BY n.name
),
-- Provider resource (selected provider for model)
provider_resource_data AS (
    SELECT 
        COALESCE(
            (SELECT dp.providers_id FROM providers_drafts_connection dp WHERE dp.draft_id = (SELECT draft_id FROM params) LIMIT 1),
            CASE 
                WHEN (SELECT model_id FROM params) IS NULL THEN NULL::uuid
                ELSE (
                    SELECT p.id 
                    FROM model_providers_junction mp 
                    JOIN providers_resource p ON p.id = mp.providers_id 
                    JOIN models_resource m_res ON m_res.id = mp.model_id
                    JOIN model_models_junction mmj ON mmj.models_id = m_res.id
                    WHERE mmj.model_id = (SELECT model_id FROM params) 
                    LIMIT 1
                )
            END
        ) as provider_id,
        COALESCE(
            (SELECT ROW(
                p.id,
                n.name,
                COALESCE((SELECT d.description FROM provider_descriptions_junction pd JOIN descriptions_resource d ON pd.description_id = d.id WHERE pd.provider_id = pr.id LIMIT 1), ''),
                COALESCE(p.generated, false)
            )::types.q_get_model_v4_provider_resource
            FROM providers_drafts_connection dp
            JOIN providers_resource p ON p.id = dp.providers_id
            JOIN provider_providers_junction ppj ON ppj.providers_id = p.id
            JOIN provider_artifact pr ON pr.id = ppj.provider_id
            JOIN provider_names_junction pn ON pn.provider_id = pr.id
            JOIN names_resource n ON n.id = pn.name_id
            WHERE dp.draft_id = (SELECT draft_id FROM params)
            LIMIT 1),
            CASE 
                WHEN (SELECT model_id FROM params) IS NULL THEN NULL::types.q_get_model_v4_provider_resource
                ELSE (
                    SELECT ROW(
                        p.id,
                        n.name,
                        COALESCE((SELECT d.description FROM provider_descriptions_junction pd JOIN descriptions_resource d ON pd.description_id = d.id WHERE pd.provider_id = pr.id LIMIT 1), ''),
                        false
                    )::types.q_get_model_v4_provider_resource
                    FROM model_providers_junction mp
                    JOIN providers_resource p ON p.id = mp.providers_id
                    JOIN provider_providers_junction ppj ON ppj.providers_id = p.id
                    JOIN provider_artifact pr ON pr.id = ppj.provider_id
                    JOIN provider_names_junction pn ON pn.provider_id = pr.id
                    JOIN names_resource n ON n.id = pn.name_id
                    JOIN models_resource m_res ON m_res.id = mp.model_id
                    JOIN model_models_junction mmj ON mmj.models_id = m_res.id
                    WHERE mmj.model_id = (SELECT model_id FROM params)
                    LIMIT 1
                )
            END
        ) as provider_resource
    FROM params
),
-- Provider suggestions (empty for now - models don't use AI generation)
provider_suggestions_data AS (
    SELECT 
        ARRAY[]::uuid[] as provider_suggestions
    FROM params
    LIMIT 1
),
-- Keys data (all available keys - for new mode, show all keys; for detail mode, show model-specific keys)
model_all_keys AS (
    -- For detail mode: Get keys via settings system: settings -> provider -> key
    -- For each department that has this model, get keys from their settings
    SELECT DISTINCT
        spk.key_id,
        kr.name as name,
        kr.key,
        kr.description as description,
        kr.active as active,
        ARRAY_AGG(DISTINCT ds.department_id) FILTER (WHERE ds.department_id IS NOT NULL) as department_ids
    FROM model_artifact m
    JOIN models_resource m_res ON TRUE
    JOIN model_models_junction mmj ON mmj.models_id = m_res.id AND mmj.model_id = m.id
    LEFT JOIN model_providers_junction mp ON mp.model_id = m_res.id
    LEFT JOIN providers_resource p ON p.id = mp.providers_id
    LEFT JOIN provider_providers_junction ppj ON ppj.providers_id = p.id
    LEFT JOIN provider_artifact pr ON pr.id = ppj.provider_id
    LEFT JOIN provider_names_junction pn ON pn.provider_id = pr.id
    LEFT JOIN names_resource n_prov ON n_prov.id = pn.name_id
    JOIN setting_provider_keys_junction spk ON spk.providers_id = p.id AND spk.active = true
    JOIN keys_resource kr ON kr.id = spk.key_id AND kr.active
    JOIN setting_artifact s ON s.id = spk.settings_id AND EXISTS (SELECT 1 FROM scenario_flags_junction sf JOIN flags_resource f ON sf.flag_id = f.id WHERE sf.scenario_id = s.id AND f.name = 'scenario_active' AND sf.value = true)
    JOIN department_settings_junction ds ON ds.settings_id = s.id AND ds.active = true
    WHERE m.id = (SELECT model_id FROM params)
    AND (SELECT model_id FROM params) IS NOT NULL
    AND ds.active = true
    GROUP BY spk.key_id, kr.name, kr.key, kr.description, kr.active
    
    UNION ALL
    
    -- General keys (keys without department links that user has access to)
    -- Works for both new and detail modes
    SELECT DISTINCT
        kr.id as key_id,
        kr.name as name,
        kr.key,
        kr.description as description,
        kr.active,
        NULL::uuid[] as department_ids
    FROM keys_resource kr
    CROSS JOIN resolve_profile_id rpi
    WHERE kr.active
    AND (
        (SELECT model_id FROM params) IS NULL
        OR NOT EXISTS (
            -- Exclude keys already included via setting_provider_keys_junction for this model's provider
            SELECT 1 FROM model_artifact m2
            JOIN model_models_junction mmj2 ON mmj2.model_id = m2.id
            JOIN models_resource m_res2 ON m_res2.id = mmj2.models_id
            JOIN model_providers_junction mp2 ON mp2.model_id = m_res2.id
            JOIN providers_resource p2 ON p2.id = mp2.providers_id
            JOIN setting_provider_keys_junction spk2 ON spk2.providers_id = p2.id AND spk2.key_id = kr.id AND spk2.active = true
            WHERE m2.id = (SELECT model_id FROM params)
        )
    )
    AND (
        -- Include keys with no settings links (general keys)
        NOT EXISTS (
            SELECT 1 FROM setting_provider_keys_junction spk3
            WHERE spk3.key_id = kr.id AND spk3.active = true
        )
        OR
        -- Include keys with settings links that match user's departments
        EXISTS (
            SELECT 1 FROM setting_provider_keys_junction spk4
            JOIN setting_artifact s4 ON s4.id = spk4.settings_id AND EXISTS (SELECT 1 FROM setting_flags_junction sf JOIN flags_resource f ON sf.flag_id = f.id WHERE sf.setting_id = s4.id AND f.name = 'setting_active' AND sf.value = TRUE)
            JOIN department_settings_junction ds4 ON ds4.settings_id = s4.id AND ds4.active = true
            JOIN user_departments ud ON ud.department_id = ds4.department_id
            WHERE spk4.key_id = kr.id AND spk4.active = true
        )
        OR
        -- Superadmin can see all keys
        EXISTS (SELECT 1 FROM resolve_profile_id rpi2 JOIN profile_artifact p ON p.id = rpi2.resolved_profile_id WHERE rpi2.resolved_profile_id = rpi.resolved_profile_id AND EXISTS (SELECT 1 FROM profile_roles_junction pr_j JOIN roles_resource r ON pr_j.role_id = r.id WHERE pr_j.profile_id = p.id AND r.role = 'superadmin'::profile_type))
    )
),
keys_data AS (
    SELECT DISTINCT ON (mak.key_id) 
        mak.key_id,
        mak.name,
        mak.key,
        mak.description,
        mak.active,
        COALESCE(mak.department_ids, ARRAY[]::uuid[]) as department_ids
    FROM model_all_keys mak
    ORDER BY mak.key_id, mak.name
),
-- Key resource (selected key for model - currently not stored, so NULL)
key_resource_data AS (
    SELECT 
        NULL::uuid as key_id,
        NULL::types.q_get_model_v4_key_resource as key_resource
    FROM params
),
-- Key suggestions (empty for now - models don't use AI generation)
key_suggestions_data AS (
    SELECT 
        ARRAY[]::uuid[] as key_suggestions
    FROM params
    LIMIT 1
),
-- Voices data (all available voices)
all_voices_data AS (
    SELECT 
        id as voice_id,
        voice::text as voice
    FROM voices_resource
    WHERE active = true
    ORDER BY voice::text
),
-- Voice resources (selected voices for model)
voice_resources_data AS (
    SELECT 
        CASE
            WHEN (SELECT draft_id FROM params) IS NULL THEN
                (SELECT ARRAY_AGG(
                    ROW(
                        v.id,
                        v.voice::text,
                        false
                    )::types.q_get_model_v4_voice_resource
                    ORDER BY v.voice::text
                )
                FROM model_voices_junction mv
                JOIN voices_resource v ON v.id = mv.voice_id
                WHERE mv.model_id = (SELECT model_id FROM params)
                AND (SELECT model_id FROM params) IS NOT NULL
                AND v.active = true)
            ELSE
                (SELECT COALESCE(ARRAY_AGG(
                    ROW(
                        v.id,
                        v.voice::text,
                        COALESCE(v.generated, false)
                    )::types.q_get_model_v4_voice_resource
                    ORDER BY v.voice::text
                ), '{}'::types.q_get_model_v4_voice_resource[])
                FROM voices_drafts_connection dv
                JOIN voices_resource v ON v.id = dv.voices_id
                WHERE dv.draft_id = (SELECT draft_id FROM params)
                AND v.active = true)
        END as voice_resources
),
voice_ids_data AS (
    SELECT 
        COALESCE(
            (SELECT voice_ids FROM voices_draft_data),
            CASE 
                WHEN (SELECT model_id FROM params) IS NULL THEN ARRAY[]::uuid[]
                ELSE ARRAY_AGG(v.id ORDER BY v.voice::text)::uuid[]
            END
        ) as voice_ids
    FROM model_voices_junction mv
    JOIN voices_resource v ON v.id = mv.voice_id
    WHERE mv.model_id = (SELECT model_id FROM params)
    AND (SELECT model_id FROM params) IS NOT NULL
    AND v.active = true
),
-- Voice suggestions (empty for now - models don't use AI generation)
voice_suggestions_data AS (
    SELECT 
        ARRAY[]::uuid[] as voice_suggestions
    FROM params
    LIMIT 1
),
-- Department suggestions (empty for now - models don't use AI generation)
department_suggestions_data AS (
    SELECT 
        ARRAY[]::uuid[] as department_suggestions
    FROM params
    LIMIT 1
),
-- Name suggestions: linked to models OR same group with generated=true
name_suggestions_data AS (
    SELECT 
        COALESCE(
            (SELECT ARRAY_AGG(mn.name_id ORDER BY mn.created_at DESC)
             FROM (
                 SELECT DISTINCT mn.name_id, MAX(mn.created_at) as created_at
                 FROM model_names_junction mn
                 JOIN names_resource n ON n.id = mn.name_id
                 CROSS JOIN draft_group_data dgd
                 WHERE mn.name_id IS NOT NULL
                   AND n.name IS NOT NULL
                   AND n.name != ''
                   AND (
                       -- Option 1: Linked to models (model_names_junction junction table means it's validated/used)
                       -- Option 2: OR linked to same group with generated=true (show generated items from current group)
                       mn.generated = false
                       OR
                       (
                           mn.generated = true
                           AND n.generated = true
                           AND EXISTS (
                               SELECT 1 FROM view_calls_entry c
                               JOIN view_runs_entry r ON r.id = c.run_id
                               WHERE c.id IN (SELECT call_id FROM names_calls_connection WHERE names_id = n.id)
                                 AND r.group_id = dgd.group_id
                           )
                       )
                   )
                 GROUP BY mn.name_id
                 ORDER BY MAX(mn.created_at) DESC
                 LIMIT 20
             ) mn),
            ARRAY[]::uuid[]
        ) as name_suggestions
    FROM params
    LIMIT 1
),
-- Description suggestions: linked to models OR same group with generated=true
description_suggestions_data AS (
    SELECT 
        COALESCE(
            (SELECT ARRAY_AGG(md.description_id ORDER BY md.created_at DESC)
             FROM (
                 SELECT DISTINCT md.description_id, MAX(md.created_at) as created_at
                 FROM model_descriptions_junction md
                 JOIN descriptions_resource d ON d.id = md.description_id
                 CROSS JOIN draft_group_data dgd
                 WHERE md.description_id IS NOT NULL
                   AND d.description IS NOT NULL
                   AND d.description != ''
                   AND (
                       -- Option 1: Linked to models (model_descriptions_junction junction table means it's validated/used)
                       -- Option 2: OR linked to same group with generated=true (show generated items from current group)
                       md.generated = false
                       OR
                       (
                           md.generated = true
                           AND d.generated = true
                           AND EXISTS (
                               SELECT 1 FROM view_calls_entry c
                               JOIN view_runs_entry r ON r.id = c.run_id
                               WHERE c.id IN (SELECT call_id FROM descriptions_calls_connection WHERE descriptions_id = d.id)
                                 AND r.group_id = dgd.group_id
                           )
                       )
                   )
                 GROUP BY md.description_id
                 ORDER BY MAX(md.created_at) DESC
                 LIMIT 20
             ) md),
            ARRAY[]::uuid[]
        ) as description_suggestions
    FROM params
    LIMIT 1
),
-- Flag suggestions: linked to models (for active flag)
flag_suggestions_data AS (
    SELECT 
        COALESCE(
            (SELECT ARRAY_AGG(mf.flag_id ORDER BY mf.created_at DESC)
             FROM (
                 SELECT DISTINCT mf.flag_id, MAX(mf.created_at) as created_at
                 FROM model_flags_junction mf
                 JOIN flags_resource f ON f.id = mf.flag_id
                 WHERE mf.flag_id IS NOT NULL
                   AND f.name = 'model_active'
                   AND (
                       mf.generated = false
                       OR f.generated = true
                   )
                 GROUP BY mf.flag_id
                 ORDER BY MAX(mf.created_at) DESC
                 LIMIT 20
             ) mf),
            ARRAY[]::uuid[]
        ) as flag_suggestions
    FROM params
    LIMIT 1
),
-- Value suggestions: linked to models OR same group with generated=true
value_suggestions_data AS (
    SELECT 
        COALESCE(
            (SELECT ARRAY_AGG(mv.value_id ORDER BY mv.created_at DESC)
             FROM (
                 SELECT DISTINCT mv.value_id, MAX(mv.created_at) as created_at
                 FROM model_values_junction mv
                 JOIN values_resource v ON v.id = mv.value_id
                 CROSS JOIN draft_group_data dgd
                 WHERE mv.value_id IS NOT NULL
                   AND v.value IS NOT NULL
                   AND v.value != ''
                   AND (
                       -- Option 1: Linked to models (model_values_junction junction table means it's validated/used)
                       -- Option 2: OR linked to same group with generated=true (show generated items from current group)
                       mv.generated = false
                       OR
                       (
                           mv.generated = true
                           AND v.generated = true
                           AND EXISTS (
                               SELECT 1 FROM view_calls_entry c
                               JOIN view_runs_entry r ON r.id = c.run_id
                               WHERE c.id IN (SELECT call_id FROM values_calls_connection WHERE values_id = v.id)
                                 AND r.group_id = dgd.group_id
                           )
                       )
                   )
                 GROUP BY mv.value_id
                 ORDER BY MAX(mv.created_at) DESC
                 LIMIT 20
             ) mv),
            ARRAY[]::uuid[]
        ) as value_suggestions
    FROM params
    LIMIT 1
),
-- Endpoint suggestions: linked to models OR same group with generated=true
endpoint_suggestions_data AS (
    SELECT 
        COALESCE(
            (SELECT ARRAY_AGG(me.endpoint_id ORDER BY me.created_at DESC)
             FROM (
                 SELECT DISTINCT me.endpoint_id, MAX(me.created_at) as created_at
                 FROM model_endpoints_junction me
                 JOIN endpoints_resource e ON e.id = me.endpoint_id
                 CROSS JOIN draft_group_data dgd
                 WHERE me.endpoint_id IS NOT NULL
                   AND e.base_url IS NOT NULL
                   AND e.base_url != ''
                   AND (
                       -- Option 1: Linked to models (model_endpoints_junction junction table means it's validated/used)
                       -- Option 2: OR linked to same group with generated=true (show generated items from current group)
                       me.generated = false
                       OR
                       (
                           me.generated = true
                           AND e.generated = true
                           AND EXISTS (
                               SELECT 1 FROM view_calls_entry c
                               JOIN view_runs_entry r ON r.id = c.run_id
                               WHERE c.id IN (SELECT call_id FROM examples_calls_connection WHERE examples_id = e.id)
                                 AND r.group_id = dgd.group_id
                           )
                       )
                   )
                 GROUP BY me.endpoint_id
                 ORDER BY MAX(me.created_at) DESC
                 LIMIT 20
             ) me),
            ARRAY[]::uuid[]
        ) as endpoint_suggestions
    FROM params
    LIMIT 1
),
-- Input modality suggestions: linked to models OR same group with generated=true
input_modality_suggestions_data AS (
    SELECT 
        COALESCE(
            (SELECT ARRAY_AGG(mm.modality_id ORDER BY mm.created_at DESC)
             FROM (
                 SELECT DISTINCT mm.modality_id, MAX(mm.created_at) as created_at
                 FROM model_modalities_junction mm
                 JOIN modalities_resource mr ON mr.id = mm.modality_id
                 CROSS JOIN draft_group_data dgd
                 WHERE mm.modality_id IS NOT NULL
                   AND mm.type = 'input'::direction_type
                   AND (
                       -- Option 1: Linked to models (model_modalities_junction junction table means it's validated/used)
                       -- Option 2: OR linked to same group with generated=true (show generated items from current group)
                       mm.generated = false
                       OR
                       (
                           mm.generated = true
                           AND mr.generated = true
                           AND EXISTS (
                               SELECT 1 FROM view_calls_entry c
                               JOIN view_runs_entry r ON r.id = c.run_id
                               WHERE c.id IN (SELECT call_id FROM modalities_calls_connection WHERE modalities_id = mr.id)
                                 AND r.group_id = dgd.group_id
                           )
                       )
                   )
                 GROUP BY mm.modality_id
                 ORDER BY MAX(mm.created_at) DESC
                 LIMIT 20
             ) mm),
            ARRAY[]::uuid[]
        ) as input_modality_suggestions
    FROM params
    LIMIT 1
),
-- Output modality suggestions: linked to models OR same group with generated=true
output_modality_suggestions_data AS (
    SELECT 
        COALESCE(
            (SELECT ARRAY_AGG(mm.modality_id ORDER BY mm.created_at DESC)
             FROM (
                 SELECT DISTINCT mm.modality_id, MAX(mm.created_at) as created_at
                 FROM model_modalities_junction mm
                 JOIN modalities_resource mr ON mr.id = mm.modality_id
                 CROSS JOIN draft_group_data dgd
                 WHERE mm.modality_id IS NOT NULL
                   AND mm.type = 'output'::direction_type
                   AND (
                       -- Option 1: Linked to models (model_modalities_junction junction table means it's validated/used)
                       -- Option 2: OR linked to same group with generated=true (show generated items from current group)
                       mm.generated = false
                       OR
                       (
                           mm.generated = true
                           AND mr.generated = true
                           AND EXISTS (
                               SELECT 1 FROM view_calls_entry c
                               JOIN view_runs_entry r ON r.id = c.run_id
                               WHERE c.id IN (SELECT call_id FROM modalities_calls_connection WHERE modalities_id = mr.id)
                                 AND r.group_id = dgd.group_id
                           )
                       )
                   )
                 GROUP BY mm.modality_id
                 ORDER BY MAX(mm.created_at) DESC
                 LIMIT 20
             ) mm),
            ARRAY[]::uuid[]
        ) as output_modality_suggestions
    FROM params
    LIMIT 1
),
-- Temperature level suggestions: linked to models OR same group with generated=true
temperature_level_suggestions_data AS (
    SELECT 
        COALESCE(
            (SELECT ARRAY_AGG(mtl.temperature_level_id ORDER BY mtl.created_at DESC)
             FROM (
                 SELECT DISTINCT mtl.temperature_level_id, MAX(mtl.created_at) as created_at
                 FROM model_temperature_levels_junction mtl
                 JOIN temperature_levels_resource tl ON tl.id = mtl.temperature_level_id
                 CROSS JOIN draft_group_data dgd
                 WHERE mtl.temperature_level_id IS NOT NULL
                   AND (
                       -- Option 1: Linked to models (model_temperature_levels_junction junction table means it's validated/used)
                       -- Option 2: OR linked to same group with generated=true (show generated items from current group)
                       mtl.generated = false
                       OR
                       (
                           mtl.generated = true
                           AND tl.generated = true
                           AND EXISTS (
                               SELECT 1 FROM view_calls_entry c
                               JOIN view_runs_entry r ON r.id = c.run_id
                               WHERE c.id IN (SELECT call_id FROM temperature_levels_calls_connection WHERE temperature_levels_id = tl.id)
                                 AND r.group_id = dgd.group_id
                           )
                       )
                   )
                 GROUP BY mtl.temperature_level_id
                 ORDER BY MAX(mtl.created_at) DESC
                 LIMIT 20
             ) mtl),
            ARRAY[]::uuid[]
        ) as temperature_level_suggestions
    FROM params
    LIMIT 1
),
-- Reasoning level suggestions: linked to models OR same group with generated=true
reasoning_level_suggestions_data AS (
    SELECT 
        COALESCE(
            (SELECT ARRAY_AGG(mrl.reasoning_level_id ORDER BY mrl.created_at DESC)
             FROM (
                 SELECT DISTINCT mrl.reasoning_level_id, MAX(mrl.created_at) as created_at
                 FROM model_reasoning_levels_junction mrl
                 JOIN reasoning_levels_resource rl ON rl.id = mrl.reasoning_level_id
                 CROSS JOIN draft_group_data dgd
                 WHERE mrl.reasoning_level_id IS NOT NULL
                   AND (
                       -- Option 1: Linked to models (model_reasoning_levels_junction junction table means it's validated/used)
                       -- Option 2: OR linked to same group with generated=true (show generated items from current group)
                       mrl.generated = false
                       OR
                       (
                           mrl.generated = true
                           AND rl.generated = true
                           AND EXISTS (
                               SELECT 1 FROM view_calls_entry c
                               JOIN view_runs_entry r ON r.id = c.run_id
                               WHERE c.id IN (SELECT call_id FROM reasoning_levels_calls_connection WHERE reasoning_levels_id = rl.id)
                                 AND r.group_id = dgd.group_id
                           )
                       )
                   )
                 GROUP BY mrl.reasoning_level_id
                 ORDER BY MAX(mrl.created_at) DESC
                 LIMIT 20
             ) mrl),
            ARRAY[]::uuid[]
        ) as reasoning_level_suggestions
    FROM params
    LIMIT 1
),
-- Quality suggestions: linked to models OR same group with generated=true
quality_suggestions_data AS (
    SELECT 
        COALESCE(
            (SELECT ARRAY_AGG(mq.quality_id ORDER BY mq.created_at DESC)
             FROM (
                 SELECT DISTINCT mq.quality_id, MAX(mq.created_at) as created_at
                 FROM model_qualities_junction mq
                 JOIN qualities_resource qr ON qr.id = mq.quality_id
                 CROSS JOIN draft_group_data dgd
                 WHERE mq.quality_id IS NOT NULL
                   AND (
                       -- Option 1: Linked to models (model_qualities_junction junction table means it's validated/used)
                       -- Option 2: OR linked to same group with generated=true (show generated items from current group)
                       mq.generated = false
                       OR
                       (
                           mq.generated = true
                           AND qr.generated = true
                           AND EXISTS (
                               SELECT 1 FROM view_calls_entry c
                               JOIN view_runs_entry r ON r.id = c.run_id
                               WHERE c.id IN (SELECT call_id FROM qualities_calls_connection WHERE qualities_id = qr.id)
                                 AND r.group_id = dgd.group_id
                           )
                       )
                   )
                 GROUP BY mq.quality_id
                 ORDER BY MAX(mq.created_at) DESC
                 LIMIT 20
             ) mq),
            ARRAY[]::uuid[]
        ) as quality_suggestions
    FROM params
    LIMIT 1
),
-- Pricing suggestions: linked to models OR same group with generated=true
pricing_suggestions_data AS (
    SELECT 
        COALESCE(
            (SELECT ARRAY_AGG(mp.pricing_id ORDER BY mp.created_at DESC)
             FROM (
                 SELECT DISTINCT mp.pricing_id, MAX(mp.created_at) as created_at
                 FROM model_pricing_junction mp
                 JOIN pricing_resource pr ON pr.id = mp.pricing_id
                 CROSS JOIN draft_group_data dgd
                 WHERE mp.pricing_id IS NOT NULL
                   AND (
                       -- Option 1: Linked to models (model_pricing_junction junction table means it's validated/used)
                       -- Option 2: OR linked to same group with generated=true (show generated items from current group)
                       mp.generated = false
                       OR
                       (
                           mp.generated = true
                           AND pr.generated = true
                           AND EXISTS (
                               SELECT 1 FROM view_calls_entry c
                               JOIN view_runs_entry r ON r.id = c.run_id
                               WHERE c.id IN (SELECT call_id FROM pricing_calls_connection WHERE pricing_id = pr.id)
                                 AND r.group_id = dgd.group_id
                           )
                       )
                   )
                 GROUP BY mp.pricing_id
                 ORDER BY MAX(mp.created_at) DESC
                 LIMIT 20
             ) mp),
            ARRAY[]::uuid[]
        ) as pricing_suggestions
    FROM params
    LIMIT 1
),
-- Tool existence checks (check for all resources)
tools_existence_check AS (
    SELECT 
        EXISTS (
            SELECT 1 FROM resource_tools_relation rt
            JOIN tool_artifact t ON t.id = rt.tool_id
            WHERE rt.resource = 'names'::resource_type 
              AND EXISTS (SELECT 1 FROM tool_flags_junction tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'tool_active' AND tf.value = true)
        ) as names_has_tools,
        EXISTS (
            SELECT 1 FROM resource_tools_relation rt
            JOIN tool_artifact t ON t.id = rt.tool_id
            WHERE rt.resource = 'descriptions'::resource_type 
              AND EXISTS (SELECT 1 FROM tool_flags_junction tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'tool_active' AND tf.value = true)
        ) as descriptions_has_tools,
        EXISTS (
            SELECT 1 FROM resource_tools_relation rt
            JOIN tool_artifact t ON t.id = rt.tool_id
            WHERE rt.resource = 'flags'::resource_type 
              AND EXISTS (SELECT 1 FROM tool_flags_junction tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'tool_active' AND tf.value = true)
        ) as flags_has_tools,
        EXISTS (
            SELECT 1 FROM resource_tools_relation rt
            JOIN tool_artifact t ON t.id = rt.tool_id
            WHERE rt.resource = 'values'::resource_type 
              AND EXISTS (SELECT 1 FROM tool_flags_junction tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'tool_active' AND tf.value = true)
        ) as values_has_tools,
        EXISTS (
            SELECT 1 FROM resource_tools_relation rt
            JOIN tool_artifact t ON t.id = rt.tool_id
            WHERE rt.resource = 'endpoints'::resource_type 
              AND EXISTS (SELECT 1 FROM tool_flags_junction tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'tool_active' AND tf.value = true)
        ) as endpoints_has_tools,
        EXISTS (
            SELECT 1 FROM resource_tools_relation rt
            JOIN tool_artifact t ON t.id = rt.tool_id
            WHERE rt.resource = 'providers'::resource_type 
              AND EXISTS (SELECT 1 FROM tool_flags_junction tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'tool_active' AND tf.value = true)
        ) as providers_has_tools,
        EXISTS (
            SELECT 1 FROM resource_tools_relation rt
            JOIN tool_artifact t ON t.id = rt.tool_id
            WHERE rt.resource = 'keys'::resource_type 
              AND EXISTS (SELECT 1 FROM tool_flags_junction tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'tool_active' AND tf.value = true)
        ) as keys_has_tools,
        EXISTS (
            SELECT 1 FROM resource_tools_relation rt
            JOIN tool_artifact t ON t.id = rt.tool_id
            WHERE rt.resource = 'departments'::resource_type 
              AND EXISTS (SELECT 1 FROM tool_flags_junction tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'tool_active' AND tf.value = true)
        ) as departments_has_tools,
        EXISTS (
            SELECT 1 FROM resource_tools_relation rt
            JOIN tool_artifact t ON t.id = rt.tool_id
            WHERE rt.resource = 'modalities'::resource_type 
              AND EXISTS (SELECT 1 FROM tool_flags_junction tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'tool_active' AND tf.value = true)
        ) as modalities_has_tools,
        EXISTS (
            SELECT 1 FROM resource_tools_relation rt
            JOIN tool_artifact t ON t.id = rt.tool_id
            WHERE rt.resource = 'temperature_levels'::resource_type 
              AND EXISTS (SELECT 1 FROM tool_flags_junction tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'tool_active' AND tf.value = true)
        ) as temperature_levels_has_tools,
        EXISTS (
            SELECT 1 FROM resource_tools_relation rt
            JOIN tool_artifact t ON t.id = rt.tool_id
            WHERE rt.resource = 'reasoning_levels'::resource_type 
              AND EXISTS (SELECT 1 FROM tool_flags_junction tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'tool_active' AND tf.value = true)
        ) as reasoning_levels_has_tools,
        EXISTS (
            SELECT 1 FROM resource_tools_relation rt
            JOIN tool_artifact t ON t.id = rt.tool_id
            WHERE rt.resource = 'qualities'::resource_type 
              AND EXISTS (SELECT 1 FROM tool_flags_junction tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'tool_active' AND tf.value = true)
        ) as qualities_has_tools,
        EXISTS (
            SELECT 1 FROM resource_tools_relation rt
            JOIN tool_artifact t ON t.id = rt.tool_id
            WHERE rt.resource = 'pricing'::resource_type 
              AND EXISTS (SELECT 1 FROM tool_flags_junction tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'tool_active' AND tf.value = true)
        ) as pricing_has_tools,
        EXISTS (
            SELECT 1 FROM resource_tools_relation rt
            JOIN tool_artifact t ON t.id = rt.tool_id
            WHERE rt.resource = 'voices'::resource_type 
              AND EXISTS (SELECT 1 FROM tool_flags_junction tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'tool_active' AND tf.value = true)
        ) as voices_has_tools
    FROM params x
),
-- UI flags (show flags based on whether options exist)
ui_flags AS (
    SELECT 
        CASE 
            WHEN EXISTS (SELECT 1 FROM names_resource WHERE active = true) THEN true
            ELSE false
        END as show_name,
        CASE 
            WHEN EXISTS (SELECT 1 FROM descriptions_resource WHERE active = true) THEN true
            ELSE false
        END as show_description,
        CASE 
            WHEN EXISTS (SELECT 1 FROM flags_resource f JOIN artifact_flags_relation aft ON f.type = aft.flag_type WHERE aft.artifact = 'model'::artifact_type) THEN true
            ELSE false
        END as show_flag,
        CASE 
            WHEN EXISTS (SELECT 1 FROM values_resource WHERE active = true) THEN true
            ELSE false
        END as show_value,
        CASE 
            WHEN EXISTS (SELECT 1 FROM endpoints_resource WHERE active = true) THEN true
            ELSE false
        END as show_endpoint,
        CASE 
            WHEN (SELECT COUNT(*) FROM providers_data) > 0 THEN true
            ELSE false
        END as show_provider,
        CASE 
            WHEN (SELECT COUNT(*) FROM keys_data) > 0 THEN true
            ELSE false
        END as show_key,
        CASE 
            WHEN (SELECT COUNT(*) FROM user_departments_data) > 0 THEN true
            ELSE false
        END as show_departments,
        CASE 
            WHEN EXISTS (SELECT 1 FROM modalities_resource WHERE active = true) THEN true
            ELSE false
        END as show_input_modalities,
        CASE 
            WHEN EXISTS (SELECT 1 FROM modalities_resource WHERE active = true) THEN true
            ELSE false
        END as show_output_modalities,
        CASE 
            WHEN EXISTS (SELECT 1 FROM temperature_levels_resource WHERE active = true) THEN true
            ELSE false
        END as show_temperature_levels,
        CASE 
            WHEN EXISTS (SELECT 1 FROM reasoning_levels_resource WHERE active = true) THEN true
            ELSE false
        END as show_reasoning_levels,
        CASE 
            WHEN EXISTS (SELECT 1 FROM qualities_resource WHERE active = true) THEN true
            ELSE false
        END as show_qualities,
        CASE 
            WHEN EXISTS (SELECT 1 FROM pricing_resource WHERE active = true) THEN true
            ELSE false
        END as show_pricing,
        CASE 
            WHEN (SELECT COUNT(*) FROM all_voices_data) > 0 THEN true
            ELSE false
        END as show_voices
    FROM params x
),
-- Resource arrays (all available options)
-- Names (suggested options only - following Persona pattern)
names_suggestions_objects AS (
    SELECT 
        COALESCE(
            (
                SELECT ARRAY_AGG(
                    (n.id, n.name, COALESCE(n.generated, false))::types.q_get_model_v4_name_option
                    ORDER BY array_position(nsd.name_suggestions, n.id)
                )
                FROM name_suggestions_data nsd
                CROSS JOIN LATERAL unnest(nsd.name_suggestions) AS suggestion_id
                JOIN names_resource n ON n.id = suggestion_id
                WHERE n.name IS NOT NULL AND n.name != ''
            ),
            ARRAY[]::types.q_get_model_v4_name_option[]
        ) as names
    FROM params
    LIMIT 1
),
-- Descriptions (suggested options only - following Persona pattern)
descriptions_suggestions_objects AS (
    SELECT 
        COALESCE(
            (
                SELECT ARRAY_AGG(
                    (d.id, d.description, COALESCE(d.generated, false))::types.q_get_model_v4_description_option
                    ORDER BY array_position(dsd.description_suggestions, d.id)
                )
                FROM description_suggestions_data dsd
                CROSS JOIN LATERAL unnest(dsd.description_suggestions) AS suggestion_id
                JOIN descriptions_resource d ON d.id = suggestion_id
                WHERE d.description IS NOT NULL AND d.description != ''
            ),
            ARRAY[]::types.q_get_model_v4_description_option[]
        ) as descriptions
    FROM params
    LIMIT 1
),
-- Flags (all available flags for model artifact)
flags_data AS (
    SELECT DISTINCT
        f.id,
        f.name,
        f.description,
        f.icon,
        COALESCE(f.generated, false) as generated
    FROM flags_resource f
    JOIN artifact_flags_relation aft ON f.type = aft.flag_type
    CROSS JOIN params p
    WHERE 
        aft.artifact = 'model'::artifact_type
        AND (
            -- Always include selected active_flag_id if it exists
            f.id = (SELECT active_flag_id FROM flag_resource_data)
            OR (SELECT active_flag_id FROM flag_resource_data) IS NULL
        )
    ORDER BY f.name
),
flags_aggregated AS (
    SELECT 
        ARRAY_AGG(
            (f.id, f.name, f.description, f.icon, f.generated)::types.q_get_model_v4_flag_option
            ORDER BY f.name
        ) as flags
    FROM flags_data f
),
-- Values (all available values)
all_values_data AS (
    SELECT 
        id,
        value,
        COALESCE(generated, false) as generated
    FROM values_resource
    WHERE active = true
    ORDER BY value
),
values_aggregated AS (
    SELECT 
        ARRAY_AGG(
            (v.id, v.value, v.generated)::types.q_get_model_v4_value_option
            ORDER BY v.value
        ) as "values"
    FROM all_values_data v
),
-- Endpoints (all available endpoints)
all_endpoints_data AS (
    SELECT 
        id,
        base_url,
        COALESCE(generated, false) as generated
    FROM endpoints_resource
    WHERE active = true
    ORDER BY base_url
),
endpoints_aggregated AS (
    SELECT 
        ARRAY_AGG(
            (e.id, e.base_url, e.generated)::types.q_get_model_v4_endpoint_option
            ORDER BY e.base_url
        ) as endpoints
    FROM all_endpoints_data e
),
-- Input modalities (all available modalities)
all_input_modalities_data AS (
    SELECT 
        mr.id as modality_id,
        mr.modality::text as modality,
        COALESCE(mr.generated, false) as generated
    FROM modalities_resource mr
    WHERE mr.active = true
    ORDER BY mr.modality::text
),
input_modalities_aggregated AS (
    SELECT 
        ARRAY_AGG(
            (m.modality_id, m.modality, m.generated)::types.q_get_model_v4_modality_option
            ORDER BY m.modality
        ) as input_modalities
    FROM all_input_modalities_data m
),
-- Output modalities (all available modalities)
all_output_modalities_data AS (
    SELECT 
        mr.id as modality_id,
        mr.modality::text as modality,
        COALESCE(mr.generated, false) as generated
    FROM modalities_resource mr
    WHERE mr.active = true
    ORDER BY mr.modality::text
),
output_modalities_aggregated AS (
    SELECT 
        ARRAY_AGG(
            (m.modality_id, m.modality, m.generated)::types.q_get_model_v4_modality_option
            ORDER BY m.modality
        ) as output_modalities
    FROM all_output_modalities_data m
),
-- Temperature levels (all available temperature levels)
all_temperature_levels_data AS (
    SELECT 
        tl.id as temperature_level_id,
        tl.temperature,
        tl.is_upper,
        COALESCE(tl.generated, false) as generated
    FROM temperature_levels_resource tl
    WHERE tl.active = true
    ORDER BY tl.temperature, tl.is_upper
),
temperature_levels_aggregated AS (
    SELECT 
        ARRAY_AGG(
            (t.temperature_level_id, t.temperature, t.is_upper, t.generated)::types.q_get_model_v4_temperature_level_option
            ORDER BY t.temperature, t.is_upper
        ) as temperature_levels
    FROM all_temperature_levels_data t
),
-- Reasoning levels (all available reasoning levels)
all_reasoning_levels_data AS (
    SELECT 
        rl.id as reasoning_level_id,
        rl.reasoning_level::text as reasoning_level,
        COALESCE(rl.generated, false) as generated
    FROM reasoning_levels_resource rl
    WHERE rl.active = true
    ORDER BY 
        CASE rl.reasoning_level
            WHEN 'none' THEN 1
            WHEN 'minimal' THEN 2
            WHEN 'low' THEN 3
            WHEN 'medium' THEN 4
            WHEN 'high' THEN 5
        END
),
reasoning_levels_aggregated AS (
    SELECT 
        ARRAY_AGG(
            (r.reasoning_level_id, r.reasoning_level, r.generated)::types.q_get_model_v4_reasoning_level_option
            ORDER BY 
                CASE r.reasoning_level
                    WHEN 'none' THEN 1
                    WHEN 'minimal' THEN 2
                    WHEN 'low' THEN 3
                    WHEN 'medium' THEN 4
                    WHEN 'high' THEN 5
                END
        ) as reasoning_levels
    FROM all_reasoning_levels_data r
),
-- Qualities (all available qualities)
all_qualities_data AS (
    SELECT 
        qr.id as quality_id,
        qr.quality::text as quality,
        COALESCE(qr.generated, false) as generated
    FROM qualities_resource qr
    WHERE qr.active = true
    ORDER BY 
        CASE qr.quality
            WHEN 'low' THEN 1
            WHEN 'medium' THEN 2
            WHEN 'high' THEN 3
        END
),
qualities_aggregated AS (
    SELECT 
        ARRAY_AGG(
            (q.quality_id, q.quality, q.generated)::types.q_get_model_v4_quality_option
            ORDER BY 
                CASE q.quality
                    WHEN 'low' THEN 1
                    WHEN 'medium' THEN 2
                    WHEN 'high' THEN 3
                END
        ) as qualities
    FROM all_qualities_data q
),
-- Pricing (all available pricing resources)
all_pricing_data AS (
    SELECT 
        pr.id as pricing_id,
        pr.pricing_type::text as pricing_type,
        u.id as unit_id,
        u.name as unit_name,
        u.unit_category::text as unit_category,
        pr.price,
        COALESCE(pr.generated, false) as generated
    FROM pricing_resource pr
    JOIN artifact_units_relation u ON u.id = pr.unit_id
    WHERE pr.active = true AND u.active = true
    ORDER BY pr.pricing_type, u.name
),
pricing_aggregated_new AS (
    SELECT 
        ARRAY_AGG(
            (p.pricing_id, p.pricing_type, p.unit_id, p.unit_name, p.unit_category, p.price, p.generated)::types.q_get_model_v4_pricing_option
            ORDER BY p.pricing_type, p.unit_name
        ) as pricings
    FROM all_pricing_data p
),
-- Permissions check
permissions_data AS (
    SELECT 
        CASE 
            WHEN (SELECT model_id FROM params) IS NULL THEN
                -- New mode: check if user can create models
                CASE 
                    WHEN up.role IN ('admin'::profile_type, 'superadmin'::profile_type) THEN true
                    ELSE false
                END
            ELSE
                -- Detail mode: check if user can edit model
                CASE 
                    WHEN up.role = 'superadmin'::profile_type THEN true
                    WHEN EXISTS (
                        SELECT 1 FROM model_departments_junction md
                        JOIN user_departments ud ON md.department_id = ud.department_id
                        WHERE md.model_id = (SELECT model_id FROM params)
                        AND md.active = true
                    ) THEN true
                    WHEN NOT EXISTS (
                        SELECT 1 FROM model_departments_junction md2
                        WHERE md2.model_id = (SELECT model_id FROM params)
                        AND md2.active = true
                    ) THEN true
                    ELSE false
                END
        END as can_edit,
        CASE 
            WHEN (SELECT model_id FROM params) IS NULL THEN
                -- New mode: no disabled reason if can_edit is true
                NULL::text
            ELSE
                -- Detail mode: compute disabled_reason
                CASE 
                    WHEN up.role != 'superadmin'::profile_type 
                    AND NOT EXISTS (
                        SELECT 1 FROM model_departments_junction md
                        JOIN user_departments ud ON md.department_id = ud.department_id
                        WHERE md.model_id = (SELECT model_id FROM params)
                        AND md.active = true
                    )
                    AND EXISTS (
                        SELECT 1 FROM model_departments_junction md2
                        WHERE md2.model_id = (SELECT model_id FROM params)
                        AND md2.active = true
                    ) THEN
                        'You do not have access to edit this model. It may be restricted to other departments.'::text
                    ELSE NULL::text
                END
        END as disabled_reason
    FROM params x
    CROSS JOIN user_profile up
),
-- Aggregations
providers_aggregated AS (
    SELECT 
        ARRAY_AGG(pd.provider_id ORDER BY pd.name) as valid_provider_ids,
        ARRAY_AGG(
            ROW(
                pd.provider_id,
                pd.name,
                pd.description,
                false
            )::types.q_get_model_v4_provider_option
            ORDER BY pd.name
        ) as providers
    FROM providers_data pd
),
departments_aggregated AS (
    SELECT 
        ARRAY_AGG(udd.id ORDER BY udd.id) as valid_department_ids,
        ARRAY_AGG(
            ROW(
                udd.id,
                udd.name,
                COALESCE(udd.description, ''),
                false
            )::types.q_get_model_v4_department
            ORDER BY udd.name
        ) as departments
    FROM user_departments_data udd
),
keys_aggregated AS (
    SELECT 
        ARRAY_AGG(kd.key_id ORDER BY kd.key_id) as valid_key_ids,
        ARRAY_AGG(
            ROW(
                kd.key_id,
                kd.name,
                COALESCE(kd.description, ''),
                CASE 
                    WHEN LENGTH(kd.key) > 4 THEN LEFT(kd.key, 4) || '****'
                    ELSE '****'
                END,
                kd.active,
                kd.department_ids,
                false
            )::types.q_get_model_v4_key_option
            ORDER BY kd.name
        ) as keys
    FROM keys_data kd
),
voices_aggregated AS (
    SELECT 
        ARRAY_AGG(
            ROW(
                avd.voice_id,
                avd.voice,
                false
            )::types.q_get_model_v4_voice_option
            ORDER BY avd.voice
        ) as voices
    FROM all_voices_data avd
)
SELECT 
    -- Required fields (first 5)
    up.actor_name::text as actor_name,
    (SELECT model_exists FROM model_exists_check) as model_exists,
    perm.can_edit,
    perm.disabled_reason,
    dgd.group_id,
    -- Single-select resources: name
    (SELECT name_id FROM name_resource_data) as name_id,
    COALESCE((SELECT draft_name_resource FROM name_resource_data), (SELECT model_name_resource FROM name_resource_data)) as name_resource,
    CASE 
        WHEN NOT tec.names_has_tools THEN false
        ELSE uf.show_name
    END as show_name,
    NULL::uuid as name_agent_id,
    true as name_required,
    COALESCE((SELECT name_suggestions FROM name_suggestions_data), ARRAY[]::uuid[]) as name_suggestions,
    COALESCE((SELECT names FROM names_suggestions_objects), '{}'::types.q_get_model_v4_name_option[]) as names,
    -- Single-select resources: description
    (SELECT description_id FROM description_resource_data) as description_id,
    COALESCE((SELECT draft_description_resource FROM description_resource_data), (SELECT model_description_resource FROM description_resource_data)) as description_resource,
    CASE 
        WHEN NOT tec.descriptions_has_tools THEN false
        ELSE uf.show_description
    END as show_description,
    NULL::uuid as description_agent_id,
    false as description_required,
    COALESCE((SELECT description_suggestions FROM description_suggestions_data), ARRAY[]::uuid[]) as description_suggestions,
    COALESCE((SELECT descriptions FROM descriptions_suggestions_objects), '{}'::types.q_get_model_v4_description_option[]) as descriptions,
    -- Single-select resources: flag (active)
    (SELECT active_flag_id FROM flag_resource_data) as active_flag_id,
    CASE
        WHEN (SELECT draft_id FROM params) IS NULL THEN (SELECT model_flag_resource FROM flag_resource_data)
        ELSE (SELECT draft_flag_resource FROM flag_resource_data)
    END as flag_resource,
    CASE 
        WHEN NOT tec.flags_has_tools THEN false
        ELSE uf.show_flag
    END as show_flag,
    NULL::uuid as flag_agent_id,
    false as flag_required,
    COALESCE((SELECT flags FROM flags_aggregated), '{}'::types.q_get_model_v4_flag_option[]) as flags,
    -- Single-select resources: modalities_enabled flag
    (SELECT modalities_enabled_flag_id FROM modalities_enabled_flag_resource_data) as modalities_enabled_flag_id,
    (SELECT modalities_enabled_flag_resource FROM modalities_enabled_flag_resource_data) as modalities_enabled_flag_resource,
    CASE 
        WHEN NOT tec.flags_has_tools THEN false
        ELSE true
    END as show_modalities_enabled_flag,
    NULL::uuid as modalities_enabled_flag_agent_id,
    false as modalities_enabled_flag_required,
    -- Single-select resources: temperature_enabled flag
    (SELECT temperature_enabled_flag_id FROM temperature_enabled_flag_resource_data) as temperature_enabled_flag_id,
    (SELECT temperature_enabled_flag_resource FROM temperature_enabled_flag_resource_data) as temperature_enabled_flag_resource,
    CASE 
        WHEN NOT tec.flags_has_tools THEN false
        ELSE true
    END as show_temperature_enabled_flag,
    NULL::uuid as temperature_enabled_flag_agent_id,
    false as temperature_enabled_flag_required,
    -- Single-select resources: pricing_enabled flag
    (SELECT pricing_enabled_flag_id FROM pricing_enabled_flag_resource_data) as pricing_enabled_flag_id,
    (SELECT pricing_enabled_flag_resource FROM pricing_enabled_flag_resource_data) as pricing_enabled_flag_resource,
    CASE 
        WHEN NOT tec.flags_has_tools THEN false
        ELSE true
    END as show_pricing_enabled_flag,
    NULL::uuid as pricing_enabled_flag_agent_id,
    false as pricing_enabled_flag_required,
    -- Single-select resources: voices_enabled flag
    (SELECT voices_enabled_flag_id FROM voices_enabled_flag_resource_data) as voices_enabled_flag_id,
    (SELECT voices_enabled_flag_resource FROM voices_enabled_flag_resource_data) as voices_enabled_flag_resource,
    CASE 
        WHEN NOT tec.flags_has_tools THEN false
        ELSE true
    END as show_voices_enabled_flag,
    NULL::uuid as voices_enabled_flag_agent_id,
    false as voices_enabled_flag_required,
    -- Single-select resources: reasoning_levels_enabled flag
    (SELECT reasoning_levels_enabled_flag_id FROM reasoning_levels_enabled_flag_resource_data) as reasoning_levels_enabled_flag_id,
    (SELECT reasoning_levels_enabled_flag_resource FROM reasoning_levels_enabled_flag_resource_data) as reasoning_levels_enabled_flag_resource,
    CASE 
        WHEN NOT tec.flags_has_tools THEN false
        ELSE true
    END as show_reasoning_levels_enabled_flag,
    NULL::uuid as reasoning_levels_enabled_flag_agent_id,
    false as reasoning_levels_enabled_flag_required,
    -- Single-select resources: qualities_enabled flag
    (SELECT qualities_enabled_flag_id FROM qualities_enabled_flag_resource_data) as qualities_enabled_flag_id,
    (SELECT qualities_enabled_flag_resource FROM qualities_enabled_flag_resource_data) as qualities_enabled_flag_resource,
    CASE 
        WHEN NOT tec.flags_has_tools THEN false
        ELSE true
    END as show_qualities_enabled_flag,
    NULL::uuid as qualities_enabled_flag_agent_id,
    false as qualities_enabled_flag_required,
    -- Single-select resources: value
    (SELECT value_id FROM value_resource_data) as value_id,
    COALESCE((SELECT draft_value_resource FROM value_resource_data), (SELECT model_value_resource FROM value_resource_data)) as value_resource,
    CASE 
        WHEN NOT tec.values_has_tools THEN false
        ELSE uf.show_value
    END as show_value,
    NULL::uuid as value_agent_id,
    true as value_required,
    COALESCE((SELECT value_suggestions FROM value_suggestions_data), ARRAY[]::uuid[]) as value_suggestions,
    COALESCE((SELECT values FROM values_aggregated), '{}'::types.q_get_model_v4_value_option[]) as values,
    -- Single-select resources: endpoint
    (SELECT endpoint_id FROM endpoint_resource_data) as endpoint_id,
    COALESCE((SELECT draft_endpoint_resource FROM endpoint_resource_data), (SELECT model_endpoint_resource FROM endpoint_resource_data)) as endpoint_resource,
    CASE 
        WHEN NOT tec.endpoints_has_tools THEN false
        ELSE uf.show_endpoint
    END as show_endpoint,
    NULL::uuid as endpoint_agent_id,
    false as endpoint_required,
    COALESCE((SELECT endpoint_suggestions FROM endpoint_suggestions_data), ARRAY[]::uuid[]) as endpoint_suggestions,
    COALESCE((SELECT endpoints FROM endpoints_aggregated), '{}'::types.q_get_model_v4_endpoint_option[]) as endpoints,
    -- Single-select resources: provider
    prd.provider_id,
    prd.provider_resource,
    CASE 
        WHEN NOT tec.providers_has_tools THEN false
        ELSE uf.show_provider
    END as show_provider,
    NULL::uuid as provider_agent_id,
    false as provider_required,
    COALESCE((SELECT provider_suggestions FROM provider_suggestions_data), ARRAY[]::uuid[]) as provider_suggestions,
    COALESCE(pa.providers, '{}'::types.q_get_model_v4_provider_option[]) as providers,
    -- Single-select resources: key
    krd.key_id,
    krd.key_resource,
    CASE 
        WHEN NOT tec.keys_has_tools THEN false
        ELSE uf.show_key
    END as show_key,
    NULL::uuid as key_agent_id,
    false as key_required,
    COALESCE((SELECT key_suggestions FROM key_suggestions_data), ARRAY[]::uuid[]) as key_suggestions,
    COALESCE(ka.keys, '{}'::types.q_get_model_v4_key_option[]) as keys,
    -- Multi-select resources: departments
    COALESCE(
        (SELECT department_ids FROM departments_draft_data),
        COALESCE(mdd.department_ids, mdf.department_ids, ARRAY[]::uuid[])
    ) as department_ids,
    COALESCE(
        (SELECT ARRAY_AGG(
            ROW(
                dmd.id,
                dmd.name,
                dmd.description,
                false
            )::types.q_get_model_v4_department
            ORDER BY dmd.name
        )
        FROM user_departments_data dmd
        WHERE dmd.id = ANY(
            COALESCE(
                (SELECT department_ids FROM departments_draft_data),
                COALESCE(mdd.department_ids, mdf.department_ids, ARRAY[]::uuid[])
            )
        )),
        '{}'::types.q_get_model_v4_department[]
    ) as department_resources,
    CASE 
        WHEN NOT tec.departments_has_tools AND uf.show_departments THEN false
        ELSE uf.show_departments
    END as show_departments,
    NULL::uuid as departments_agent_id,
    CASE 
        WHEN uf.show_departments THEN true
        ELSE false
    END as departments_required,
    COALESCE((SELECT department_suggestions FROM department_suggestions_data), ARRAY[]::uuid[]) as department_suggestions,
    COALESCE(da.departments, '{}'::types.q_get_model_v4_department[]) as departments,
    -- Multi-select resources: input modalities
    COALESCE(
        (SELECT modality_ids FROM modalities_draft_data),
        (SELECT input_modality_ids FROM input_modality_ids_data)
    ) as input_modality_ids,
    COALESCE(
        (SELECT CASE
            WHEN (SELECT draft_id FROM params) IS NULL THEN NULL::types.q_get_model_v4_modality_resource[]
            ELSE COALESCE(ARRAY_AGG(
                (mr.id, mr.modality::text, COALESCE(mr.generated, false))::types.q_get_model_v4_modality_resource
                ORDER BY mr.modality::text
            ), '{}'::types.q_get_model_v4_modality_resource[])
        END
        FROM modalities_drafts_connection dm
        JOIN modalities_resource mr ON mr.id = dm.modalities_id
        WHERE dm.draft_id = (SELECT draft_id FROM params)
        AND mr.active = true),
        (SELECT ARRAY_AGG(
            (mr.id, mr.modality::text, COALESCE(mr.generated, false))::types.q_get_model_v4_modality_resource
            ORDER BY mr.modality::text
        )
        FROM model_modalities_junction mm
        JOIN modalities_resource mr ON mr.id = mm.modality_id
        WHERE mm.model_id = (SELECT model_id FROM params)
        AND (SELECT model_id FROM params) IS NOT NULL
        AND mm.type = 'input'::direction_type
        AND mm.active = true AND mr.active = true),
        '{}'::types.q_get_model_v4_modality_resource[]
    ) as input_modality_resources,
    CASE 
        WHEN NOT tec.modalities_has_tools THEN false
        ELSE uf.show_input_modalities
    END as show_input_modalities,
    NULL::uuid as input_modalities_agent_id,
    true as input_modalities_required,
    COALESCE((SELECT input_modality_suggestions FROM input_modality_suggestions_data), ARRAY[]::uuid[]) as input_modality_suggestions,
    COALESCE((SELECT input_modalities FROM input_modalities_aggregated), '{}'::types.q_get_model_v4_modality_option[]) as input_modalities,
    -- Multi-select resources: output modalities
    COALESCE(
        (SELECT modality_ids FROM modalities_draft_data),
        (SELECT output_modality_ids FROM output_modality_ids_data)
    ) as output_modality_ids,
    COALESCE(
        (SELECT CASE
            WHEN (SELECT draft_id FROM params) IS NULL THEN NULL::types.q_get_model_v4_modality_resource[]
            ELSE COALESCE(ARRAY_AGG(
                (mr.id, mr.modality::text, COALESCE(mr.generated, false))::types.q_get_model_v4_modality_resource
                ORDER BY mr.modality::text
            ), '{}'::types.q_get_model_v4_modality_resource[])
        END
        FROM modalities_drafts_connection dm
        JOIN modalities_resource mr ON mr.id = dm.modalities_id
        WHERE dm.draft_id = (SELECT draft_id FROM params)
        AND mr.active = true),
        (SELECT ARRAY_AGG(
            (mr.id, mr.modality::text, COALESCE(mr.generated, false))::types.q_get_model_v4_modality_resource
            ORDER BY mr.modality::text
        )
        FROM model_modalities_junction mm
        JOIN modalities_resource mr ON mr.id = mm.modality_id
        WHERE mm.model_id = (SELECT model_id FROM params)
        AND (SELECT model_id FROM params) IS NOT NULL
        AND mm.type = 'output'::direction_type
        AND mm.active = true AND mr.active = true),
        '{}'::types.q_get_model_v4_modality_resource[]
    ) as output_modality_resources,
    CASE 
        WHEN NOT tec.modalities_has_tools THEN false
        ELSE uf.show_output_modalities
    END as show_output_modalities,
    NULL::uuid as output_modalities_agent_id,
    true as output_modalities_required,
    COALESCE((SELECT output_modality_suggestions FROM output_modality_suggestions_data), ARRAY[]::uuid[]) as output_modality_suggestions,
    COALESCE((SELECT output_modalities FROM output_modalities_aggregated), '{}'::types.q_get_model_v4_modality_option[]) as output_modalities,
    -- Multi-select resources: temperature levels
    COALESCE(
        (SELECT temperature_level_ids FROM temperature_levels_draft_data),
        (SELECT temperature_level_ids FROM temperature_level_ids_data)
    ) as temperature_level_ids,
    COALESCE(
        (SELECT CASE
            WHEN (SELECT draft_id FROM params) IS NULL THEN NULL::types.q_get_model_v4_temperature_level_resource[]
            ELSE COALESCE(ARRAY_AGG(
                (tl.id, tl.temperature, tl.is_upper, COALESCE(tl.generated, false))::types.q_get_model_v4_temperature_level_resource
                ORDER BY tl.temperature, tl.is_upper
            ), '{}'::types.q_get_model_v4_temperature_level_resource[])
        END
        FROM temperature_levels_drafts_connection dt
        JOIN temperature_levels_resource tl ON tl.id = dt.temperature_levels_id
        WHERE dt.draft_id = (SELECT draft_id FROM params)
        AND tl.active = true),
        (SELECT ARRAY_AGG(
            (tl.id, tl.temperature, tl.is_upper, COALESCE(tl.generated, false))::types.q_get_model_v4_temperature_level_resource
            ORDER BY tl.temperature, tl.is_upper
        )
        FROM model_temperature_levels_junction mtl
        JOIN temperature_levels_resource tl ON tl.id = mtl.temperature_level_id
        WHERE mtl.model_id = (SELECT model_id FROM params)
        AND (SELECT model_id FROM params) IS NOT NULL
        AND mtl.active = true AND tl.active = true),
        '{}'::types.q_get_model_v4_temperature_level_resource[]
    ) as temperature_level_resources,
    CASE 
        WHEN NOT tec.temperature_levels_has_tools THEN false
        ELSE uf.show_temperature_levels
    END as show_temperature_levels,
    NULL::uuid as temperature_levels_agent_id,
    false as temperature_levels_required,
    COALESCE((SELECT temperature_level_suggestions FROM temperature_level_suggestions_data), ARRAY[]::uuid[]) as temperature_level_suggestions,
    COALESCE((SELECT temperature_levels FROM temperature_levels_aggregated), '{}'::types.q_get_model_v4_temperature_level_option[]) as temperature_levels,
    -- Multi-select resources: reasoning levels
    COALESCE(
        (SELECT reasoning_level_ids FROM reasoning_levels_draft_data),
        (SELECT reasoning_level_ids FROM reasoning_level_ids_data)
    ) as reasoning_level_ids,
    COALESCE(
        (SELECT CASE
            WHEN (SELECT draft_id FROM params) IS NULL THEN NULL::types.q_get_model_v4_reasoning_level_resource[]
            ELSE COALESCE(ARRAY_AGG(
                (rl.id, rl.reasoning_level::text, COALESCE(rl.generated, false))::types.q_get_model_v4_reasoning_level_resource
                ORDER BY 
                    CASE rl.reasoning_level
                        WHEN 'none' THEN 1
                        WHEN 'minimal' THEN 2
                        WHEN 'low' THEN 3
                        WHEN 'medium' THEN 4
                        WHEN 'high' THEN 5
                    END
            ), '{}'::types.q_get_model_v4_reasoning_level_resource[])
        END
        FROM reasoning_levels_drafts_connection drl
        JOIN reasoning_levels_resource rl ON rl.id = drl.reasoning_levels_id
        WHERE drl.draft_id = (SELECT draft_id FROM params)
        AND rl.active = true),
        (SELECT ARRAY_AGG(
            (rl.id, rl.reasoning_level::text, COALESCE(rl.generated, false))::types.q_get_model_v4_reasoning_level_resource
            ORDER BY 
                CASE rl.reasoning_level
                    WHEN 'none' THEN 1
                    WHEN 'minimal' THEN 2
                    WHEN 'low' THEN 3
                    WHEN 'medium' THEN 4
                    WHEN 'high' THEN 5
                END
        )
        FROM model_reasoning_levels_junction mrl
        JOIN reasoning_levels_resource rl ON rl.id = mrl.reasoning_level_id
        WHERE mrl.model_id = (SELECT model_id FROM params)
        AND (SELECT model_id FROM params) IS NOT NULL
        AND mrl.active = true AND rl.active = true),
        '{}'::types.q_get_model_v4_reasoning_level_resource[]
    ) as reasoning_level_resources,
    CASE 
        WHEN NOT tec.reasoning_levels_has_tools THEN false
        ELSE uf.show_reasoning_levels
    END as show_reasoning_levels,
    NULL::uuid as reasoning_levels_agent_id,
    false as reasoning_levels_required,
    COALESCE((SELECT reasoning_level_suggestions FROM reasoning_level_suggestions_data), ARRAY[]::uuid[]) as reasoning_level_suggestions,
    COALESCE((SELECT reasoning_levels FROM reasoning_levels_aggregated), '{}'::types.q_get_model_v4_reasoning_level_option[]) as reasoning_levels,
    -- Multi-select resources: qualities
    COALESCE(
        (SELECT quality_ids FROM draft_quality_ids_data),
        (SELECT quality_ids FROM quality_ids_data)
    ) as quality_ids,
    COALESCE(
        (SELECT CASE
            WHEN (SELECT draft_id FROM params) IS NULL THEN NULL::types.q_get_model_v4_quality_resource[]
            ELSE COALESCE(ARRAY_AGG(
                (qr.id, qr.quality::text, COALESCE(qr.generated, false))::types.q_get_model_v4_quality_resource
                ORDER BY 
                    CASE qr.quality
                        WHEN 'low' THEN 1
                        WHEN 'medium' THEN 2
                        WHEN 'high' THEN 3
                    END
            ), '{}'::types.q_get_model_v4_quality_resource[])
        END
        FROM qualities_drafts_connection dq
        JOIN qualities_resource qr ON qr.id = dq.qualities_id
        WHERE dq.draft_id = (SELECT draft_id FROM params)
        AND qr.active = true),
        (SELECT ARRAY_AGG(
            (qr.id, qr.quality::text, COALESCE(qr.generated, false))::types.q_get_model_v4_quality_resource
            ORDER BY 
                CASE qr.quality
                    WHEN 'low' THEN 1
                    WHEN 'medium' THEN 2
                    WHEN 'high' THEN 3
                END
        )
        FROM model_qualities_junction mq
        JOIN qualities_resource qr ON qr.id = mq.quality_id
        WHERE mq.model_id = (SELECT model_id FROM params)
        AND (SELECT model_id FROM params) IS NOT NULL
        AND mq.active = true AND qr.active = true),
        '{}'::types.q_get_model_v4_quality_resource[]
    ) as quality_resources,
    CASE 
        WHEN NOT tec.qualities_has_tools THEN false
        ELSE uf.show_qualities
    END as show_qualities,
    NULL::uuid as qualities_agent_id,
    false as qualities_required,
    COALESCE((SELECT quality_suggestions FROM quality_suggestions_data), ARRAY[]::uuid[]) as quality_suggestions,
    COALESCE((SELECT qualities FROM qualities_aggregated), '{}'::types.q_get_model_v4_quality_option[]) as qualities,
    -- Multi-select resources: pricing
    COALESCE(
        (SELECT pricing_ids FROM pricing_draft_ids_data),
        (SELECT pricing_ids FROM pricing_ids_data)
    ) as pricing_ids,
    COALESCE(
        (SELECT CASE
            WHEN (SELECT draft_id FROM params) IS NULL THEN NULL::types.q_get_model_v4_pricing_resource[]
            ELSE COALESCE(ARRAY_AGG(
                (pr.id, pr.pricing_type::text, u.id, u.name, u.unit_category::text, pr.price, COALESCE(pr.generated, false))::types.q_get_model_v4_pricing_resource
                ORDER BY pr.pricing_type, u.name
            ), '{}'::types.q_get_model_v4_pricing_resource[])
        END
        FROM pricing_drafts_connection dp
        JOIN pricing_resource pr ON pr.id = dp.pricing_id
        JOIN artifact_units_relation u ON u.id = pr.unit_id
        WHERE dp.draft_id = (SELECT draft_id FROM params)
        AND pr.active = true AND u.active = true),
        (SELECT ARRAY_AGG(
            (pr.id, pr.pricing_type::text, u.id, u.name, u.unit_category::text, pr.price, COALESCE(pr.generated, false))::types.q_get_model_v4_pricing_resource
            ORDER BY pr.pricing_type, u.name
        )
        FROM model_pricing_junction mp
        JOIN pricing_resource pr ON pr.id = mp.pricing_id
        JOIN artifact_units_relation u ON u.id = pr.unit_id
        WHERE mp.model_id = (SELECT model_id FROM params)
        AND (SELECT model_id FROM params) IS NOT NULL
        AND mp.active = true AND pr.active = true AND u.active = true),
        '{}'::types.q_get_model_v4_pricing_resource[]
    ) as pricing_resources,
    CASE 
        WHEN NOT tec.pricing_has_tools THEN false
        ELSE uf.show_pricing
    END as show_pricing,
    NULL::uuid as pricing_agent_id,
    false as pricing_required,
    COALESCE((SELECT pricing_suggestions FROM pricing_suggestions_data), ARRAY[]::uuid[]) as pricing_suggestions,
    COALESCE((SELECT pricings FROM pricing_aggregated_new), '{}'::types.q_get_model_v4_pricing_option[]) as pricings,
    -- Multi-select resources: voices
    COALESCE((SELECT voice_ids FROM voice_ids_data), ARRAY[]::uuid[]) as voice_ids,
    COALESCE((SELECT voice_resources FROM voice_resources_data), '{}'::types.q_get_model_v4_voice_resource[]) as voice_resources,
    CASE 
        WHEN NOT tec.voices_has_tools THEN false
        ELSE uf.show_voices
    END as show_voices,
    NULL::uuid as voices_agent_id,
    false as voices_required,
    COALESCE((SELECT voice_suggestions FROM voice_suggestions_data), ARRAY[]::uuid[]) as voice_suggestions,
    COALESCE(voa.voices, '{}'::types.q_get_model_v4_voice_option[]) as voices
FROM user_profile up
CROSS JOIN permissions_data perm
CROSS JOIN ui_flags uf
CROSS JOIN tools_existence_check tec
CROSS JOIN draft_group_data dgd
CROSS JOIN name_resource_data nrd
CROSS JOIN description_resource_data drd
CROSS JOIN flag_resource_data frd
CROSS JOIN modalities_enabled_flag_resource_data mefrd
CROSS JOIN temperature_enabled_flag_resource_data tefrd
CROSS JOIN pricing_enabled_flag_resource_data pefrd
CROSS JOIN voices_enabled_flag_resource_data vefrd
CROSS JOIN reasoning_levels_enabled_flag_resource_data rlefrd
CROSS JOIN qualities_enabled_flag_resource_data qefrd
CROSS JOIN value_resource_data vrd
CROSS JOIN endpoint_resource_data erd
CROSS JOIN provider_resource_data prd
CROSS JOIN key_resource_data krd
CROSS JOIN name_suggestions_data nsd
CROSS JOIN description_suggestions_data dsd
CROSS JOIN flag_suggestions_data fsd
CROSS JOIN value_suggestions_data vsd
CROSS JOIN endpoint_suggestions_data esd
CROSS JOIN input_modality_suggestions_data imsd
CROSS JOIN output_modality_suggestions_data omsd
CROSS JOIN temperature_level_suggestions_data tlsd
CROSS JOIN reasoning_level_suggestions_data rlsd
CROSS JOIN quality_suggestions_data qsd
CROSS JOIN pricing_suggestions_data psd
CROSS JOIN provider_suggestions_data prsd
CROSS JOIN key_suggestions_data ksd
CROSS JOIN department_suggestions_data dedsd
CROSS JOIN voice_suggestions_data vosd
CROSS JOIN names_suggestions_objects nso
CROSS JOIN descriptions_suggestions_objects dso
CROSS JOIN flags_aggregated fa
CROSS JOIN values_aggregated va
CROSS JOIN endpoints_aggregated ea
CROSS JOIN input_modalities_aggregated ima
CROSS JOIN output_modalities_aggregated oma
CROSS JOIN temperature_levels_aggregated tla
CROSS JOIN reasoning_levels_aggregated rla
CROSS JOIN qualities_aggregated qa
CROSS JOIN pricing_aggregated_new pan
CROSS JOIN providers_aggregated pa
CROSS JOIN departments_aggregated da
CROSS JOIN keys_aggregated ka
CROSS JOIN voices_aggregated voa
LEFT JOIN model_departments_data mdd ON true
LEFT JOIN model_departments_fallback mdf ON true
LEFT JOIN input_modality_ids_data imid ON true
LEFT JOIN output_modality_ids_data omid ON true
LEFT JOIN temperature_level_ids_data tlid ON true
LEFT JOIN reasoning_level_ids_data rlid ON true
LEFT JOIN quality_ids_data qid ON true
LEFT JOIN pricing_ids_data pid ON true
LEFT JOIN voice_ids_data vid ON true
LEFT JOIN voice_resources_data vrd2 ON true
$$;
