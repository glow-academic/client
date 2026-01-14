-- Unified get model function - handles both new (model_id = NULL) and detail (model_id provided)
-- Converted to function with composite types
-- Follows RETURN_STRUCTURE_GUIDELINES.md pattern
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

CREATE TYPE types.q_get_model_v4_pricing AS (
    pricing_type text,
    unit_id uuid,
    unit_name text,
    unit_category text,
    price float
);

CREATE TYPE types.q_get_model_v4_unit AS (
    unit_id uuid,
    name text,
    unit_category text,
    value int
);

CREATE TYPE types.q_get_model_v4_modalities AS (
    input text[],
    output text[]
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
    -- Model fields
    name text,
    description text,
    active boolean,
    image_model boolean,
    provider text,
    provider_name text,
    value text,
    base_url text,
    temperature_lower float,
    temperature_upper float,
    temperature_values text[],
    pricing types.q_get_model_v4_pricing[],
    modalities types.q_get_model_v4_modalities,
    reasoning_levels text[],
    qualities text[],
    units types.q_get_model_v4_unit[],
    draft_version int,
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
draft_payload_data AS (
    SELECT 
        NULL::jsonb as payload,
        d.version as draft_version
    FROM params x
    JOIN drafts d ON d.id = x.draft_id
    WHERE x.draft_id IS NOT NULL
    AND d.profile_id = x.profile_id
    LIMIT 1
),
-- Get group_id from draft (should always exist after migration, but handle NULL case)
draft_group_data AS (
    SELECT 
        COALESCE(
            d.group_id,
            (SELECT id FROM groups ORDER BY created_at DESC LIMIT 1)
        ) as group_id
    FROM params x
    LEFT JOIN drafts d ON d.id = x.draft_id
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
        COALESCE(COALESCE((SELECT n.name FROM profile_names pn JOIN names_resource n ON pn.name_id = n.id WHERE pn.profile_id = p.id AND pn.type = 'first' LIMIT 1) || ' ' || (SELECT n2.name FROM profile_names pn2 JOIN names_resource n2 ON pn2.name_id = n2.id WHERE pn2.profile_id = p.id AND pn2.type = 'last' LIMIT 1), ''), 'System') as actor_name
    FROM profile_artifact p
    WHERE p.id = (SELECT profile_id FROM params)::uuid
),
user_profile AS (
    SELECT 
        (SELECT r.role FROM profile_roles pr_j JOIN roles_resource r ON pr_j.role_id = r.id WHERE pr_j.profile_id = p.id LIMIT 1) as role,
        ap.actor_name
    FROM params x
    JOIN profile_artifact p ON p.id = x.profile_id
    CROSS JOIN actor_profile ap
),
user_departments AS (
    SELECT DISTINCT pd.department_id
    FROM resolve_profile_id rpi
    JOIN profile_departments pd ON pd.profile_id = rpi.resolved_profile_id
    WHERE pd.active = true
),
user_departments_data AS (
    SELECT DISTINCT 
        d.id, 
        (SELECT n.name FROM department_names dn JOIN names_resource n ON dn.name_id = n.id WHERE dn.department_id = d.id LIMIT 1) as name, 
        (SELECT d2.description FROM department_descriptions dd JOIN descriptions_resource d2 ON dd.description_id = d2.id WHERE dd.department_id = d.id LIMIT 1) as description
    FROM department_artifact d
    JOIN resolve_profile_id rpi ON true
    JOIN profile_departments pd ON d.id = pd.department_id
    WHERE EXISTS (SELECT 1 FROM department_flags df WHERE df.department_id = d.id AND df.type = 'active'::type_department_flags AND df.value = true)
    AND pd.profile_id = rpi.resolved_profile_id
    AND pd.active = true
),
-- Model data (only if model_id provided)
model_data AS (
    SELECT 
        (SELECT n.name FROM model_names mn JOIN names_resource n ON mn.name_id = n.id WHERE mn.model_id = m.id LIMIT 1) as name,
        (SELECT d.description FROM model_descriptions md JOIN descriptions_resource d ON md.description_id = d.id WHERE md.model_id = m.id LIMIT 1) as description,
        EXISTS (SELECT 1 FROM model_flags mf WHERE mf.model_id = m.id AND mf.type = 'active'::type_model_flags AND mf.value = TRUE) as active,
        (SELECT v.value FROM model_values mv JOIN values_resource v ON mv.value_id = v.id WHERE mv.model_id = m.id LIMIT 1),
        (SELECT n.name FROM model_providers mp JOIN providers_resource p ON p.id = mp.providers_id JOIN provider_artifact pr ON pr.id = p.provider_id JOIN provider_names pn ON pn.provider_id = pr.id JOIN names_resource n ON n.id = pn.name_id JOIN models_resource m_res ON m_res.id = mp.model_id WHERE m_res.model_id = m.id LIMIT 1) as provider,
        (SELECT n.name FROM model_providers mp JOIN providers_resource p ON p.id = mp.providers_id JOIN provider_artifact pr ON pr.id = p.provider_id JOIN provider_names pn ON pn.provider_id = pr.id JOIN names_resource n ON n.id = pn.name_id JOIN models_resource m_res ON m_res.id = mp.model_id WHERE m_res.model_id = m.id LIMIT 1) as provider_name
    FROM model_artifact m
    WHERE m.id = (SELECT model_id FROM params)
    AND (SELECT model_id FROM params) IS NOT NULL
),
-- Determine if model is an image model (has 'image' output modality)
image_model_check AS (
    SELECT 
        CASE WHEN COUNT(*) > 0 THEN true ELSE false END as image_model
    FROM model_modalities mm
    JOIN modalities_resource mr ON mr.id = mm.modality_id
    WHERE mm.model_id = (SELECT model_id FROM params)
    AND (SELECT model_id FROM params) IS NOT NULL
    AND mr.modality = 'image' AND mm.type = 'output'::type_model_modalities AND mm.active = true
),
model_endpoint_data AS (
    SELECT 
        COALESCE(e.base_url, '') as base_url
    FROM model_artifact m
    LEFT JOIN model_endpoints me_j ON me_j.model_id = m.id
    LEFT JOIN endpoints_resource e ON e.id = me_j.endpoint_id AND e.active = true
    WHERE m.id = (SELECT model_id FROM params)
    AND (SELECT model_id FROM params) IS NOT NULL
    LIMIT 1
),
model_departments_data AS (
    SELECT 
        md.model_id,
        ARRAY_AGG(md.department_id ORDER BY md.created_at) as department_ids
    FROM model_departments md
    WHERE md.model_id = (SELECT model_id FROM params)
    AND (SELECT model_id FROM params) IS NOT NULL
    AND md.active = true
    GROUP BY md.model_id
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
    FROM model_temperature_levels mtl
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
    FROM model_pricing mp
    JOIN pricing_resource pr ON pr.id = mp.pricing_id
    JOIN units u ON u.id = pr.unit_id
    WHERE mp.model_id = (SELECT model_id FROM params)
    AND (SELECT model_id FROM params) IS NOT NULL
    AND mp.active = true AND pr.active = true AND u.active = true
    ORDER BY pr.pricing_type, u.name
),
model_modalities_data AS (
    SELECT 
        ARRAY_AGG(mr.modality::text ORDER BY mr.modality::text) FILTER (WHERE mm.type = 'input'::type_model_modalities) as input_modalities,
        ARRAY_AGG(mr.modality::text ORDER BY mr.modality::text) FILTER (WHERE mm.type = 'output'::type_model_modalities) as output_modalities
    FROM model_modalities mm
    JOIN modalities_resource mr ON mr.id = mm.modality_id
    WHERE mm.model_id = (SELECT model_id FROM params)
    AND (SELECT model_id FROM params) IS NOT NULL
    AND mm.active = true AND mr.active = true
),
model_reasoning_levels_data AS (
    SELECT 
        ARRAY_AGG(reasoning_level::text ORDER BY 
            CASE reasoning_level
                WHEN 'none' THEN 1
                WHEN 'minimal' THEN 2
                WHEN 'low' THEN 3
                WHEN 'medium' THEN 4
                WHEN 'high' THEN 5
            END
        ) as reasoning_levels
    FROM model_reasoning_levels mrl
    JOIN reasoning_levels_resource rl ON rl.id = mrl.reasoning_level_id
    WHERE mrl.model_id = (SELECT model_id FROM params)
    AND (SELECT model_id FROM params) IS NOT NULL
    AND rl.active = true
),
model_qualities_data AS (
    SELECT 
        ARRAY_AGG(qr.quality::text ORDER BY 
            CASE qr.quality
                WHEN 'low' THEN 1
                WHEN 'medium' THEN 2
                WHEN 'high' THEN 3
            END
        ) as qualities
    FROM model_qualities mq
    JOIN qualities_resource qr ON qr.id = mq.quality_id
    WHERE mq.model_id = (SELECT model_id FROM params)
    AND (SELECT model_id FROM params) IS NOT NULL
    AND mq.active = true AND qr.active = true
),
model_voices_data AS (
    SELECT 
        v.id as voice_id,
        v.voice::text as voice
    FROM model_voices mv
    JOIN voices_resource v ON v.id = mv.voice_id
    WHERE mv.model_id = (SELECT model_id FROM params)
    AND (SELECT model_id FROM params) IS NOT NULL
    AND v.active = true
    ORDER BY v.voice::text
),
all_units_data AS (
    SELECT 
        id as unit_id,
        name,
        unit_category::text as unit_category,
        value
    FROM units
    WHERE active = true
    ORDER BY unit_category, value, name
),
-- Providers data (all available providers)
providers_data AS (
    SELECT DISTINCT
        p.id as provider_id,
        n.name as name,
        COALESCE((SELECT d.description FROM provider_descriptions pd JOIN descriptions_resource d ON pd.description_id = d.id WHERE pd.provider_id = pr.id LIMIT 1), '') as description
    FROM providers_resource p
    JOIN provider_artifact pr ON pr.id = p.provider_id
    JOIN provider_names pn ON pn.provider_id = pr.id
    JOIN names_resource n ON n.id = pn.name_id
    WHERE p.active = true
    ORDER BY n.name
),
-- Provider resource (selected provider for model)
provider_resource_data AS (
    SELECT 
        CASE 
            WHEN (SELECT model_id FROM params) IS NULL THEN NULL::uuid
            ELSE (
                SELECT p.id 
                FROM model_providers mp 
                JOIN providers_resource p ON p.id = mp.providers_id 
                JOIN models_resource m_res ON m_res.id = mp.model_id 
                WHERE m_res.model_id = (SELECT model_id FROM params) 
                LIMIT 1
            )
        END as provider_id,
        CASE 
            WHEN (SELECT model_id FROM params) IS NULL THEN NULL::types.q_get_model_v4_provider_resource
            ELSE (
                SELECT ROW(
                    p.id,
                    n.name,
                    COALESCE((SELECT d.description FROM provider_descriptions pd JOIN descriptions_resource d ON pd.description_id = d.id WHERE pd.provider_id = pr.id LIMIT 1), ''),
                    false
                )::types.q_get_model_v4_provider_resource
                FROM model_providers mp 
                JOIN providers_resource p ON p.id = mp.providers_id 
                JOIN provider_artifact pr ON pr.id = p.provider_id
                JOIN provider_names pn ON pn.provider_id = pr.id
                JOIN names_resource n ON n.id = pn.name_id
                JOIN models_resource m_res ON m_res.id = mp.model_id 
                WHERE m_res.model_id = (SELECT model_id FROM params) 
                LIMIT 1
            )
        END as provider_resource
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
        (SELECT n.name FROM key_names kn JOIN names_resource n ON kn.name_id = n.id WHERE kn.key_id = kr.id LIMIT 1) as name,
        kr.key,
        COALESCE((SELECT d.description FROM key_descriptions kd JOIN descriptions_resource d ON kd.description_id = d.id WHERE kd.key_id = kr.id LIMIT 1), '') as description,
        EXISTS (SELECT 1 FROM key_flags kf WHERE kf.key_id = kr.id AND kf.type = 'active'::type_key_flags AND kf.value = TRUE) as active,
        ARRAY_AGG(DISTINCT ds.department_id) FILTER (WHERE ds.department_id IS NOT NULL) as department_ids
    FROM model_artifact m
    JOIN models_resource m_res ON m_res.model_id = m.id
    LEFT JOIN model_providers mp ON mp.model_id = m_res.id
    LEFT JOIN providers_resource p ON p.id = mp.providers_id
    LEFT JOIN provider_artifact pr ON pr.id = p.provider_id
    LEFT JOIN provider_names pn ON pn.provider_id = pr.id
    LEFT JOIN names_resource n_prov ON n_prov.id = pn.name_id
    JOIN setting_provider_keys spk ON spk.providers_id = p.id AND spk.active = true
    JOIN keys_resource kr ON kr.id = spk.key_id AND EXISTS (SELECT 1 FROM key_flags kf WHERE kf.key_id = kr.id AND kf.type = 'active'::type_key_flags AND kf.value = TRUE) = true
    JOIN setting_artifact s ON s.id = spk.settings_id AND EXISTS (SELECT 1 FROM scenario_flags sf WHERE sf.scenario_id = s.id AND sf.type = 'active'::type_scenario_flags AND sf.value = true)
    JOIN department_settings ds ON ds.settings_id = s.id AND ds.active = true
    WHERE m.id = (SELECT model_id FROM params)
    AND (SELECT model_id FROM params) IS NOT NULL
    AND ds.active = true
    GROUP BY spk.key_id, (SELECT n.name FROM key_names kn JOIN names_resource n ON kn.name_id = n.id WHERE kn.key_id = kr.id LIMIT 1), kr.key, COALESCE((SELECT d.description FROM key_descriptions kd JOIN descriptions_resource d ON kd.description_id = d.id WHERE kd.key_id = kr.id LIMIT 1), ''), EXISTS (SELECT 1 FROM key_flags kf WHERE kf.key_id = kr.id AND kf.type = 'active'::type_key_flags AND kf.value = TRUE)
    
    UNION ALL
    
    -- General keys (keys without department links that user has access to)
    -- Works for both new and detail modes
    SELECT DISTINCT
        kr.id as key_id,
        (SELECT n.name FROM key_names kn JOIN names_resource n ON kn.name_id = n.id WHERE kn.key_id = kr.id LIMIT 1) as name,
        kr.key,
        COALESCE((SELECT d.description FROM key_descriptions kd JOIN descriptions_resource d ON kd.description_id = d.id WHERE kd.key_id = kr.id LIMIT 1), '') as description,
        EXISTS (SELECT 1 FROM key_flags kf WHERE kf.key_id = kr.id AND kf.type = 'active'::type_key_flags AND kf.value = TRUE),
        NULL::uuid[] as department_ids
    FROM keys_resource kr
    CROSS JOIN resolve_profile_id rpi
    WHERE EXISTS (SELECT 1 FROM key_flags kf WHERE kf.key_id = kr.id AND kf.type = 'active'::type_key_flags AND kf.value = TRUE) = true
    AND (
        (SELECT model_id FROM params) IS NULL
        OR NOT EXISTS (
            -- Exclude keys already included via setting_provider_keys for this model's provider
            SELECT 1 FROM model_artifact m2
            JOIN models_resource m_res2 ON m_res2.model_id = m2.id
            JOIN model_providers mp2 ON mp2.model_id = m_res2.id
            JOIN providers_resource p2 ON p2.id = mp2.providers_id
            JOIN setting_provider_keys spk2 ON spk2.providers_id = p2.id AND spk2.key_id = kr.id AND spk2.active = true
            WHERE m2.id = (SELECT model_id FROM params)
        )
    )
    AND (
        -- Include keys with no settings links (general keys)
        NOT EXISTS (
            SELECT 1 FROM setting_provider_keys spk3
            WHERE spk3.key_id = kr.id AND spk3.active = true
        )
        OR
        -- Include keys with settings links that match user's departments
        EXISTS (
            SELECT 1 FROM setting_provider_keys spk4
            JOIN setting_artifact s4 ON s4.id = spk4.settings_id AND EXISTS (SELECT 1 FROM setting_flags sf WHERE sf.setting_id = s4.id AND sf.type = 'active'::type_setting_flags AND sf.value = TRUE)
            JOIN department_settings ds4 ON ds4.settings_id = s4.id AND ds4.active = true
            JOIN user_departments ud ON ud.department_id = ds4.department_id
            WHERE spk4.key_id = kr.id AND spk4.active = true
        )
        OR
        -- Superadmin can see all keys
        EXISTS (SELECT 1 FROM resolve_profile_id rpi2 JOIN profile_artifact p ON p.id = rpi2.resolved_profile_id WHERE rpi2.resolved_profile_id = rpi.resolved_profile_id AND EXISTS (SELECT 1 FROM profile_roles pr_j JOIN roles_resource r ON pr_j.role_id = r.id WHERE pr_j.profile_id = p.id AND r.role = 'superadmin'::profile_role))
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
        ARRAY_AGG(
            ROW(
                v.id,
                v.voice::text,
                false
            )::types.q_get_model_v4_voice_resource
            ORDER BY v.voice::text
        ) as voice_resources
    FROM model_voices mv
    JOIN voices_resource v ON v.id = mv.voice_id
    WHERE mv.model_id = (SELECT model_id FROM params)
    AND (SELECT model_id FROM params) IS NOT NULL
    AND v.active = true
),
voice_ids_data AS (
    SELECT 
        CASE 
            WHEN (SELECT model_id FROM params) IS NULL THEN ARRAY[]::uuid[]
            ELSE ARRAY_AGG(v.id ORDER BY v.voice::text)::uuid[]
        END as voice_ids
    FROM model_voices mv
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
-- Tool existence checks (models don't use tools, but we check for consistency)
tools_existence_check AS (
    SELECT 
        EXISTS (
            SELECT 1 FROM resource_tools rt
            JOIN tool_artifact t ON t.id = rt.tool_id
            WHERE rt.resource = 'providers'::resources 
              AND EXISTS (SELECT 1 FROM tool_flags tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'active' AND tf.type = 'active'::type_tool_flags AND tf.value = true)
        ) as providers_has_tools,
        EXISTS (
            SELECT 1 FROM resource_tools rt
            JOIN tool_artifact t ON t.id = rt.tool_id
            WHERE rt.resource = 'keys'::resources 
              AND EXISTS (SELECT 1 FROM tool_flags tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'active' AND tf.type = 'active'::type_tool_flags AND tf.value = true)
        ) as keys_has_tools,
        EXISTS (
            SELECT 1 FROM resource_tools rt
            JOIN tool_artifact t ON t.id = rt.tool_id
            WHERE rt.resource = 'departments'::resources 
              AND EXISTS (SELECT 1 FROM tool_flags tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'active' AND tf.type = 'active'::type_tool_flags AND tf.value = true)
        ) as departments_has_tools,
        EXISTS (
            SELECT 1 FROM resource_tools rt
            JOIN tool_artifact t ON t.id = rt.tool_id
            WHERE rt.resource = 'voices'::resources 
              AND EXISTS (SELECT 1 FROM tool_flags tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'active' AND tf.type = 'active'::type_tool_flags AND tf.value = true)
        ) as voices_has_tools
    FROM params x
),
-- UI flags
ui_flags AS (
    SELECT 
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
            WHEN (SELECT COUNT(*) FROM all_voices_data) > 0 THEN true
            ELSE false
        END as show_voices
    FROM params x
),
-- Permissions check
permissions_data AS (
    SELECT 
        CASE 
            WHEN (SELECT model_id FROM params) IS NULL THEN
                -- New mode: check if user can create models
                CASE 
                    WHEN up.role IN ('admin'::profile_role, 'superadmin'::profile_role) THEN true
                    ELSE false
                END
            ELSE
                -- Detail mode: check if user can edit model
                CASE 
                    WHEN up.role = 'superadmin'::profile_role THEN true
                    WHEN EXISTS (
                        SELECT 1 FROM model_departments md
                        JOIN user_departments ud ON md.department_id = ud.department_id
                        WHERE md.model_id = (SELECT model_id FROM params)
                        AND md.active = true
                    ) THEN true
                    WHEN NOT EXISTS (
                        SELECT 1 FROM model_departments md2
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
                    WHEN up.role != 'superadmin'::profile_role 
                    AND NOT EXISTS (
                        SELECT 1 FROM model_departments md
                        JOIN user_departments ud ON md.department_id = ud.department_id
                        WHERE md.model_id = (SELECT model_id FROM params)
                        AND md.active = true
                    )
                    AND EXISTS (
                        SELECT 1 FROM model_departments md2
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
),
units_aggregated AS (
    SELECT 
        ARRAY_AGG(
            ROW(
                aud.unit_id,
                aud.name,
                aud.unit_category,
                aud.value
            )::types.q_get_model_v4_unit
            ORDER BY aud.unit_category, aud.value, aud.name
        ) as units
    FROM all_units_data aud
),
pricing_aggregated AS (
    SELECT 
        ARRAY_AGG(
            ROW(
                mpd.pricing_type,
                mpd.unit_id,
                mpd.unit_name,
                mpd.unit_category,
                mpd.price
            )::types.q_get_model_v4_pricing
            ORDER BY mpd.pricing_type, mpd.unit_name
        ) as pricing
    FROM model_pricing_data mpd
)
SELECT 
    -- Required fields (first 5)
    up.actor_name::text as actor_name,
    (SELECT model_exists FROM model_exists_check) as model_exists,
    perm.can_edit,
    perm.disabled_reason,
    dgd.group_id,
    -- Model fields
    COALESCE(
        (SELECT payload->>'name' FROM draft_payload_data),
        md.name,
        ''::text
    ) as name,
    COALESCE(
        (SELECT payload->>'description' FROM draft_payload_data),
        md.description,
        ''::text
    ) as description,
    COALESCE(
        (SELECT (payload->>'active')::boolean FROM draft_payload_data),
        md.active,
        false
    ) as active,
    COALESCE(imc.image_model, false) as image_model,
    md.provider,
    md.provider_name,
    COALESCE(
        (SELECT payload->>'value' FROM draft_payload_data),
        md.value,
        ''::text
    ) as value,
    COALESCE(
        (SELECT payload->>'base_url' FROM draft_payload_data),
        COALESCE(med.base_url, ''),
        ''::text
    ) as base_url,
    COALESCE(
        (SELECT (payload->'temperature_bounds'->>'lower')::float FROM draft_payload_data),
        COALESCE(mtd.temperature_lower, 0.0),
        0.0
    ) as temperature_lower,
    COALESCE(
        (SELECT (payload->'temperature_bounds'->>'upper')::float FROM draft_payload_data),
        COALESCE(mtd.temperature_upper, 1.0),
        1.0
    ) as temperature_upper,
    COALESCE(mtd.temperature_values, ARRAY[]::text[]) as temperature_values,
    COALESCE(
        (SELECT 
            ARRAY_AGG(
                ROW(
                    pricing_entry->>'type', 
                    (pricing_entry->>'unit_id')::uuid,
                    u.name,
                    u.unit_category::text,
                    (pricing_entry->>'price')::float
                )::types.q_get_model_v4_pricing
            )
            FROM jsonb_array_elements((SELECT payload->'pricing' FROM draft_payload_data)) AS pricing_entry
            JOIN units u ON u.id = (pricing_entry->>'unit_id')::uuid AND u.active = true
        ),
        COALESCE(pra.pricing, '{}'::types.q_get_model_v4_pricing[])
    ) as pricing,
    COALESCE(
        (SELECT 
            ROW(
                ARRAY(SELECT jsonb_array_elements_text(payload->'modalities'->'input')),
                ARRAY(SELECT jsonb_array_elements_text(payload->'modalities'->'output'))
            )::types.q_get_model_v4_modalities
            FROM draft_payload_data
        ),
        COALESCE(
            (COALESCE(mmod.input_modalities, ARRAY[]::text[]), COALESCE(mmod.output_modalities, ARRAY[]::text[]))::types.q_get_model_v4_modalities,
            (ARRAY[]::text[], ARRAY[]::text[])::types.q_get_model_v4_modalities
        )
    ) as modalities,
    COALESCE(
        (SELECT ARRAY(SELECT jsonb_array_elements_text(payload->'reasoning_levels')) FROM draft_payload_data),
        COALESCE(mrl.reasoning_levels, ARRAY[]::text[])
    ) as reasoning_levels,
    COALESCE(
        (SELECT ARRAY(SELECT jsonb_array_elements_text(payload->'qualities')) FROM draft_payload_data),
        COALESCE(mq.qualities, ARRAY[]::text[])
    ) as qualities,
    COALESCE(ua.units, '{}'::types.q_get_model_v4_unit[]) as units,
    COALESCE((SELECT draft_version FROM draft_payload_data), 0) as draft_version,
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
        CASE 
            WHEN (SELECT payload->'department_ids' FROM draft_payload_data) IS NOT NULL AND jsonb_typeof((SELECT payload->'department_ids' FROM draft_payload_data)) = 'array' THEN
                ARRAY(SELECT jsonb_array_elements_text((SELECT payload->'department_ids' FROM draft_payload_data)))::uuid[]
            ELSE NULL
        END,
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
                CASE 
                    WHEN (SELECT payload->'department_ids' FROM draft_payload_data) IS NOT NULL AND jsonb_typeof((SELECT payload->'department_ids' FROM draft_payload_data)) = 'array' THEN
                        ARRAY(SELECT jsonb_array_elements_text((SELECT payload->'department_ids' FROM draft_payload_data)))::uuid[]
                    ELSE NULL
                END,
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
    COALESCE(va.voices, '{}'::types.q_get_model_v4_voice_option[]) as voices
FROM user_profile up
CROSS JOIN permissions_data perm
CROSS JOIN ui_flags uf
CROSS JOIN tools_existence_check tec
CROSS JOIN draft_group_data dgd
CROSS JOIN provider_resource_data prd
CROSS JOIN key_resource_data krd
CROSS JOIN provider_suggestions_data psd
CROSS JOIN key_suggestions_data ksd
CROSS JOIN department_suggestions_data dsd
CROSS JOIN voice_suggestions_data vsd
CROSS JOIN providers_aggregated pa
CROSS JOIN departments_aggregated da
CROSS JOIN keys_aggregated ka
CROSS JOIN voices_aggregated va
CROSS JOIN units_aggregated ua
LEFT JOIN model_data md ON true
LEFT JOIN image_model_check imc ON true
LEFT JOIN model_endpoint_data med ON true
LEFT JOIN model_departments_data mdd ON true
LEFT JOIN model_departments_fallback mdf ON true
LEFT JOIN model_temperature_data mtd ON true
LEFT JOIN model_modalities_data mmod ON true
LEFT JOIN model_reasoning_levels_data mrl ON true
LEFT JOIN model_qualities_data mq ON true
LEFT JOIN pricing_aggregated pra ON true
LEFT JOIN voice_ids_data vid ON true
LEFT JOIN voice_resources_data vrd ON true
$$;
