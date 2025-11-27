-- Get default persona detail for creation
-- Parameters: $1 = profile_id (uuid or "guest-profile-id")

WITH resolve_profile_id AS (
    SELECT 
        CASE 
            WHEN $1::text = 'guest-profile-id' THEN
                (SELECT id::uuid FROM profiles WHERE role = 'guest' AND default_profile = true ORDER BY created_at DESC LIMIT 1)
            WHEN $1::text IS NULL OR $1::text = '' THEN NULL::uuid
            ELSE $1::uuid
        END as resolved_profile_id
),
user_departments AS (
    SELECT DISTINCT pd.department_id
    FROM resolve_profile_id rpi
    JOIN profile_departments pd ON pd.profile_id = rpi.resolved_profile_id
),
        default_persona AS (
            SELECT p.id
            FROM personas p
            LEFT JOIN persona_departments pd ON pd.persona_id = p.id AND pd.active = true
            WHERE p.active = true
            GROUP BY p.id
            HAVING 
                -- Include if has matching department link OR has no department links at all (cross-dept)
                COUNT(pd.persona_id) FILTER (WHERE pd.department_id IN (SELECT department_id FROM user_departments)) > 0
                OR NOT EXISTS (SELECT 1 FROM persona_departments pd2 WHERE pd2.persona_id = p.id AND pd2.active = true)
            ORDER BY p.created_at DESC
            LIMIT 1
        ),
        persona_departments_data AS (
            SELECT 
                pd.persona_id,
                ARRAY_AGG(pd.department_id::text ORDER BY pd.created_at) as department_ids
            FROM persona_departments pd
            JOIN default_persona dp ON pd.persona_id = dp.id
            WHERE pd.active = true
            GROUP BY pd.persona_id
        ),
        persona_active_prompt AS (
            SELECT 
                pp.persona_id,
                pp.prompt_id::text as prompt_id,
                pr.system_prompt,
                pr.created_at as prompt_created_at,
                pr.updated_at as prompt_updated_at
            FROM persona_prompts pp
            JOIN prompts pr ON pr.id = pp.prompt_id
            JOIN default_persona dp ON pp.persona_id = dp.id
            WHERE pp.active = true
            LIMIT 1
        ),
        persona_text_model_data AS (
            SELECT 
                ptm.persona_id,
                ptm.model_id::text as text_model_id
            FROM persona_text_model ptm
            JOIN default_persona dp ON ptm.persona_id = dp.id
            WHERE ptm.active = true
            LIMIT 1
        ),
        persona_audio_model_data AS (
            SELECT 
                pam.persona_id,
                pam.model_id::text as audio_model_id,
                pam.voice::text as voice
            FROM persona_audio_model pam
            JOIN default_persona dp ON pam.persona_id = dp.id
            WHERE pam.active = true
            LIMIT 1
        ),
        persona_data AS (
            SELECT 
                p.name,
                p.description,
                p.active,
                p.color,
                p.icon,
                COALESCE(ptmd.text_model_id, NULL)::text as text_model_id,
                COALESCE(pamd.audio_model_id, NULL)::text as audio_model_id,
                COALESCE(pamd.voice, NULL)::text as voice,
                p.reasoning,
                p.temperature,
                COALESCE(pap.system_prompt, '') as system_prompt,
                COALESCE(pap.prompt_id, NULL)::text as prompt_id,
                COALESCE(pdd.department_ids, NULL) as department_ids
            FROM personas p
            JOIN default_persona dp ON p.id = dp.id
            LEFT JOIN persona_departments_data pdd ON pdd.persona_id = p.id
            LEFT JOIN persona_active_prompt pap ON pap.persona_id = p.id
            LEFT JOIN persona_text_model_data ptmd ON ptmd.persona_id = p.id
            LEFT JOIN persona_audio_model_data pamd ON pamd.persona_id = p.id
        ),
        valid_depts AS (
            SELECT 
                COALESCE(
                    jsonb_object_agg(
                        d.id::text,
                        jsonb_build_object(
                            'name', d.title,
                            'description', COALESCE(d.description, '')
                        )
                    ),
                    '{}'::jsonb
                ) as dept_mapping,
                array_agg(d.id::text ORDER BY d.title) as dept_ids
            FROM departments d
            JOIN resolve_profile_id rpi ON true
            JOIN profile_departments pd ON d.id = pd.department_id
            WHERE pd.profile_id = rpi.resolved_profile_id AND d.active = true
        ),
        valid_text_models AS (
            -- Filter text models by department: include if has matching department link OR has no department links at all (cross-dept)
            SELECT 
                COALESCE(
                    jsonb_object_agg(
                        m.id::text,
                        jsonb_build_object(
                            'name', m.name,
                            'description', COALESCE(m.description, '')
                        )
                    ),
                    '{}'::jsonb
                ) as text_model_mapping,
                array_agg(m.id::text ORDER BY m.name) as text_model_ids
            FROM models m
            LEFT JOIN model_departments md ON md.model_id = m.id AND md.active = true
            WHERE m.active = true AND m.model_type = 'text'
            GROUP BY m.id
            HAVING 
                COUNT(md.model_id) FILTER (WHERE md.department_id IN (SELECT department_id FROM user_departments)) > 0
                OR NOT EXISTS (SELECT 1 FROM model_departments md2 WHERE md2.model_id = m.id AND md2.active = true)
        ),
        valid_audio_models AS (
            -- Filter audio models by department: include if has matching department link OR has no department links at all (cross-dept)
            SELECT 
                COALESCE(
                    jsonb_object_agg(
                        m.id::text,
                        jsonb_build_object(
                            'name', m.name,
                            'description', COALESCE(m.description, '')
                        )
                    ),
                    '{}'::jsonb
                ) as audio_model_mapping,
                array_agg(m.id::text ORDER BY m.name) as audio_model_ids
            FROM models m
            LEFT JOIN model_departments md ON md.model_id = m.id AND md.active = true
            WHERE m.active = true AND m.model_type = 'audio'
            GROUP BY m.id
            HAVING 
                COUNT(md.model_id) FILTER (WHERE md.department_id IN (SELECT department_id FROM user_departments)) > 0
                OR NOT EXISTS (SELECT 1 FROM model_departments md2 WHERE md2.model_id = m.id AND md2.active = true)
        ),
        usage_data AS (
            SELECT COUNT(*) as usage_count
            FROM scenario_personas sp
            JOIN default_persona dp ON sp.persona_id = dp.id
            WHERE sp.active = true
        ),
        profile_data AS (
            SELECT role as user_role 
            FROM resolve_profile_id rpi
            JOIN profiles p ON p.id = rpi.resolved_profile_id
        ),
        primary_department_id AS (
            SELECT department_id::text
            FROM resolve_profile_id rpi
            JOIN profile_departments pd ON pd.profile_id = rpi.resolved_profile_id
            WHERE pd.is_primary = TRUE
            LIMIT 1
        )
        SELECT 
            p.*,
            vd.dept_mapping,
            vd.dept_ids as valid_department_ids,
            COALESCE(vtm.text_model_mapping, '{}'::jsonb) as text_model_mapping,
            COALESCE(vtm.text_model_ids, ARRAY[]::text[]) as valid_text_model_ids,
            COALESCE(vam.audio_model_mapping, '{}'::jsonb) as audio_model_mapping,
            COALESCE(vam.audio_model_ids, ARRAY[]::text[]) as valid_audio_model_ids,
            u.usage_count,
            pr.user_role,
            pdi.department_id as primary_department_id
        FROM persona_data p
        CROSS JOIN valid_depts vd
        CROSS JOIN valid_text_models vtm
        CROSS JOIN valid_audio_models vam
        CROSS JOIN usage_data u
        CROSS JOIN profile_data pr
        LEFT JOIN primary_department_id pdi ON true
