-- Get complete run data with chats, messages, grades, and rubric
-- Parameters: $1=run_id (uuid)
-- Returns: run, chats (with messages, hints, grades, rubric), rubricStructure, timer, aggregatedResults

WITH run_base AS (
    SELECT 
        r.id,
        r.created_at,
        r.input_tokens,
        r.output_tokens,
        r.cached_input_tokens,
        r.key_id,
        r.agent_id
    FROM runs r
    WHERE r.id = $1
),
chats_base AS (
    SELECT 
        c.id,
        c.created_at,
        c.updated_at,
        c.title,
        c.scenario_id,
        c.completed,
        c.trace_id,
        -- Add document IDs for this chat's scenario
        COALESCE(
            (SELECT array_agg(DISTINCT sd.document_id::text)
             FROM scenario_documents sd
             WHERE sd.scenario_id = c.scenario_id AND sd.active = true),
            ARRAY[]::text[]
        ) as document_ids
    FROM chat_runs cr
    JOIN chats c ON c.id = cr.chat_id
    CROSS JOIN run_base rb
    WHERE cr.run_id = rb.id
    ORDER BY c.created_at
),
chat_ids_list AS (
    SELECT array_agg(id::uuid) as chat_ids
    FROM chats_base
),
scenarios_data AS (
    SELECT 
        s.id,
        jsonb_build_object(
            'id', s.id::text,
            'name', s.name,
            'problemStatement', s.problem_statement,
            'departmentId', s.department_id::text,
            'active', s.active,
            'personaId', s.persona_id::text,
            'personaName', per.name,
            'personaIcon', per.icon,
            'personaColor', per.color,
            'createdAt', s.created_at,
            'updatedAt', s.updated_at,
            'generated', s.generated,
            'defaultScenario', s.default_scenario,
            'copyPasteAllowed', s.copy_paste_allowed,
            'objectives', COALESCE(
                (SELECT array_agg(so.objective ORDER BY so.idx)
                 FROM scenario_objectives so
                 WHERE so.scenario_id = s.id),
                NULL
            )
        ) as scenario_data
    FROM scenarios s
    LEFT JOIN personas per ON per.id = s.persona_id
    CROSS JOIN chats_base cb
    WHERE s.id = cb.scenario_id
),
messages_grouped AS (
    SELECT 
        cr.chat_id,
        COALESCE(
            jsonb_agg(
                jsonb_build_object(
                    'id', m.id::text,
                    'createdAt', m.created_at,
                    'updatedAt', m.updated_at,
                    'chatId', cr.chat_id::text,
                    'content', m.content,
                    'type', CASE 
                        WHEN m.role = 'user' THEN 'query'
                        WHEN m.role = 'assistant' OR m.role = 'response' THEN 'response'
                        ELSE m.role
                    END,
                    'completed', m.completed
                ) ORDER BY m.created_at
            ),
            '[]'::jsonb
        ) as messages
    FROM messages m
    JOIN message_runs mr ON mr.message_id = m.id
    JOIN chat_runs cr ON cr.run_id = mr.run_id
    CROSS JOIN chat_ids_list cil
    CROSS JOIN run_base rb
    WHERE mr.run_id = rb.id
      AND cr.chat_id = ANY(cil.chat_ids)
    GROUP BY cr.chat_id
),
hints_data AS (
    SELECT 
        cr.chat_id,
        COALESCE(
            jsonb_agg(
                jsonb_build_object(
                    'messageId', m.id::text,
                    'hints', COALESCE(
                        (SELECT jsonb_agg(
                            jsonb_build_object(
                                'simulationMessageId', sh.simulation_message_id::text,
                                'hint', sh.hint,
                                'idx', sh.idx,
                                'createdAt', sh.created_at
                            ) ORDER BY sh.idx
                        )
                        FROM simulation_hints sh
                        WHERE sh.simulation_message_id = m.id),
                        '[]'::jsonb
                    )
                )
            ) FILTER (WHERE m.role = 'assistant' OR m.role = 'response'),
            '[]'::jsonb
        ) as hints
    FROM messages m
    JOIN message_runs mr ON mr.message_id = m.id
    JOIN chat_runs cr ON cr.run_id = mr.run_id
    CROSS JOIN chat_ids_list cil
    CROSS JOIN run_base rb
    WHERE mr.run_id = rb.id
      AND cr.chat_id = ANY(cil.chat_ids)
      AND (m.role = 'assistant' OR m.role = 'response')
    GROUP BY cr.chat_id
),
grades_data AS (
    -- Get latest grade per chat (DISTINCT ON to handle multiple grades)
    SELECT DISTINCT ON (cr.chat_id)
        cr.chat_id as chat_id,
        jsonb_build_object(
            'id', g.id::text,
            'createdAt', g.created_at,
            'simulationChatId', cr.chat_id::text,
            'rubricId', g.rubric_id::text,
            'description', g.description,
            'passed', g.passed,
            'score', g.score,
            'timeTaken', g.time_taken
        ) as grade
    FROM grades g
    JOIN runs r ON r.id = g.run_id
    JOIN chat_runs cr ON cr.run_id = r.id
    CROSS JOIN chat_ids_list cil
    CROSS JOIN run_base rb
    WHERE g.run_id = rb.id
      AND g.eval = true  -- Only eval grades for runs
      AND cr.chat_id = ANY(cil.chat_ids)
    ORDER BY cr.chat_id, g.created_at DESC
),
feedbacks_grouped AS (
    SELECT 
        f.grade_id as grade_id,
        COALESCE(
            jsonb_agg(
                jsonb_build_object(
                    'id', f.id::text,
                    'createdAt', f.created_at,
                    'standardId', f.standard_id::text,
                    'simulationChatGradeId', f.grade_id::text,
                    'total', f.total,
                    'feedback', f.feedback
                )
            ),
            '[]'::jsonb
        ) as feedbacks
    FROM feedbacks f
    WHERE f.grade_id IN (
        SELECT (grade->>'id')::uuid
        FROM grades_data
    )
    GROUP BY f.grade_id
),
-- Get rubric from first grade (all grades for a run should have same rubric)
rubric_id_from_grade AS (
    SELECT DISTINCT (grade->>'rubricId')::uuid as rubric_id
    FROM grades_data
    LIMIT 1
),
rubric_standard_groups AS (
    SELECT 
        sg.id,
        sg.name,
        sg.short_name,
        sg.points,
        sg.pass_points,
        sg.description,
        sg.rubric_id
    FROM standard_groups sg
    CROSS JOIN rubric_id_from_grade rig
    WHERE rig.rubric_id IS NOT NULL
      AND sg.rubric_id = rig.rubric_id
),
rubric_standards_grouped AS (
    SELECT 
        s.standard_group_id,
        array_agg(s.id::text) as standard_ids,
        jsonb_agg(
            jsonb_build_object(
                'id', s.id::text,
                'name', s.name,
                'points', s.points,
                'standardGroupId', s.standard_group_id::text
            )
        ) as standards_list
    FROM standards s
    WHERE s.standard_group_id IN (SELECT id FROM rubric_standard_groups)
    GROUP BY s.standard_group_id
),
standards_mapping_merged AS (
    SELECT COALESCE(
        jsonb_object_agg(
            s.id::text,
            jsonb_build_object(
                'name', s.name,
                'description', COALESCE(s.description, ''),
                'points', s.points
            )
        ),
        '{}'::jsonb
    ) as standards_mapping
    FROM standards s
    WHERE s.standard_group_id IN (SELECT id FROM rubric_standard_groups)
),
rubric_structure_complete AS (
    SELECT 
        CASE 
            WHEN EXISTS (SELECT 1 FROM rubric_standard_groups) THEN
                jsonb_build_object(
                    'standardGroups', (
                        SELECT jsonb_object_agg(rsg.id::text, rsgroup.standard_ids)
                        FROM rubric_standard_groups rsg
                        LEFT JOIN rubric_standards_grouped rsgroup ON rsgroup.standard_group_id = rsg.id
                    ),
                    'standardGroupsMapping', (
                        SELECT jsonb_object_agg(
                            rsg.id::text,
                            jsonb_build_object(
                                'name', rsg.name,
                                'description', COALESCE(rsg.description, ''),
                                'points', rsg.points,
                                'passPoints', rsg.pass_points
                            )
                        )
                        FROM rubric_standard_groups rsg
                    ),
                    'standardsMapping', smm.standards_mapping
                )
            ELSE NULL
        END as rubric_structure
    FROM standards_mapping_merged smm
),
skill_scores_per_chat AS (
    SELECT 
        gd.chat_id,
        rsg.id as group_id,
        rsg.name as group_name,
        rsg.short_name,
        AVG((fb->>'total')::numeric) as avg_score,
        MAX((std->>'points')::numeric) as max_points,
        string_agg(COALESCE(fb->>'feedback', ''), '; ') as feedbacks_text
    FROM grades_data gd
    LEFT JOIN feedbacks_grouped fg ON fg.grade_id = (gd.grade->>'id')::uuid
    CROSS JOIN rubric_standard_groups rsg
    JOIN rubric_standards_grouped rsgroup ON rsgroup.standard_group_id = rsg.id
    CROSS JOIN LATERAL jsonb_array_elements(rsgroup.standards_list) std
    CROSS JOIN LATERAL jsonb_array_elements(COALESCE(fg.feedbacks, '[]'::jsonb)) fb
    WHERE (fb->>'standardId')::text = (std->>'id')::text
    GROUP BY gd.chat_id, rsg.id, rsg.name, rsg.short_name
),
dynamic_rubric_per_chat AS (
    SELECT 
        gd.chat_id,
        CASE 
            WHEN gd.grade IS NOT NULL AND EXISTS (SELECT 1 FROM rubric_standard_groups) THEN
                jsonb_build_object(
                    'chatId', gd.chat_id::text,
                    'score', (gd.grade->>'score')::numeric,
                    'passed', (gd.grade->>'passed')::boolean,
                    'timeTaken', (gd.grade->>'timeTaken')::integer,
                    'skillScores', COALESCE(
                        (SELECT jsonb_object_agg(
                            group_name,
                            ROUND((avg_score / max_points) * 5)
                        )
                        FROM skill_scores_per_chat
                        WHERE chat_id = gd.chat_id),
                        '{}'::jsonb
                    ),
                    'skillFeedbacks', COALESCE(
                        (SELECT jsonb_object_agg(short_name, feedbacks_text)
                        FROM skill_scores_per_chat
                        WHERE chat_id = gd.chat_id),
                        '{}'::jsonb
                    ),
                    'totalPossiblePoints', COALESCE(
                        (SELECT r.points FROM rubrics r 
                         CROSS JOIN rubric_id_from_grade rig 
                         WHERE r.id = rig.rubric_id),
                        0
                    )
                )
            ELSE NULL
        END as dynamic_rubric
    FROM grades_data gd
),
max_scores_per_group_chat AS (
    SELECT 
        gd.chat_id,
        s.standard_group_id,
        MAX((fb->>'total')::numeric) as max_score,
        rsg.pass_points
    FROM grades_data gd
    LEFT JOIN feedbacks_grouped fg ON fg.grade_id = (gd.grade->>'id')::uuid
    CROSS JOIN LATERAL jsonb_array_elements(COALESCE(fg.feedbacks, '[]'::jsonb)) fb
    JOIN standards s ON s.id = ((fb->>'standardId')::uuid)
    JOIN rubric_standard_groups rsg ON rsg.id = s.standard_group_id
    GROUP BY gd.chat_id, s.standard_group_id, rsg.pass_points
),
grading_state_per_chat AS (
    SELECT 
        gd.chat_id,
        CASE 
            WHEN gd.grade IS NOT NULL AND fg.feedbacks IS NOT NULL 
                 AND EXISTS (SELECT 1 FROM rubric_standard_groups) THEN
                jsonb_build_object(
                    'achievedStandards', COALESCE(
                        (SELECT jsonb_object_agg(
                            (fb->>'standardId')::text,
                            true
                        )
                        FROM jsonb_array_elements(fg.feedbacks) fb),
                        '{}'::jsonb
                    ),
                    'passedStandards', COALESCE(
                        (SELECT jsonb_object_agg(
                            (fb->>'standardId')::text,
                            (fb->>'total')::numeric >= mspgc.pass_points
                        )
                        FROM jsonb_array_elements(fg.feedbacks) fb
                        JOIN standards s ON s.id = ((fb->>'standardId')::uuid)
                        LEFT JOIN max_scores_per_group_chat mspgc 
                            ON mspgc.chat_id = gd.chat_id 
                            AND mspgc.standard_group_id = s.standard_group_id),
                        '{}'::jsonb
                    ),
                    'feedbackByStandardId', COALESCE(
                        (SELECT jsonb_object_agg(
                            (fb->>'standardId')::text,
                            (fb->>'feedback')::text
                        )
                        FROM jsonb_array_elements(fg.feedbacks) fb),
                        '{}'::jsonb
                    ),
                    'gradeDescription', COALESCE(gd.grade->>'description', '')
                )
            ELSE NULL
        END as grading_state
    FROM grades_data gd
    LEFT JOIN feedbacks_grouped fg ON fg.grade_id = (gd.grade->>'id')::uuid
),
chats_with_all_data AS (
    SELECT 
        cb.id as chat_id,
        jsonb_build_object(
            'chat', jsonb_build_object(
                'id', cb.id::text,
                'createdAt', cb.created_at,
                'updatedAt', cb.updated_at,
                'title', cb.title,
                'scenarioId', cb.scenario_id::text,
                'parentScenarioId', cb.scenario_id::text,
                'attemptId', NULL::text,  -- Runs don't have attempts
                'completed', cb.completed,
                'completedAt', CASE 
                    WHEN cb.completed AND gd.grade IS NOT NULL 
                    THEN gd.grade->>'createdAt'
                    ELSE NULL 
                END,
                'traceId', CASE WHEN cb.trace_id IS NOT NULL THEN cb.trace_id::text ELSE NULL END,
                'documentIds', COALESCE(
                    (SELECT jsonb_agg(did)
                     FROM unnest(cb.document_ids) as did),
                    '[]'::jsonb
                )
            ),
            'scenario', sd.scenario_data,
            'messages', COALESCE(mg.messages, '[]'::jsonb),
            'hints', COALESCE(hd.hints, '[]'::jsonb),
            'grade', gd.grade,
            'feedbacks', COALESCE(fg.feedbacks, '[]'::jsonb),
            'dynamicRubric', drpc.dynamic_rubric,
            'gradingState', gspc.grading_state,
            'previousChats', '[]'::jsonb  -- Runs don't have previous chats
        ) as chat_data,
        cb.completed,
        cb.created_at,
        gd.grade
    FROM chats_base cb
    LEFT JOIN scenarios_data sd ON sd.id = cb.scenario_id
    LEFT JOIN messages_grouped mg ON mg.chat_id = cb.id
    LEFT JOIN hints_data hd ON hd.chat_id = cb.id
    LEFT JOIN grades_data gd ON gd.chat_id = cb.id
    LEFT JOIN feedbacks_grouped fg ON fg.grade_id = (gd.grade->>'id')::uuid
    LEFT JOIN dynamic_rubric_per_chat drpc ON drpc.chat_id = cb.id
    LEFT JOIN grading_state_per_chat gspc ON gspc.chat_id = cb.id
),
aggregated_results_data AS (
    SELECT 
        CASE 
            WHEN COUNT(*) FILTER (WHERE completed = true AND grade IS NOT NULL) > 0 THEN
                jsonb_build_object(
                    'totalScore', COALESCE(SUM((grade->>'score')::numeric) FILTER (WHERE completed = true AND grade IS NOT NULL), 0)::float,
                    'totalPossiblePoints', COALESCE(
                        (SELECT r.points FROM rubrics r 
                         CROSS JOIN rubric_id_from_grade rig 
                         WHERE r.id = rig.rubric_id),
                        0
                    )::float,
                    'percentage', CASE 
                        WHEN (SELECT r.points FROM rubrics r 
                              CROSS JOIN rubric_id_from_grade rig 
                              WHERE r.id = rig.rubric_id) > 0 THEN
                            ROUND(
                                (SUM((grade->>'score')::numeric) FILTER (WHERE completed = true AND grade IS NOT NULL)::numeric / 
                                 (SELECT r.points FROM rubrics r 
                                  CROSS JOIN rubric_id_from_grade rig 
                                  WHERE r.id = rig.rubric_id)::numeric) * 100.0,
                                1
                            )::float
                        ELSE 0.0
                    END,
                    'passed', BOOL_AND((grade->>'passed')::boolean) FILTER (WHERE completed = true AND grade IS NOT NULL),
                    'chatsCompleted', COUNT(*) FILTER (WHERE completed = true AND grade IS NOT NULL)::int,
                    'totalChats', COUNT(*)::int
                )
            ELSE NULL
        END as aggregated_results
    FROM chats_with_all_data
),
elapsed_time_calc AS (
    SELECT 
        COALESCE(
            SUM(
                CASE 
                    WHEN cwad.completed AND cwad.grade IS NOT NULL THEN
                        (cwad.grade->>'timeTaken')::integer
                    WHEN cwad.completed THEN
                        EXTRACT(EPOCH FROM (
                            (cwad.grade->>'createdAt')::timestamp - cwad.created_at
                        ))::integer
                    ELSE
                        EXTRACT(EPOCH FROM (NOW() - cwad.created_at))::integer
                END
            ),
            0
        ) as total_elapsed
    FROM chats_with_all_data cwad
),
timer_data AS (
    SELECT 
        jsonb_build_object(
            'elapsed', etc.total_elapsed,
            'limit', NULL::int,  -- Runs don't have time limits
            'exceeded', false,
            'formatted', ''
        ) as timer
    FROM elapsed_time_calc etc
),
scenario_documents_data AS (
    SELECT COALESCE(
        jsonb_agg(DISTINCT
            jsonb_build_object(
                'document_id', d.id::text,
                'name', d.name,
                'type', NULL,
                'updatedAt', d.updated_at,
                'extension', CASE WHEN u.file_path IS NOT NULL THEN SUBSTRING(u.file_path FROM '\\.([^\\.]+)$') ELSE '' END,
                'scenario_ids', COALESCE(
                    (SELECT array_agg(DISTINCT st.parent_id::text)
                     FROM scenario_documents sd2
                     JOIN scenario_tree st ON st.child_id = sd2.scenario_id AND st.parent_id = st.child_id
                     WHERE sd2.document_id = d.id AND sd2.active = true),
                    ARRAY[]::text[]
                ),
                'can_edit', false,
                'can_delete', false,
                'active', d.active,
                'department_ids', COALESCE(
                    (SELECT array_agg(dd.department_id::text ORDER BY dd.created_at)
                     FROM document_departments dd 
                     WHERE dd.document_id = d.id AND dd.active = true),
                    NULL
                ),
                'file_path', d.file_path,
                'mime_type', d.mime_type,
                'parameter_item_ids', COALESCE(
                    (SELECT array_agg(DISTINCT df.field_id::text)
                     FROM document_fields df
                     WHERE df.document_id = d.id AND df.active = true),
                    ARRAY[]::text[]
                )
            )
        ),
        '[]'::jsonb
    ) as scenario_documents
    FROM documents d
    LEFT JOIN document_uploads du ON du.document_id = d.id AND du.active = true
    LEFT JOIN uploads u ON u.id = du.upload_id
    JOIN scenario_documents sd ON sd.document_id = d.id
    CROSS JOIN chats_base cb
    WHERE sd.scenario_id = cb.scenario_id AND d.active = true
)
SELECT 
    jsonb_build_object(
        'id', rb.id::text,
        'createdAt', rb.created_at,
        'inputTokens', rb.input_tokens,
        'outputTokens', rb.output_tokens,
        'cachedInputTokens', rb.cached_input_tokens,
        'keyId', rb.key_id::text,
        'agentId', rb.agent_id::text
    ) as run,
    COALESCE(
        jsonb_agg(cwad.chat_data ORDER BY cwad.created_at),
        '[]'::jsonb
    ) as chats,
    COALESCE(ard.aggregated_results, NULL) as aggregated_results,
    td.timer,
    COALESCE(rsc.rubric_structure, NULL) as rubric_structure,
    COALESCE(sdd.scenario_documents, '[]'::jsonb) as scenario_documents,
    0 as current_chat_index,  -- Always start at first chat
    COALESCE((SELECT COUNT(*) FROM chats_base), 0) as expected_chat_count,
    CASE WHEN (SELECT COUNT(*) FROM chats_base) <= 1 THEN true ELSE false END as is_single_chat_attempt,
    false as is_last_attempt,  -- Not applicable for runs
    true as show_results,  -- Always show results for runs
    false as should_show_controls,  -- No controls for runs
    0 as remaining_scenarios_count,  -- Not applicable
    false as is_last_remaining_scenario,  -- Not applicable
    false as can_pick_multiple_alternatives,  -- Not applicable
    false as is_active,  -- Runs are always completed
    '[]'::jsonb as all_simulation_scenarios  -- Not applicable for runs
FROM run_base rb
CROSS JOIN chats_with_all_data cwad
LEFT JOIN aggregated_results_data ard ON true
LEFT JOIN timer_data td ON true
LEFT JOIN rubric_structure_complete rsc ON true
LEFT JOIN scenario_documents_data sdd ON true
GROUP BY rb.id, rb.created_at, rb.input_tokens, rb.output_tokens, rb.cached_input_tokens, rb.key_id, rb.agent_id, ard.aggregated_results, td.timer, rsc.rubric_structure, sdd.scenario_documents;

