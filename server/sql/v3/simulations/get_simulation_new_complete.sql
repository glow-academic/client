WITH user_departments AS (
            SELECT DISTINCT pd.department_id
            FROM profile_departments pd
            WHERE pd.profile_id = $1
        ),
        -- For "new" simulation, we don't select any default simulation
        -- Return empty/default values instead
        simulation_base AS (
            SELECT 
                NULL::uuid as id,
                ''::text as title,
                ''::text as description,
                true as active,
                false as practice_simulation,
                NULL::uuid as rubric_id,
                0 as time_limit
        ),
        user_context AS (
            SELECT role FROM profiles WHERE id = $1
        ),
        primary_department_id AS (
            SELECT department_id::text
            FROM profile_departments
            WHERE profile_id = $1 AND is_primary = TRUE
            LIMIT 1
        ),
        cohort_usage AS (
            SELECT 
                0 as active_cohort_count,
                0 as total_cohort_links
        ),
        user_department_ids AS (
            SELECT ARRAY_AGG(id) as ids
            FROM departments d
            JOIN profile_departments pd ON d.id = pd.department_id
            WHERE pd.profile_id = $1 AND d.active = true
        ),
        -- For "new" simulation, return empty scenarios list
        simulation_scenarios_base AS (
            SELECT 
                NULL::uuid as scenario_id,
                NULL::text as name,
                NULL::text as problem_statement,
                NULL::boolean as active,
                NULL::boolean as default_scenario,
                NULL::integer as position,
                NULL::boolean as hints_enabled,
                NULL::boolean as objectives_enabled,
                NULL::boolean as image_input_enabled,
                NULL::uuid as rubric_id,
                NULL::integer as time_limit_seconds,
                ARRAY[]::uuid[] as parameter_item_ids
            WHERE false  -- This ensures no rows are returned
        ),
        scenario_statistics AS (
            SELECT 
                NULL::uuid as scenario_id,
                NULL::uuid as root_scenario_id,
                0 as usage_count,
                0 as success_rate,
                NULL::timestamptz as last_used_date
            WHERE false  -- This ensures no rows are returned
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
                        'hints_enabled', sb.hints_enabled,
                        'objectives_enabled', sb.objectives_enabled,
                        'image_input_enabled', sb.image_input_enabled,
                        'rubric_id', sb.rubric_id::text,
                        'time_limit_seconds', sb.time_limit_seconds,
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
            SELECT DISTINCT
                s.id,
                s.name,
                ps.problem_statement
            FROM scenarios s
            LEFT JOIN scenario_problem_statements sps ON sps.scenario_id = s.id AND sps.active = true
            LEFT JOIN problem_statements ps ON ps.id = sps.problem_statement_id
            LEFT JOIN scenario_departments sd ON sd.scenario_id = s.id AND sd.active = true
            CROSS JOIN user_department_ids udi
            JOIN scenario_tree st ON st.parent_id = s.id AND st.child_id = s.id
            WHERE s.active = true
              AND (
                  sd.department_id = ANY(udi.ids)
                  OR NOT EXISTS (SELECT 1 FROM scenario_departments sd2 WHERE sd2.scenario_id = s.id AND sd2.active = true)
              )
        ),
        valid_scenarios AS (
            SELECT ARRAY_AGG(id::text) as ids
            FROM valid_scenarios_list
        ),
        valid_videos_list AS (
            SELECT DISTINCT
                v.id,
                v.name
            FROM videos v
            LEFT JOIN video_departments vd ON vd.video_id = v.id AND vd.active = true
            CROSS JOIN user_department_ids udi
            JOIN video_tree vt ON vt.parent_id = v.id AND vt.child_id = v.id
            WHERE v.active = true
              AND (
                  vd.department_id = ANY(udi.ids)
                  OR NOT EXISTS (SELECT 1 FROM video_departments vd2 WHERE vd2.video_id = v.id AND vd2.active = true)
              )
        ),
        valid_videos AS (
            SELECT ARRAY_AGG(id::text) as ids
            FROM valid_videos_list
        ),
        video_mapping_data AS (
            SELECT COALESCE(
                jsonb_object_agg(
                    vvl.id::text,
                    jsonb_build_object(
                        'name', vvl.name,
                        'description', '',
                        'length_seconds', v.length_seconds
                    )
                ),
                '{}'::jsonb
            ) as video_mapping
            FROM valid_videos_list vvl
            JOIN videos v ON v.id = vvl.id
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
                p.document_parameter,
                p.persona_parameter
            FROM parameters p
            JOIN parameter_fields fp ON fp.parameter_id = p.id AND fp.active = true
            LEFT JOIN field_departments fd ON fd.field_id = fp.field_id AND fd.active = true
            CROSS JOIN user_department_ids udi
            WHERE p.active = true
            GROUP BY p.id, p.name, p.description,  p.document_parameter, p.persona_parameter
            HAVING 
                -- Include if has matching department link via parameter_items OR has no department links at all (cross-dept)
                COUNT(fd.field_id) FILTER (WHERE fd.department_id = ANY(udi.ids)) > 0
                OR NOT EXISTS (SELECT 1 FROM field_departments fd2 
                              JOIN parameter_fields fp2 ON fp2.field_id = fd2.field_id 
                              WHERE fp2.parameter_id = p.id AND fp2.active = true AND fd2.active = true)
        ),
        parameter_mapping_data AS (
            SELECT COALESCE(
                jsonb_object_agg(
                    pd.id::text,
                    jsonb_build_object(
                        'name', pd.name,
                        'description', pd.description,
                        'document_parameter', pd.document_parameter,
                        'persona_parameter', pd.persona_parameter
                    )
                ),
                '{}'::jsonb
            ) as parameter_mapping
            FROM parameters_data pd
        ),
        parameter_items_data AS (
            SELECT 
                f.id,
                fp.parameter_id,
                f.name,
                COALESCE(f.description, '') as description,
                p.name as parameter_name
            FROM fields f
            JOIN parameter_fields fp ON fp.field_id = f.id AND fp.active = true
            JOIN parameters p ON p.id = fp.parameter_id
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
        field_mapping_data AS (
            SELECT COALESCE(
                jsonb_object_agg(
                    pid.id::text,
                    jsonb_build_object(
                        'name', pid.name,
                        'description', pid.description,
                        'parameter_id', pid.parameter_id::text,
                        'parameter_name', pid.parameter_name
                    )
                ),
                '{}'::jsonb
            ) as field_mapping
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
                sf.scenario_id,
                ARRAY_AGG(DISTINCT sf.field_id) as parameter_item_ids
            FROM scenario_fields sf
            WHERE sf.scenario_id IN (SELECT id FROM valid_scenarios_list)
              AND sf.active = true
            GROUP BY sf.scenario_id
        ),
        all_document_ids AS (
            SELECT DISTINCT unnest(document_ids) as document_id
            FROM scenario_documents_data
        ),
        document_mapping_base AS (
            SELECT 
                d.id,
                d.name,
                ''::text as description
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
                        'field_mapping', COALESCE(
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
        user_departments_for_mapping AS (
            SELECT DISTINCT d.id, d.title as name, d.description
            FROM departments d
            JOIN profile_departments pd ON d.id = pd.department_id
            WHERE pd.profile_id = $1 AND d.active = true
        ),
        department_scenario_ids_default AS (
            SELECT 
                ud.id as department_id,
                COALESCE(ARRAY_AGG(DISTINCT s.id::text ORDER BY s.id::text) FILTER (WHERE s.id IS NOT NULL), ARRAY[]::text[]) as scenario_ids
            FROM user_departments_for_mapping ud
            LEFT JOIN scenarios s ON s.active = true
            -- Only include root scenarios (parent_id = child_id in scenario_tree)
            INNER JOIN scenario_tree st ON st.parent_id = s.id AND st.child_id = s.id
            LEFT JOIN scenario_departments sd ON sd.scenario_id = s.id AND sd.active = true
            WHERE (sd.department_id = ud.id OR NOT EXISTS (SELECT 1 FROM scenario_departments sd2 WHERE sd2.scenario_id = s.id AND sd2.active = true))
            GROUP BY ud.id
        ),
        department_rubric_ids_default AS (
            SELECT 
                ud.id as department_id,
                COALESCE(ARRAY_AGG(DISTINCT r.id::text ORDER BY r.id::text) FILTER (WHERE r.id IS NOT NULL), ARRAY[]::text[]) as rubric_ids
            FROM user_departments_for_mapping ud
            LEFT JOIN rubrics r ON r.active = true
            LEFT JOIN rubric_departments rd ON rd.rubric_id = r.id AND rd.active = true
            WHERE (rd.department_id = ud.id OR NOT EXISTS (SELECT 1 FROM rubric_departments rd2 WHERE rd2.rubric_id = r.id AND rd2.active = true))
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
                        'rubric_ids', CASE WHEN dri.rubric_ids IS NOT NULL AND array_length(dri.rubric_ids, 1) > 0 THEN to_jsonb(dri.rubric_ids) ELSE NULL END
                    )
                ),
                '{}'::jsonb
            ) as department_mapping,
            COALESCE(ARRAY_AGG(ud.id::text), ARRAY[]::text[]) as department_ids
            FROM user_departments_for_mapping ud
            LEFT JOIN department_scenario_ids_default dsci ON dsci.department_id = ud.id
            LEFT JOIN department_rubric_ids_default dri ON dri.department_id = ud.id
        )
        SELECT 
            sb.title,
            sb.description,
            COALESCE(dmd.department_ids, ARRAY[]::text[]) as department_ids,
            sb.time_limit,
            sb.rubric_id::text,
            sb.active,
            false as default_simulation,
            sb.practice_simulation,
            uc.role as user_role,
            COALESCE(cu.active_cohort_count, 0) as active_cohort_count,
            COALESCE(cu.total_cohort_links, 0) as total_cohort_links,
            -- Permissions
            CASE 
                WHEN COALESCE(dmd.department_ids, ARRAY[]::text[]) = ARRAY[]::text[] AND uc.role != 'superadmin' THEN false
                WHEN uc.role IN ('admin', 'instructional', 'superadmin') THEN true
                ELSE false
            END as can_edit,
            sld.scenarios_list,
            sld.scenario_ids,
            COALESCE(vs.ids, ARRAY[]::text[]) as valid_scenario_ids,
            COALESCE(vv.ids, ARRAY[]::text[]) as valid_video_ids,
            COALESCE(rmd.rubric_ids, ARRAY[]::text[]) as valid_rubric_ids,
            dmd.department_ids as valid_department_ids,
            smc.scenario_mapping,
            vmd.video_mapping,
            rmd.rubric_mapping,
            dmd.department_mapping,
            pmd.parameter_mapping,
            fmd.field_mapping,
            pild.parameter_items_list,
            pdi.department_id as primary_department_id
        FROM simulation_base sb
        CROSS JOIN user_context uc
        LEFT JOIN primary_department_id pdi ON true
        LEFT JOIN cohort_usage cu ON true
        LEFT JOIN scenarios_list_data sld ON true
        LEFT JOIN valid_scenarios vs ON true
        LEFT JOIN valid_videos vv ON true
        LEFT JOIN rubric_mapping_data rmd ON true
        LEFT JOIN parameter_mapping_data pmd ON true
        LEFT JOIN field_mapping_data fmd ON true
        LEFT JOIN parameter_items_list_data pild ON true
        LEFT JOIN scenario_mapping_complete smc ON true
        LEFT JOIN video_mapping_data vmd ON true
        LEFT JOIN department_mapping_data dmd ON true
