-- Get all data needed for image generation AND create run in single atomic transaction
-- Parameters: $1=image_id (uuid), $2=agent_id (uuid), $3=profile_id (uuid, nullable), $4=department_id (uuid, nullable)
-- Returns: agent model info (api_key, base_url, model_name, provider), run_id
-- Creates run record atomically (upload is created in completion handler)
WITH params AS (
    -- Explicitly cast parameters for asyncpg type inference
    SELECT 
        $1::uuid as image_id,
        $2::uuid as agent_id,
        $3::uuid as profile_id,
        $4::uuid as department_id
),
default_guest AS (
    -- Get default guest profile from settings system
    SELECT sdg.profile_id::text as guest_profile_id
    FROM settings_default_guest sdg
    JOIN settings s ON s.id = sdg.settings_id AND s.active = true
    WHERE sdg.active = true
    LIMIT 1
),
final_profile AS (
    -- Use provided profile_id or default guest profile
    SELECT COALESCE(
        (SELECT profile_id FROM params WHERE profile_id IS NOT NULL),
        (SELECT guest_profile_id::uuid FROM default_guest)
    ) as final_profile_id
),
-- Get default settings (for key lookup via setting_provider_keys)
default_settings AS (
    -- Get settings with no department links (cross-department/default)
    SELECT s.id as settings_id
    FROM settings s
    WHERE s.active = true
      AND NOT EXISTS (
          SELECT 1 FROM department_settings sd 
          WHERE sd.settings_id = s.id AND sd.active = true
      )
    LIMIT 1
),
active_settings AS (
    -- Use default settings, fall back to any active settings
    SELECT 
        COALESCE(
            (SELECT settings_id FROM default_settings),
            (SELECT id FROM settings WHERE active = true LIMIT 1)
        ) as settings_id
),
context_data AS (
    -- Get agent model info for image generation
    SELECT 
        a.id::text as agent_id,
        m.id::text as model_id,
        m.value as model_name,
        COALESCE(p_prov.value::text, '') as provider,
        COALESCE(me.base_url, '') as base_url,
        k.key as api_key,
        fp.final_profile_id
    FROM params p
    INNER JOIN agents a ON a.id = p.agent_id AND a.active = true
    INNER JOIN models m ON m.id = a.model_id
    LEFT JOIN providers p_prov ON p_prov.id = m.provider_id
    LEFT JOIN model_endpoints me ON me.model_id = m.id AND me.active = true
    CROSS JOIN active_settings act_s
    LEFT JOIN setting_provider_keys spk ON spk.provider_id = p_prov.id 
        AND spk.settings_id = act_s.settings_id 
        AND spk.active = true
    LEFT JOIN keys k ON k.id = spk.key_id AND k.active = true
    CROSS JOIN final_profile fp
),
create_run AS (
    -- Create run record (atomic with upload creation)
    INSERT INTO runs (input_tokens, output_tokens, key_id, agent_id)
    SELECT 0, 0, NULL, cd.agent_id::uuid
    FROM context_data cd
    RETURNING id
),
link_model AS (
    -- Link model to run
    INSERT INTO run_models (run_id, model_id, active)
    SELECT cr.id, cd.model_id::uuid, true
    FROM create_run cr
    CROSS JOIN context_data cd
    RETURNING run_id
),
link_profile AS (
    -- Link profile to run if provided (conditional)
    INSERT INTO run_profiles (run_id, profile_id, active)
    SELECT lm.run_id, cd.final_profile_id, true
    FROM link_model lm
    CROSS JOIN context_data cd
    WHERE cd.final_profile_id IS NOT NULL
    RETURNING run_id
)
SELECT 
    -- Context data
    cd.agent_id,
    cd.model_id,
    cd.model_name,
    cd.provider,
    cd.base_url,
    cd.api_key,
    -- Run data
    cr.id::text as run_id
FROM context_data cd
CROSS JOIN create_run cr

