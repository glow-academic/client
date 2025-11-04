WITH user_departments AS (
            SELECT DISTINCT pd.department_id
            FROM profile_departments pd
            WHERE pd.profile_id = $1
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
            JOIN default_persona dp ON p.id = dp.id
            LEFT JOIN persona_departments_data pdd ON pdd.persona_id = p.id
            LEFT JOIN persona_active_prompt pap ON pap.persona_id = p.id
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
            WHERE pd.profile_id = $1 AND d.active = true
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
            JOIN default_persona dp ON sp.persona_id = dp.id
            WHERE sp.active = true
        ),
        profile_data AS (
            SELECT role as user_role 
            FROM profiles 
            WHERE id = $1
        )
        SELECT 
            p.*,
            vd.dept_mapping,
            vd.dept_ids as valid_department_ids,
            vm.model_mapping,
            vm.model_ids as valid_model_ids,
            u.usage_count,
            pr.user_role
        FROM persona_data p
        CROSS JOIN valid_depts vd
        CROSS JOIN valid_models vm
        CROSS JOIN usage_data u
        CROSS JOIN profile_data pr
