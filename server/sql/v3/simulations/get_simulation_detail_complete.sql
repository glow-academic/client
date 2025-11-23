-- Get simulation detail with departments, scenarios, and access control
-- Parameters: $1 = simulation_id (uuid), $2 = profile_id (uuid or "guest-profile-id")

WITH resolve_profile_id AS (
    SELECT 
        CASE 
            WHEN $2::text = 'guest-profile-id' THEN
                (SELECT id::uuid FROM profiles WHERE role = 'guest' AND default_profile = true ORDER BY created_at DESC LIMIT 1)
            WHEN $2::text IS NULL OR $2::text = '' THEN NULL::uuid
            ELSE $2::uuid
        END as resolved_profile_id
),
user_context AS (
    SELECT role FROM resolve_profile_id rpi
    JOIN profiles p ON p.id = rpi.resolved_profile_id
),
        simulation_departments_data AS (
            SELECT 
                sd.simulation_id,
                ARRAY_AGG(sd.department_id::text ORDER BY sd.created_at) as department_ids
            FROM simulation_departments sd
            WHERE sd.simulation_id = $1 AND sd.active = true
            GROUP BY sd.simulation_id
        ),
        simulation_department_access_check AS (
            SELECT 
                s.id as simulation_id,
                CASE 
                    WHEN uc.role = 'superadmin' THEN true
                    WHEN EXISTS (
                        SELECT 1 FROM simulation_departments sd 
                        WHERE sd.simulation_id = s.id 
                        AND sd.active = true 
                        AND sd.department_id IN (SELECT department_id FROM resolve_profile_id rpi JOIN profile_departments pd ON pd.profile_id = rpi.resolved_profile_id WHERE pd.active = true)
                    ) THEN true
                    WHEN NOT EXISTS (
                        SELECT 1 FROM simulation_departments sd2 
                        WHERE sd2.simulation_id = s.id 
                        AND sd2.active = true
                    ) THEN true  -- Cross-department resource
                    ELSE false
                END as has_access
            FROM simulations s
            CROSS JOIN user_context uc
            WHERE s.id = $1
        ),
        simulation_base AS (
            SELECT 
                s.id,
                s.title,
                s.description,
                s.active,
                s.practice_simulation,
                s.rubric_id,
                stl.time_limit_seconds as time_limit,
                COALESCE(sdd.department_ids, NULL) as department_ids
            FROM simulations s
            LEFT JOIN simulation_time_limits stl ON stl.simulation_id = s.id AND stl.active = true
            LEFT JOIN simulation_departments_data sdd ON sdd.simulation_id = s.id
            INNER JOIN simulation_department_access_check sdac ON sdac.simulation_id = s.id AND sdac.has_access = true
            WHERE s.id = $1
        ),
        cohort_usage AS (
            SELECT 
                COUNT(*) FILTER (WHERE cs.active = true) as active_cohort_count,
                COUNT(*) as total_cohort_links
            FROM cohort_simulations cs
            WHERE cs.simulation_id = $1
        ),
        user_departments AS (
            SELECT DISTINCT d.id, d.title as name, d.description
            FROM departments d
            JOIN resolve_profile_id rpi ON true
            JOIN profile_departments pd ON pd.department_id = d.id
            WHERE pd.profile_id = rpi.resolved_profile_id AND d.active = true
        ),
        user_department_ids AS (
            SELECT ARRAY_AGG(id) as ids
            FROM user_departments
        ),
        simulation_scenarios_base AS (
            SELECT 
                s.id as scenario_id,
                s.name,
                sps.problem_statement,
                ss.active,
                (ss.position = 1) as default_scenario,
                ss.position,
                COALESCE(
                    (SELECT ARRAY_AGG(DISTINCT spi.parameter_item_id)
                     FROM scenario_parameter_items spi
                     WHERE spi.scenario_id = s.id AND spi.active = true),
                    ARRAY[]::uuid[]
                ) as parameter_item_ids
            FROM scenarios s
            JOIN simulation_scenarios ss ON ss.scenario_id = s.id
            LEFT JOIN scenario_problem_statements sps ON sps.scenario_id = s.id AND sps.active = true
            WHERE ss.simulation_id = $1
            ORDER BY ss.position
        ),
        scenario_statistics AS (
            SELECT 
                ss.scenario_id,
                -- Find root scenario: if parent_id = child_id exists, that's the root, otherwise use scenario itself
                COALESCE(
                    (SELECT st.parent_id 
                     FROM scenario_tree st 
                     WHERE st.child_id = ss.scenario_id 
                       AND st.parent_id = st.child_id 
                     LIMIT 1),
                    ss.scenario_id
                ) as root_scenario_id,
                -- Usage: count of ALL chats with this root scenario (regardless of completion)
                COUNT(DISTINCT sc.id) as usage_count,
                -- Success rate: percentage of completed chats that passed
                CASE 
                    WHEN COUNT(DISTINCT CASE WHEN sc.completed = true THEN sc.id END) > 0 
                    THEN ROUND(
                        (COUNT(DISTINCT CASE WHEN sc.completed = true AND scg.passed = true THEN sc.id END)::numeric / 
                         COUNT(DISTINCT CASE WHEN sc.completed = true THEN sc.id END)::numeric) * 100
                    )
                    ELSE 0 
                END as success_rate,
                -- Last used: most recent chat created_at
                MAX(sc.created_at) as last_used_date
            FROM simulation_scenarios ss
            LEFT JOIN simulation_chats sc ON (
                -- Match chats where scenario_id is in the tree with ss.scenario_id as root
                sc.scenario_id IN (
                    SELECT st2.child_id 
                    FROM scenario_tree st2 
                    WHERE st2.parent_id = COALESCE(
                        (SELECT st3.parent_id 
                         FROM scenario_tree st3 
                         WHERE st3.child_id = ss.scenario_id 
                           AND st3.parent_id = st3.child_id),
                        ss.scenario_id
                    )
                )
                OR sc.scenario_id = ss.scenario_id
            )
            LEFT JOIN simulation_chat_grades scg ON scg.simulation_chat_id = sc.id
            WHERE ss.simulation_id = $1
            GROUP BY ss.scenario_id
        ),
        scenarios_list_data AS (
            SELECT COALESCE(
                jsonb_agg(
                    jsonb_build_object(
                        'scenario_id', sb.scenario_id::text,
                        'title', sb.name,
                        'description', COALESCE(sb.problem_statement, ''),
                        'active', sb.active,
                        'default_scenario', COALESCE(sb.default_scenario, false),
                        'position', sb.position,
                        'parameter_item_ids', (
                            SELECT COALESCE(jsonb_agg(pid::text), '[]'::jsonb)
                            FROM unnest(sb.parameter_item_ids) as pid
                        ),
                        'usage_count', COALESCE(stats.usage_count, 0),
                        'success_rate', COALESCE(stats.success_rate, 0),
                        'last_used', stats.last_used_date,
                        'can_remove', COALESCE(stats.usage_count, 0) = 0
                    ) ORDER BY sb.position
                ),
                '[]'::jsonb
            ) as scenarios_list,
            COALESCE(ARRAY_AGG(sb.scenario_id::text), ARRAY[]::text[]) as scenario_ids
            FROM simulation_scenarios_base sb
            LEFT JOIN scenario_statistics stats ON stats.scenario_id = sb.scenario_id
        ),
        valid_scenarios_list AS (
            -- Get scenarios that are marked as roots in scenario_tree (parent_id = child_id)
            -- and are active and in user's departments OR cross-department (no department links)
            SELECT DISTINCT
                s.id,
                s.name,
                sps.problem_statement
            FROM scenarios s
            LEFT JOIN scenario_problem_statements sps ON sps.scenario_id = s.id AND sps.active = true
            CROSS JOIN user_department_ids udi
            JOIN scenario_tree st ON st.parent_id = s.id AND st.child_id = s.id
            LEFT JOIN scenario_departments sd ON sd.scenario_id = s.id AND sd.active = true
            WHERE s.active = true
              AND (
                  sd.department_id = ANY(udi.ids)
                  OR NOT EXISTS (SELECT 1 FROM scenario_departments sd2 WHERE sd2.scenario_id = s.id AND sd2.active = true)
              )
            UNION
            -- Also include root scenarios for currently selected scenarios (for edit mode - ensures selected items are available)
            SELECT DISTINCT
                COALESCE(
                    (SELECT st2.parent_id 
                     FROM scenario_tree st2 
                     WHERE st2.child_id = ssb.scenario_id 
                       AND st2.parent_id = st2.child_id 
                     LIMIT 1),
                    ssb.scenario_id
                ) as id,
                s2.name,
                sps2.problem_statement
            FROM simulation_scenarios_base ssb
            JOIN scenarios s2 ON s2.id = COALESCE(
                (SELECT st3.parent_id 
                 FROM scenario_tree st3 
                 WHERE st3.child_id = ssb.scenario_id 
                   AND st3.parent_id = st3.child_id 
                 LIMIT 1),
                ssb.scenario_id
            )
            LEFT JOIN scenario_problem_statements sps2 ON sps2.scenario_id = s2.id AND sps2.active = true
            WHERE s2.active = true
        ),
        valid_scenarios AS (
            SELECT ARRAY_AGG(id::text) as ids
            FROM valid_scenarios_list
        ),
        valid_rubrics_data AS (
            SELECT DISTINCT
                r.id,
                r.name,
                COALESCE(r.description, '') as description
            FROM rubrics r
            LEFT JOIN rubric_departments rd ON rd.rubric_id = r.id AND rd.active = true
            CROSS JOIN user_department_ids udi
            WHERE r.active = true
              AND (
                  rd.department_id = ANY(udi.ids)
                  OR NOT EXISTS (SELECT 1 FROM rubric_departments rd2 WHERE rd2.rubric_id = r.id AND rd2.active = true)
              )
            UNION
            -- Also include currently selected rubric (for edit mode - ensures selected item is available)
            SELECT DISTINCT
                r2.id,
                r2.name,
                COALESCE(r2.description, '') as description
            FROM simulation_base sb
            JOIN rubrics r2 ON r2.id = sb.rubric_id
            WHERE sb.rubric_id IS NOT NULL AND r2.active = true
        ),
        rubric_mapping_data AS (
            SELECT COALESCE(
                jsonb_object_agg(
                    vr.id::text,
                    jsonb_build_object(
                        'name', vr.name,
                        'description', vr.description
                    )
                ),
                '{}'::jsonb
            ) as rubric_mapping,
            COALESCE(ARRAY_AGG(vr.id::text), ARRAY[]::text[]) as rubric_ids
            FROM valid_rubrics_data vr
        ),
        parameters_data AS (
            SELECT DISTINCT
                p.id,
                p.name,
                COALESCE(p.description, '') as description,
                p.numerical,
                p.document_parameter
            FROM parameters p
            JOIN parameter_items pi ON pi.parameter_id = p.id
            LEFT JOIN parameter_item_departments pid ON pid.parameter_item_id = pi.id AND pid.active = true
            CROSS JOIN user_department_ids udi
            WHERE p.active = true
            GROUP BY p.id, p.name, p.description, p.numerical, p.document_parameter
            HAVING 
                -- Include if has matching department link via parameter_items OR has no department links at all (cross-dept)
                COUNT(pid.parameter_item_id) FILTER (WHERE pid.department_id = ANY(udi.ids)) > 0
                OR NOT EXISTS (SELECT 1 FROM parameter_item_departments pid2 
                              JOIN parameter_items pi2 ON pi2.id = pid2.parameter_item_id 
                              WHERE pi2.parameter_id = p.id AND pid2.active = true)
        ),
        parameter_mapping_data AS (
            SELECT COALESCE(
                jsonb_object_agg(
                    pd.id::text,
                    jsonb_build_object(
                        'name', pd.name,
                        'description', pd.description,
                        'numerical', pd.numerical,
                        'document_parameter', pd.document_parameter
                    )
                ),
                '{}'::jsonb
            ) as parameter_mapping
            FROM parameters_data pd
        ),
        parameter_items_data AS (
            SELECT 
                pi.id,
                pi.parameter_id,
                pi.name,
                COALESCE(pi.description, '') as description,
                p.name as parameter_name,
                pi.value
            FROM parameter_items pi
            JOIN parameters p ON p.id = pi.parameter_id
            WHERE p.id IN (SELECT id FROM parameters_data)
        ),
        parameter_items_list_data AS (
            SELECT COALESCE(
                jsonb_agg(
                    jsonb_build_object(
                        'id', pid.id::text,
                        'parameter_id', pid.parameter_id::text,
                        'name', pid.name,
                        'description', pid.description
                    )
                ),
                '[]'::jsonb
            ) as parameter_items_list
            FROM parameter_items_data pid
        ),
        parameter_item_mapping_data AS (
            SELECT COALESCE(
                jsonb_object_agg(
                    pid.id::text,
                    jsonb_build_object(
                        'name', pid.name,
                        'description', pid.description,
                        'parameter_id', pid.parameter_id::text,
                        'parameter_name', pid.parameter_name,
                        'value', pid.value
                    )
                ),
                '{}'::jsonb
            ) as parameter_item_mapping
            FROM parameter_items_data pid
        ),
        scenario_persona_data AS (
            SELECT 
                sp.scenario_id,
                sp.persona_id,
                p.name as persona_name,
                COALESCE(p.description, '') as persona_description,
                p.color as persona_color,
                p.icon as persona_icon
            FROM scenario_personas sp
            JOIN personas p ON p.id = sp.persona_id
            WHERE sp.scenario_id IN (SELECT id FROM valid_scenarios_list)
              AND sp.active = true
        ),
        scenario_documents_data AS (
            SELECT 
                sd.scenario_id,
                ARRAY_AGG(sd.document_id) as document_ids
            FROM scenario_documents sd
            WHERE sd.scenario_id IN (SELECT id FROM valid_scenarios_list)
              AND sd.active = true
            GROUP BY sd.scenario_id
        ),
        scenario_parameter_items_data AS (
            SELECT 
                spi.scenario_id,
                ARRAY_AGG(DISTINCT spi.parameter_item_id) as parameter_item_ids
            FROM scenario_parameter_items spi
            WHERE spi.scenario_id IN (SELECT id FROM valid_scenarios_list)
              AND spi.active = true
            GROUP BY spi.scenario_id
        ),
        all_document_ids AS (
            SELECT DISTINCT unnest(document_ids) as document_id
            FROM scenario_documents_data
        ),
        document_mapping_base AS (
            SELECT 
                d.id,
                d.name,
                d.type::text as description
            FROM documents d
            WHERE d.id IN (SELECT document_id FROM all_document_ids)
        ),
        scenario_mapping_complete AS (
            SELECT COALESCE(
                jsonb_object_agg(
                    vsl.id::text,
                    jsonb_build_object(
                        'name', vsl.name,
                        'description', COALESCE(vsl.problem_statement, ''),
                        'persona_id', spd.persona_id::text,
                        'persona_mapping', CASE 
                            WHEN spd.persona_id IS NOT NULL THEN
                                jsonb_build_object(
                                    spd.persona_id::text,
                                    jsonb_build_object(
                                        'name', spd.persona_name,
                                        'description', spd.persona_description,
                                        'color', spd.persona_color,
                                        'icon', spd.persona_icon
                                    )
                                )
                            ELSE '{}'::jsonb
                        END,
                        'document_mapping', COALESCE(
                            (SELECT jsonb_object_agg(
                                dmb.id::text,
                                jsonb_build_object(
                                    'name', dmb.name,
                                    'description', dmb.description
                                )
                            )
                            FROM document_mapping_base dmb
                            WHERE dmb.id = ANY(sdd.document_ids)),
                            '{}'::jsonb
                        ),
                        'parameter_item_mapping', COALESCE(
                            (SELECT jsonb_object_agg(
                                pid.id::text,
                                jsonb_build_object(
                                    'name', pid.name,
                                    'description', pid.description,
                                    'parameter_id', pid.parameter_id::text,
                                    'parameter_name', pid.parameter_name
                                )
                            )
                            FROM parameter_items_data pid
                            WHERE pid.id = ANY(spid.parameter_item_ids)),
                            '{}'::jsonb
                        ),
                        'parameter_item_ids', COALESCE(
                            (SELECT jsonb_agg(pid::text)
                             FROM unnest(spid.parameter_item_ids) as pid),
                            '[]'::jsonb
                        ),
                        'document_ids', COALESCE(
                            (SELECT jsonb_agg(did::text)
                             FROM unnest(sdd.document_ids) as did),
                            '[]'::jsonb
                        )
                    )
                ),
                '{}'::jsonb
            ) as scenario_mapping
            FROM valid_scenarios_list vsl
            LEFT JOIN scenario_persona_data spd ON spd.scenario_id = vsl.id
            LEFT JOIN scenario_documents_data sdd ON sdd.scenario_id = vsl.id
            LEFT JOIN scenario_parameter_items_data spid ON spid.scenario_id = vsl.id
        ),
        department_scenario_ids AS (
            SELECT 
                ud.id as department_id,
                COALESCE(ARRAY_AGG(DISTINCT s.id::text ORDER BY s.id::text) FILTER (WHERE s.id IS NOT NULL), ARRAY[]::text[]) as scenario_ids
            FROM user_departments ud
            LEFT JOIN scenarios s ON s.active = true
            -- Only include root scenarios (parent_id = child_id in scenario_tree)
            -- Use INNER JOIN to ensure only root scenarios are included
            INNER JOIN scenario_tree st ON st.parent_id = s.id AND st.child_id = s.id
            LEFT JOIN scenario_departments sd ON sd.scenario_id = s.id AND sd.active = true
            WHERE (sd.department_id = ud.id OR NOT EXISTS (SELECT 1 FROM scenario_departments sd2 WHERE sd2.scenario_id = s.id AND sd2.active = true))
            GROUP BY ud.id
        ),
        department_rubric_ids AS (
            SELECT 
                ud.id as department_id,
                COALESCE(ARRAY_AGG(DISTINCT r.id::text ORDER BY r.id::text) FILTER (WHERE r.id IS NOT NULL), ARRAY[]::text[]) as rubric_ids
            FROM user_departments ud
            LEFT JOIN rubrics r ON r.active = true
            LEFT JOIN rubric_departments rd ON rd.rubric_id = r.id AND rd.active = true
            WHERE (rd.department_id = ud.id OR NOT EXISTS (SELECT 1 FROM rubric_departments rd2 WHERE rd2.rubric_id = r.id AND rd2.active = true))
            GROUP BY ud.id
        ),
        department_cohort_ids AS (
            SELECT 
                ud.id as department_id,
                COALESCE(ARRAY_AGG(DISTINCT c.id::text ORDER BY c.id::text) FILTER (WHERE c.id IS NOT NULL), ARRAY[]::text[]) as cohort_ids
            FROM user_departments ud
            LEFT JOIN cohorts c ON c.active = true
            LEFT JOIN cohort_departments cd ON cd.cohort_id = c.id AND cd.active = true
            WHERE (cd.department_id = ud.id OR NOT EXISTS (SELECT 1 FROM cohort_departments cd2 WHERE cd2.cohort_id = c.id AND cd2.active = true))
            GROUP BY ud.id
        ),
        department_mapping_data AS (
            SELECT COALESCE(
                jsonb_object_agg(
                    ud.id::text,
                    jsonb_build_object(
                        'name', ud.name,
                        'description', COALESCE(ud.description, ''),
                        'scenario_ids', CASE WHEN dsci.scenario_ids IS NOT NULL AND array_length(dsci.scenario_ids, 1) > 0 THEN to_jsonb(dsci.scenario_ids) ELSE NULL END,
                        'rubric_ids', CASE WHEN dri.rubric_ids IS NOT NULL AND array_length(dri.rubric_ids, 1) > 0 THEN to_jsonb(dri.rubric_ids) ELSE NULL END,
                        'cohort_ids', CASE WHEN dci.cohort_ids IS NOT NULL AND array_length(dci.cohort_ids, 1) > 0 THEN to_jsonb(dci.cohort_ids) ELSE NULL END
                    )
                ),
                '{}'::jsonb
            ) as department_mapping,
            COALESCE(ARRAY_AGG(DISTINCT ud.id::text), ARRAY[]::text[]) as department_ids
            FROM user_departments ud
            LEFT JOIN department_scenario_ids dsci ON dsci.department_id = ud.id
            LEFT JOIN department_rubric_ids dri ON dri.department_id = ud.id
            LEFT JOIN department_cohort_ids dci ON dci.department_id = ud.id
        )
        SELECT 
            -- Basic simulation fields
            sb.title,
            sb.description,
            sb.department_ids,
            sb.time_limit,
            sb.rubric_id::text,
            sb.active,
            false as default_simulation,
            sb.practice_simulation,
            -- User context
            uc.role as user_role,
            COALESCE(cu.active_cohort_count, 0) as active_cohort_count,
            COALESCE(cu.total_cohort_links, 0) as total_cohort_links,
            -- Permissions
            CASE 
                WHEN COALESCE(sb.department_ids, NULL) IS NULL AND uc.role != 'superadmin' THEN false
                WHEN uc.role IN ('admin', 'instructional', 'superadmin') THEN true
                ELSE false
            END as can_edit,
            -- Scenarios
            sld.scenarios_list,
            sld.scenario_ids,
            -- Valid IDs
            COALESCE(vs.ids, ARRAY[]::text[]) as valid_scenario_ids,
            COALESCE(rmd.rubric_ids, ARRAY[]::text[]) as valid_rubric_ids,
            dmd.department_ids as valid_department_ids,
            -- Mappings
            smc.scenario_mapping,
            rmd.rubric_mapping,
            dmd.department_mapping,
            pmd.parameter_mapping,
            pimd.parameter_item_mapping,
            -- Parameter items list
            pild.parameter_items_list
        FROM simulation_base sb
        CROSS JOIN user_context uc
        LEFT JOIN cohort_usage cu ON true
        LEFT JOIN scenarios_list_data sld ON true
        LEFT JOIN valid_scenarios vs ON true
        LEFT JOIN rubric_mapping_data rmd ON true
        LEFT JOIN parameter_mapping_data pmd ON true
        LEFT JOIN parameter_item_mapping_data pimd ON true
        LEFT JOIN parameter_items_list_data pild ON true
        LEFT JOIN scenario_mapping_complete smc ON true
        LEFT JOIN department_mapping_data dmd ON true
