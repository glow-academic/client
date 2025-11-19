WITH         user_profile AS (
            SELECT role FROM profiles WHERE id = $2
        ),
        persona_departments_data AS (
            SELECT 
                pd.persona_id,
                ARRAY_AGG(pd.department_id::text ORDER BY pd.created_at) as department_ids
            FROM persona_departments pd
            WHERE pd.persona_id = $1 AND pd.active = true
            GROUP BY pd.persona_id
        ),
        persona_department_access_check AS (
            SELECT 
                p.id as persona_id,
                CASE 
                    WHEN up.role = 'superadmin' THEN true
                    WHEN EXISTS (
                        SELECT 1 FROM persona_departments pd 
                        WHERE pd.persona_id = p.id 
                        AND pd.active = true 
                        AND pd.department_id IN (SELECT department_id FROM profile_departments pd2 WHERE pd2.profile_id = $2 AND pd2.active = true)
                    ) THEN true
                    WHEN NOT EXISTS (
                        SELECT 1 FROM persona_departments pd3 
                        WHERE pd3.persona_id = p.id 
                        AND pd3.active = true
                    ) THEN true  -- Cross-department resource
                    ELSE false
                END as has_access
            FROM personas p
            CROSS JOIN user_profile up
            WHERE p.id = $1
        ),
        persona_department_prompt_links AS (
            SELECT 
                COALESCE(
                    (SELECT jsonb_object_agg(
                        pdp.department_id::text,
                        pdp.prompt_id::text
                    )
                    FROM persona_department_prompts pdp
                    WHERE pdp.persona_id = $1 AND pdp.active = true),
                    '{}'::jsonb
                ) as department_prompt_links
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
            WHERE pp.persona_id = $1 AND pp.active = true
            LIMIT 1
        ),
        persona_all_prompts AS (
            -- Get all prompts from persona_prompts (default prompts)
            SELECT 
                pp.persona_id,
                pp.prompt_id::text as prompt_id,
                pr.system_prompt,
                pr.created_at as prompt_created_at,
                pr.updated_at as prompt_updated_at
            FROM persona_prompts pp
            JOIN prompts pr ON pr.id = pp.prompt_id
            WHERE pp.persona_id = $1
            UNION
            -- Also get all prompts from persona_department_prompts (department-specific prompts)
            SELECT DISTINCT
                pdp.persona_id,
                pdp.prompt_id::text as prompt_id,
                pr.system_prompt,
                pr.created_at as prompt_created_at,
                pr.updated_at as prompt_updated_at
            FROM persona_department_prompts pdp
            JOIN prompts pr ON pr.id = pdp.prompt_id
            WHERE pdp.persona_id = $1 AND pdp.active = true
        ),
        prompt_departments_data AS (
            SELECT 
                pdp.prompt_id::text as prompt_id,
                ARRAY_AGG(pdp.department_id::text ORDER BY pdp.created_at) as department_ids
            FROM persona_department_prompts pdp
            WHERE pdp.persona_id = $1 AND pdp.active = true
            GROUP BY pdp.prompt_id
        ),
        default_prompt_count AS (
            -- Count default prompts (from persona_prompts, not department-specific)
            -- Always return at least one row with count (0 if no prompts)
            SELECT COALESCE(COUNT(DISTINCT pp.prompt_id), 0)::integer as count
            FROM persona_prompts pp
            WHERE pp.persona_id = $1
        ),
        prompt_mapping_data AS (
            SELECT 
                COALESCE(
                    jsonb_object_agg(
                        pp.prompt_id,
                        jsonb_build_object(
                            'system_prompt', pp.system_prompt,
                            'created_at', pp.prompt_created_at::text,
                            'updated_at', pp.prompt_updated_at::text,
                            'department_ids', COALESCE(pdd.department_ids, NULL),
                            'can_delete', CASE
                                -- Department-specific prompts can always be deleted (fall back to default)
                                WHEN pdd.department_ids IS NOT NULL THEN true::boolean
                                -- Default prompts can be deleted if there's more than one
                                WHEN pdd.department_ids IS NULL AND COALESCE(dpc.count, 0) > 1 THEN true::boolean
                                -- Otherwise cannot delete (only one default prompt)
                                ELSE false::boolean
                            END
                        )
                    ),
                    '{}'::jsonb
                ) as prompt_mapping
            FROM persona_all_prompts pp
            LEFT JOIN prompt_departments_data pdd ON pdd.prompt_id = pp.prompt_id
            CROSS JOIN default_prompt_count dpc
        ),
        persona_data AS (
            SELECT 
                p.name,
                p.description,
                p.active,
                p.color,
                p.icon,
                p.model_id,
                p.reasoning,
                p.temperature,
                COALESCE(pap.system_prompt, '') as system_prompt,
                COALESCE(pap.prompt_id, NULL)::text as prompt_id,
                COALESCE(pdd.department_ids, NULL) as department_ids
            FROM personas p
            LEFT JOIN persona_departments_data pdd ON pdd.persona_id = p.id
            LEFT JOIN persona_active_prompt pap ON pap.persona_id = p.id
            INNER JOIN persona_department_access_check pdac ON pdac.persona_id = p.id AND pdac.has_access = true
            WHERE p.id = $1
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
            JOIN profile_departments pd ON d.id = pd.department_id
            WHERE pd.profile_id = $2 AND d.active = true
        ),
        valid_models AS (
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
                ) as model_mapping,
                array_agg(m.id::text ORDER BY m.name) as model_ids
            FROM models m 
            WHERE m.active = true
        ),
        usage_data AS (
            SELECT COUNT(*) as usage_count
            FROM scenario_personas sp
            WHERE sp.persona_id = $1 AND sp.active = true
        ),
        profile_data AS (
            SELECT role as user_role 
            FROM profiles 
            WHERE id = $2
        )
        SELECT 
            p.*,
            vd.dept_mapping,
            vd.dept_ids as valid_department_ids,
            vm.model_mapping,
            vm.model_ids as valid_model_ids,
            u.usage_count,
            pr.user_role,
            COALESCE(pmd.prompt_mapping, '{}'::jsonb) as prompt_mapping,
            COALESCE(pdpl.department_prompt_links, '{}'::jsonb) as department_prompt_links
        FROM persona_data p
        CROSS JOIN valid_depts vd
        CROSS JOIN valid_models vm
        CROSS JOIN usage_data u
        CROSS JOIN profile_data pr
        CROSS JOIN prompt_mapping_data pmd
        CROSS JOIN persona_department_prompt_links pdpl
