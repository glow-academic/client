
        WITH attempt_base AS (
        SELECT 
            sa.id,
            sa.created_at,
            sa.simulation_id,
            sa.infinite_mode,
            sa.archived,
            s.id as sim_id,
            s.title as sim_title,
            s.description as sim_description,
            (SELECT department_id FROM simulation_departments sd WHERE sd.simulation_id = s.id AND sd.active = true ORDER BY sd.created_at LIMIT 1) as sim_department_id,
            s.active as sim_active,
            s.practice_simulation as sim_practice_simulation,
            COALESCE(
                (SELECT SUM(stl.time_limit_seconds)
                 FROM scenario_time_limits stl
                 JOIN simulation_scenarios ss ON ss.simulation_id = stl.simulation_id AND ss.scenario_id = stl.scenario_id
                 WHERE stl.simulation_id = s.id AND stl.active = true AND ss.active = true),
                0
            ) as sim_time_limit,
            (SELECT ss.rubric_id FROM simulation_scenarios ss WHERE ss.simulation_id = s.id AND ss.active = true ORDER BY ss.position LIMIT 1) as sim_rubric_id,
            s.created_at as sim_created_at,
            s.updated_at as sim_updated_at
        FROM simulation_attempts sa
        JOIN simulations s ON s.id = sa.simulation_id
        WHERE sa.id = $1
        ),
        attempt_profiles_data AS (
            SELECT COALESCE(
                jsonb_agg(
                    jsonb_build_object(
                        'profileId', ap.profile_id::text,
                        'attemptId', ap.attempt_id::text,
                        'active', ap.active
                    )
                ),
                '[]'::jsonb
            ) as attempt_profiles
            FROM attempt_profiles ap
            WHERE ap.attempt_id = $1
        ),
        chats_base AS (
        SELECT 
            sc.id,
            sc.created_at,
            sc.updated_at,
            sc.title,
            sc.scenario_id,
            ac.attempt_id,
            sc.completed,
            sc.trace_id,
            -- Add document IDs for this chat's scenario
            COALESCE(
                (SELECT array_agg(DISTINCT sd.document_id::text)
                 FROM scenario_documents sd
                 WHERE sd.scenario_id = sc.scenario_id AND sd.active = true),
                ARRAY[]::text[]
            ) as document_ids
        FROM attempt_chats ac
        JOIN chats sc ON sc.id = ac.chat_id
        WHERE ac.attempt_id = $1
        ORDER BY sc.created_at
        ),
        -- Get current attempt's profile_id for finding previous chats
        current_attempt_profile AS (
            SELECT ap.profile_id
            FROM attempt_profiles ap
            WHERE ap.attempt_id = $1 AND ap.active = true
            LIMIT 1
        ),
        -- Get all scenarios for this simulation (for permutation generation)
        simulation_scenarios_list AS (
            SELECT ss.scenario_id, ss.position
            FROM simulation_scenarios ss
            CROSS JOIN attempt_base ab
            WHERE ss.simulation_id = ab.simulation_id AND ss.active = true
            ORDER BY ss.position
        ),
        -- Get all videos for this simulation with their positions
        simulation_videos_list AS (
            SELECT sv.video_id, sv.position, sv.show_problem_statement, sv.show_objectives, sv.show_image
            FROM simulation_videos sv
            CROSS JOIN attempt_base ab
            WHERE sv.simulation_id = ab.simulation_id AND sv.active = true
            ORDER BY sv.position
        ),
        -- Get video data with questions, timestamps, and options
        videos_data AS (
            SELECT 
                v.id as video_id,
                v.name as video_title,
                v.length_seconds,
                vu.upload_id,
                svl.position,
                svl.show_image,
                -- Get documents connected to this video
                COALESCE(
                    (SELECT jsonb_agg(
                        jsonb_build_object(
                            'id', d.id::text,
                            'name', d.name,
                            'description', '',
                            'extension', CASE 
                                WHEN u.file_path IS NOT NULL THEN SUBSTRING(u.file_path FROM '\.([^\.]+)$')
                                ELSE NULL
                            END,
                            'filePath', u.file_path,
                            'mimeType', u.mime_type,
                            'uploadId', CASE WHEN du.upload_id IS NOT NULL THEN du.upload_id::text ELSE NULL END
                        )
                    )
                    FROM video_documents vd
                    JOIN documents d ON d.id = vd.document_id
                    LEFT JOIN document_uploads du ON du.document_id = d.id AND du.active = true
                    LEFT JOIN uploads u ON u.id = du.upload_id
                    WHERE vd.video_id = v.id AND vd.active = true AND d.active = true),
                    '[]'::jsonb
                ) as videoDocuments,
                -- Get questions with timestamps and options
                COALESCE(
                    (SELECT jsonb_agg(
                        jsonb_build_object(
                            'id', q.id::text,
                            'questionText', q.question_text,
                            'type', 'choice'::text,
                            'allowMultiple', q.allow_multiple,
                            'times', (
                                SELECT ARRAY_AGG(qt.time ORDER BY qt.time)
                                FROM question_times qt
                                WHERE qt.video_id = v.id AND qt.question_id = q.id AND qt.active = true
                            ),
                            'options', (
                                SELECT COALESCE(
                                    jsonb_agg(
                                        jsonb_build_object(
                                            'id', o.id::text,
                                            'optionText', o.option_text,
                                            'type', o.type::text,
                                            'isCorrect', CASE WHEN qa.option_id IS NOT NULL THEN true ELSE false END
                                        ) ORDER BY o.id
                                    ),
                                    '[]'::jsonb
                                )
                                FROM question_options qo
                                JOIN options o ON o.id = qo.option_id AND o.active = true
                                LEFT JOIN question_answers qa ON qa.question_id = q.id AND qa.option_id = o.id AND qa.active = true
                                WHERE qo.question_id = q.id AND qo.active = true
                            )
                        ) ORDER BY q.created_at
                    )
                    FROM video_questions vq
                    JOIN questions q ON q.id = vq.question_id
                    WHERE vq.video_id = v.id AND vq.active = true AND q.active = true),
                    '[]'::jsonb
                ) as questions
            FROM simulation_videos_list svl
            JOIN videos v ON v.id = svl.video_id
            LEFT JOIN video_uploads vu ON vu.video_id = v.id AND vu.active = true
            WHERE v.active = true
        ),
        -- Get quizzes for this attempt
        attempt_quizzes_data AS (
            SELECT 
                q.id as quiz_id,
                q.video_id,
                q.completed as quiz_completed,
                q.created_at as quiz_created_at,
                q.updated_at as quiz_updated_at
            FROM attempt_quizzes aq
            JOIN quizzes q ON q.id = aq.quiz_id
            WHERE aq.attempt_id = $1
        ),
        -- Get quiz responses
        quiz_responses_data AS (
            SELECT 
                qr.quiz_id,
                qr.question_id,
                qr.option_id,
                qr.completed as response_completed,
                qr.created_at as response_created_at
            FROM quiz_responses qr
            WHERE qr.quiz_id IN (SELECT quiz_id FROM attempt_quizzes_data)
        ),
        -- Group quiz responses by quiz
        quiz_responses_grouped AS (
            SELECT 
                qr.quiz_id,
                COALESCE(
                    jsonb_agg(
                        jsonb_build_object(
                            'questionId', qr.question_id::text,
                            'optionId', qr.option_id::text,
                            'completed', qr.response_completed,
                            'createdAt', qr.response_created_at
                        ) ORDER BY qr.response_created_at
                    ),
                    '[]'::jsonb
                ) as responses
            FROM quiz_responses_data qr
            GROUP BY qr.quiz_id
        ),
        -- Get parent scenarios from simulation_scenarios (for controls check)
        -- Uses simulation_scenarios as the source of truth
        simulation_root_scenarios_list AS (
            SELECT DISTINCT
                ss.scenario_id as root_scenario_id,
                ss.position
            FROM simulation_scenarios ss
            CROSS JOIN attempt_base ab
            WHERE ss.simulation_id = ab.simulation_id AND ss.active = true
            ORDER BY ss.position
        ),
        -- Recursively map all child scenarios to their root parent scenarios
        -- This includes scenarios from current attempt and will be extended for previous chats
        scenario_root_mapping AS (
            WITH RECURSIVE scenario_ancestors AS (
                -- Base case: start with all unique scenario IDs from current attempt's chats
                SELECT DISTINCT
                    sc.scenario_id as child_scenario_id,
                    sc.scenario_id as ancestor_id,
                    0 as depth
                FROM chats sc
                JOIN attempt_chats ac ON ac.chat_id = sc.id
                WHERE ac.attempt_id = $1
                
                UNION ALL
                
                -- Recursive case: traverse up the tree
                SELECT 
                    sa.child_scenario_id,
                    COALESCE(
                        (SELECT st.parent_id 
                         FROM scenario_tree st 
                         WHERE st.child_id = sa.ancestor_id 
                           AND st.parent_id != st.child_id 
                         LIMIT 1),
                        sa.ancestor_id
                    ) as ancestor_id,
                    sa.depth + 1 as depth
                FROM scenario_ancestors sa
                WHERE sa.depth < 100  -- Safety limit
                  AND EXISTS (
                      SELECT 1 FROM scenario_tree st 
                      WHERE st.child_id = sa.ancestor_id 
                        AND st.parent_id != st.child_id
                  )
            )
            SELECT DISTINCT
                child_scenario_id,
                ancestor_id as root_scenario_id
            FROM scenario_ancestors
            WHERE depth = (
                SELECT MAX(depth) 
                FROM scenario_ancestors sa2 
                WHERE sa2.child_scenario_id = scenario_ancestors.child_scenario_id
            )
        ),
        -- Recursively map previous chat scenarios to their root parent scenarios
        previous_chat_scenario_root_mapping AS (
            WITH RECURSIVE scenario_ancestors AS (
                -- Base case: start with all unique scenario IDs from previous chats
                SELECT DISTINCT
                    sc.scenario_id as child_scenario_id,
                    sc.scenario_id as ancestor_id,
                    0 as depth
                FROM chats sc
                JOIN attempt_chats ac2 ON ac2.chat_id = sc.id
                JOIN simulation_attempts sa2 ON sa2.id = ac2.attempt_id
                JOIN attempt_profiles ap2 ON ap2.attempt_id = sa2.id AND ap2.active = true
                CROSS JOIN current_attempt_profile cap
                WHERE ap2.profile_id = cap.profile_id
                  AND sc.completed = true
                  AND EXISTS (
                      SELECT 1 FROM grades scg 
                      JOIN runs r ON r.id = scg.run_id
                      JOIN chat_runs rc ON rc.run_id = r.id
                      WHERE rc.chat_id = sc.id AND scg.eval = false
                  )
                  AND ac2.attempt_id != $1
                
                UNION ALL
                
                -- Recursive case: traverse up the tree
                SELECT 
                    sa.child_scenario_id,
                    COALESCE(
                        (SELECT st.parent_id 
                         FROM scenario_tree st 
                         WHERE st.child_id = sa.ancestor_id 
                           AND st.parent_id != st.child_id 
                         LIMIT 1),
                        sa.ancestor_id
                    ) as ancestor_id,
                    sa.depth + 1 as depth
                FROM scenario_ancestors sa
                WHERE sa.depth < 100  -- Safety limit
                  AND EXISTS (
                      SELECT 1 FROM scenario_tree st 
                      WHERE st.child_id = sa.ancestor_id 
                        AND st.parent_id != st.child_id
                  )
            )
            SELECT DISTINCT
                child_scenario_id,
                ancestor_id as root_scenario_id
            FROM scenario_ancestors
            WHERE depth = (
                SELECT MAX(depth) 
                FROM scenario_ancestors sa2 
                WHERE sa2.child_scenario_id = scenario_ancestors.child_scenario_id
            )
        ),
        -- Find previous completed chats from other attempts by same profile
        -- Maps child scenarios to parent scenarios for matching with simulation_scenarios
        -- Use latest grade per chat (DISTINCT ON)
        -- Include ALL simulation scenarios, not just ones in chats_base
        -- Exclude previous chats if current attempt is a practice simulation
        previous_chats_with_grades AS (
            SELECT DISTINCT ON (sc.id)
                sc.id as chat_id,
                sc.scenario_id as child_scenario_id,
                -- Recursively map child scenario to root parent scenario for matching
                COALESCE(
                    (SELECT pcsrm.root_scenario_id 
                     FROM previous_chat_scenario_root_mapping pcsrm 
                     WHERE pcsrm.child_scenario_id = sc.scenario_id),
                    sc.scenario_id
                ) as parent_scenario_id,
                ac2.attempt_id,
                sa2.simulation_id,
                sc.title,
                sc.created_at,
                scg.score,
                scg.passed,
                scg.time_taken
            FROM chats sc
            JOIN attempt_chats ac2 ON ac2.chat_id = sc.id
            JOIN simulation_attempts sa2 ON sa2.id = ac2.attempt_id
            JOIN attempt_profiles ap2 ON ap2.attempt_id = sa2.id AND ap2.active = true
            CROSS JOIN current_attempt_profile cap
            CROSS JOIN simulation_scenarios_list ssl
            CROSS JOIN attempt_base ab
            LEFT JOIN grades scg ON scg.eval = false
            LEFT JOIN runs r_prev ON r_prev.id = scg.run_id
            LEFT JOIN chat_runs rc_prev ON rc_prev.run_id = r_prev.id AND rc_prev.chat_id = sc.id
            WHERE ap2.profile_id = cap.profile_id
              AND sc.completed = true
              AND rc_prev.chat_id IS NOT NULL
              -- Match root parent scenario IDs (child scenarios are recursively mapped to their root parents)
              AND COALESCE(
                    (SELECT pcsrm.root_scenario_id 
                     FROM previous_chat_scenario_root_mapping pcsrm 
                     WHERE pcsrm.child_scenario_id = sc.scenario_id),
                    sc.scenario_id
                ) = ssl.scenario_id
              AND ac2.attempt_id != $1
              -- Exclude previous chats if current attempt is a practice simulation
              -- Practice simulations must always go through manual grading
              AND ab.sim_practice_simulation = false
            ORDER BY sc.id, scg.created_at DESC
        ),
        -- Aggregate timeTaken from all completed chats per previous attempt
        previous_attempt_time_aggregation AS (
            SELECT 
                ac.attempt_id,
                COALESCE(SUM(scg.time_taken), 0)::integer as total_time_taken
            FROM attempt_chats ac
            JOIN chats sc ON sc.id = ac.chat_id
            JOIN grades scg ON scg.eval = false
            JOIN runs r_agg ON r_agg.id = scg.run_id
            JOIN chat_runs rc_agg ON rc_agg.run_id = r_agg.id AND rc_agg.chat_id = sc.id
            WHERE ac.attempt_id IN (SELECT DISTINCT attempt_id FROM previous_chats_with_grades)
              AND sc.completed = true
              AND rc_agg.chat_id IS NOT NULL
            GROUP BY ac.attempt_id
        ),
        -- Get rubric total points per simulation for previous attempts
        -- Use r.points from rubrics table (matching analytics MV calculation)
        previous_attempt_rubric_points AS (
            SELECT DISTINCT ON (sa.simulation_id)
                sa.simulation_id,
                COALESCE(r.points, 0)::integer as total_points
            FROM simulation_attempts sa
            JOIN simulations s ON s.id = sa.simulation_id
            LEFT JOIN simulation_scenarios ss_rubric ON ss_rubric.simulation_id = s.id AND ss_rubric.active = true
            LEFT JOIN rubrics r ON r.id = ss_rubric.rubric_id
            WHERE sa.id IN (SELECT DISTINCT attempt_id FROM previous_chats_with_grades)
            ORDER BY sa.simulation_id
        ),
        previous_chats_for_scenarios AS (
            SELECT 
                pwg.parent_scenario_id as scenario_id,
                COALESCE(
                    jsonb_agg(
                        jsonb_build_object(
                            'chatId', pwg.chat_id::text,
                            'attemptId', pwg.attempt_id::text,
                            'score', pwg.score,
                            'passed', pwg.passed,
                            'createdAt', pwg.created_at,
                            'title', pwg.title,
                            'timeTaken', COALESCE(pwg.time_taken, 0),
                            'totalPossiblePoints', COALESCE(parp.total_points, 0),
                            'percentage', CASE 
                                WHEN pwg.score IS NOT NULL AND parp.total_points > 0 THEN
                                    ROUND((pwg.score::numeric / parp.total_points::numeric) * 100.0)::integer
                                ELSE NULL
                            END
                        ) ORDER BY pwg.created_at DESC
                    ),
                    '[]'::jsonb
                ) as previous_chats
            FROM previous_chats_with_grades pwg
            LEFT JOIN previous_attempt_time_aggregation pat ON pat.attempt_id = pwg.attempt_id
            LEFT JOIN previous_attempt_rubric_points parp ON parp.simulation_id = pwg.simulation_id
            GROUP BY pwg.parent_scenario_id
        ),
        -- All simulation scenarios with their previous chats (for permutation generation)
        -- This MUST include ALL scenarios, even if they have no previous chats
        all_simulation_scenarios_with_previous_chats AS (
            SELECT 
                ssl.scenario_id,
                ssl.position,
                jsonb_build_object(
                    'id', s.id::text,
                    'name', s.name,
                    'problemStatement', COALESCE(ps.problem_statement, ''),
                    'departmentId', COALESCE((SELECT department_id::text FROM scenario_departments sd WHERE sd.scenario_id = s.id AND sd.active = true ORDER BY sd.created_at LIMIT 1), ''),
                    'active', s.active,
                    'personaId', CASE WHEN sp.persona_id IS NOT NULL THEN sp.persona_id::text ELSE NULL END,
                    'personaName', CASE WHEN p.name IS NOT NULL THEN p.name ELSE NULL END,
                    'personaIcon', CASE WHEN p.icon IS NOT NULL THEN p.icon ELSE NULL END,
                    'personaColor', CASE WHEN p.color IS NOT NULL THEN p.color ELSE NULL END,
                    'createdAt', s.created_at,
                    'updatedAt', s.updated_at,
                    'generated', s.generated,
                    'defaultScenario', false,
                    'copyPasteAllowed', COALESCE(ss.copy_paste_allowed, false),
                    'objectives', COALESCE(
                        (SELECT jsonb_agg(o.objective ORDER BY so.idx)
                         FROM scenario_objectives so
                         JOIN objectives o ON o.id = so.objective_id
                         WHERE so.scenario_id = s.id),
                        '[]'::jsonb
                    )
                ) as scenario_data,
                COALESCE(pcf.previous_chats, '[]'::jsonb) as previous_chats
            FROM simulation_scenarios_list ssl
            LEFT JOIN simulation_scenarios ss ON ss.scenario_id = ssl.scenario_id AND ss.simulation_id = (SELECT simulation_id FROM attempt_base)
            LEFT JOIN scenarios s ON s.id = ssl.scenario_id
            LEFT JOIN scenario_problem_statements sps ON sps.scenario_id = s.id AND sps.active = true
            LEFT JOIN problem_statements ps ON ps.id = sps.problem_statement_id
            LEFT JOIN scenario_personas sp ON sp.scenario_id = s.id AND sp.active = true
            LEFT JOIN personas p ON p.id = sp.persona_id
            LEFT JOIN previous_chats_for_scenarios pcf ON pcf.scenario_id = ssl.scenario_id
            ORDER BY ssl.position
        ),
        chat_ids_list AS (
            SELECT array_agg(id) as chat_ids
            FROM chats_base
        ),
        scenario_ids_list AS (
            SELECT array_agg(DISTINCT scenario_id) as scenario_ids
            FROM chats_base
        ),
        scenarios_data AS (
            SELECT 
                s.id,
                jsonb_build_object(
                    'id', s.id::text,
                    'name', s.name,
                    'problemStatement', COALESCE(ps.problem_statement, ''),
                    'departmentId', COALESCE((SELECT department_id::text FROM scenario_departments sd WHERE sd.scenario_id = s.id AND sd.active = true ORDER BY sd.created_at LIMIT 1), NULL),
                    'active', s.active,
                    'personaId', CASE WHEN sp.persona_id IS NOT NULL THEN sp.persona_id::text ELSE NULL END,
                    'personaName', CASE WHEN p.name IS NOT NULL THEN p.name ELSE NULL END,
                    'personaIcon', CASE WHEN p.icon IS NOT NULL THEN p.icon ELSE NULL END,
                    'personaColor', CASE WHEN p.color IS NOT NULL THEN p.color ELSE NULL END,
                    'createdAt', s.created_at,
                    'updatedAt', s.updated_at,
                    'generated', s.generated,
                    'defaultScenario', false,
                    'copyPasteAllowed', COALESCE(ss.copy_paste_allowed, false),
                    'objectives', COALESCE(
                        (SELECT jsonb_agg(o.objective ORDER BY so.idx)
                         FROM scenario_objectives so
                         JOIN objectives o ON o.id = so.objective_id
                         WHERE so.scenario_id = s.id),
                        '[]'::jsonb
                    )
                ) as scenario_data,
                COALESCE(ss.hints_enabled, false) as hints_enabled,
                COALESCE(s.objectives_enabled, true) as objectives_enabled,
                COALESCE(s.image_enabled, false) as image_input_enabled,
                COALESCE(ss.copy_paste_allowed, false) as copy_paste_allowed
            FROM scenarios s
            CROSS JOIN scenario_ids_list sil
            CROSS JOIN attempt_base ab
            LEFT JOIN simulation_scenarios ss ON ss.scenario_id = s.id AND ss.simulation_id = ab.simulation_id
            LEFT JOIN scenario_problem_statements sps ON sps.scenario_id = s.id AND sps.active = true
            LEFT JOIN problem_statements ps ON ps.id = sps.problem_statement_id
            LEFT JOIN scenario_personas sp ON sp.scenario_id = s.id AND sp.active = true
            LEFT JOIN personas p ON p.id = sp.persona_id
            WHERE s.id = ANY(sil.scenario_ids)
        ),
        simulation_flags AS (
            SELECT 
                COALESCE((SELECT ss.hints_enabled FROM simulation_scenarios ss JOIN chats_base cb ON ss.scenario_id = cb.scenario_id CROSS JOIN attempt_base ab WHERE ss.simulation_id = ab.simulation_id ORDER BY cb.created_at LIMIT 1), false) as hints_enabled,
                COALESCE((SELECT s.objectives_enabled FROM simulation_scenarios ss JOIN chats_base cb ON ss.scenario_id = cb.scenario_id JOIN scenarios s ON s.id = ss.scenario_id CROSS JOIN attempt_base ab WHERE ss.simulation_id = ab.simulation_id ORDER BY cb.created_at LIMIT 1), true) as objectives_enabled,
                COALESCE((SELECT s.image_enabled FROM simulation_scenarios ss JOIN chats_base cb ON ss.scenario_id = cb.scenario_id JOIN scenarios s ON s.id = ss.scenario_id CROSS JOIN attempt_base ab WHERE ss.simulation_id = ab.simulation_id ORDER BY cb.created_at LIMIT 1), false) as image_input_enabled,
                COALESCE((SELECT ss.copy_paste_allowed FROM simulation_scenarios ss JOIN chats_base cb ON ss.scenario_id = cb.scenario_id CROSS JOIN attempt_base ab WHERE ss.simulation_id = ab.simulation_id ORDER BY cb.created_at LIMIT 1), false) as copy_paste_allowed
        ),
        -- Tree traversal for messages: get all messages following conversation flow
        messages_with_tree AS (
            WITH RECURSIVE message_path AS (
                -- Base case: Start from latest messages (no active children in message_tree)
                SELECT 
                    m.id, 
                    rc.chat_id, 
                    CASE WHEN m.role = 'user' THEN 'query' ELSE 'response' END as type, 
                    m.content, 
                    m.created_at, 
                    m.completed, 
                    m.updated_at,
                    mp_persona.persona_id,
                    0 as depth,
                    m.id as path_root_id
                FROM messages m
                JOIN message_runs mr ON mr.message_id = m.id
                JOIN chat_runs rc ON rc.run_id = mr.run_id
                LEFT JOIN message_personas mp_persona ON mp_persona.message_id = m.id
                CROSS JOIN chat_ids_list cil
                WHERE rc.chat_id = ANY(cil.chat_ids)
                  AND m.role IN ('user', 'assistant')
                  AND NOT EXISTS (
                      SELECT 1 FROM message_tree mt 
                      WHERE mt.parent_id = m.id AND mt.active = true
                  )
                
                UNION ALL
                
                -- Recursive case: Traverse up the tree following parent links
                -- Find parents (m) of children (mp) already in the path
                SELECT 
                    m.id, 
                    rc.chat_id, 
                    CASE WHEN m.role = 'user' THEN 'query' ELSE 'response' END as type, 
                    m.content, 
                    m.created_at, 
                    m.completed, 
                    m.updated_at,
                    mp_persona.persona_id,
                    mp.depth + 1 as depth,
                    mp.path_root_id
                FROM messages m
                JOIN message_tree mt ON mt.parent_id = m.id AND mt.active = true
                JOIN message_path mp ON mp.id = mt.child_id
                JOIN message_runs mr ON mr.message_id = m.id
                JOIN chat_runs rc ON rc.run_id = mr.run_id
                LEFT JOIN message_personas mp_persona ON mp_persona.message_id = m.id
                CROSS JOIN chat_ids_list cil
                WHERE mp.depth < 1000  -- Safety limit
                  AND m.role IN ('user', 'assistant')
                  AND rc.chat_id = mp.chat_id  -- Ensure parent and child are in same chat
                  AND rc.chat_id = ANY(cil.chat_ids)  -- Ensure we stay within the target chats
            ),
            -- Include messages without parents (backward compatibility for existing messages)
            messages_without_parents AS (
                SELECT 
                    m.id, 
                    rc.chat_id, 
                    CASE WHEN m.role = 'user' THEN 'query' ELSE 'response' END as type, 
                    m.content, 
                    m.created_at, 
                    m.completed, 
                    m.updated_at,
                    mp_persona.persona_id,
                    -1 as depth,
                    m.id as path_root_id
                FROM messages m
                JOIN message_runs mr ON mr.message_id = m.id
                JOIN chat_runs rc ON rc.run_id = mr.run_id
                LEFT JOIN message_personas mp_persona ON mp_persona.message_id = m.id
                CROSS JOIN chat_ids_list cil
                WHERE rc.chat_id = ANY(cil.chat_ids)
                  AND m.role IN ('user', 'assistant')
                  AND NOT EXISTS (
                      SELECT 1 FROM message_tree mt 
                      WHERE mt.child_id = m.id AND mt.active = true
                  )
                  AND NOT EXISTS (
                      SELECT 1 FROM message_path mp 
                      WHERE mp.id = m.id
                  )
            ),
            -- Combine tree-traversed messages and messages without parents
            all_messages AS (
                SELECT * FROM message_path
                UNION ALL
                SELECT * FROM messages_without_parents
            )
            -- Select distinct messages ordered by conversation flow
            SELECT DISTINCT ON (id, chat_id)
                id,
                chat_id,
                type,
                content,
                created_at,
                completed,
                updated_at,
                persona_id
            FROM all_messages
            ORDER BY id, chat_id, created_at
        ),
        messages_grouped AS (
            SELECT 
                mwt.chat_id,
                COALESCE(
                    jsonb_agg(
                        jsonb_build_object(
                            'id', mwt.id::text,
                            'createdAt', mwt.created_at,
                            'updatedAt', mwt.updated_at,
                            'chatId', mwt.chat_id::text,
                            'content', mwt.content,
                            'type', mwt.type,
                            'completed', mwt.completed,
                            'personaId', CASE WHEN mwt.persona_id IS NOT NULL THEN mwt.persona_id::text ELSE NULL END
                        ) ORDER BY mwt.created_at
                    ),
                    '[]'::jsonb
                ) as messages
            FROM messages_with_tree mwt
            GROUP BY mwt.chat_id
        ),
        -- Get personas for each chat (from scenario_personas via chat's scenario_id)
        personas_per_chat AS (
            SELECT 
                cb.id as chat_id,
                COALESCE(
                    jsonb_agg(
                        jsonb_build_object(
                            'id', p.id::text,
                            'name', p.name,
                            'icon', p.icon,
                            'color', p.color
                        ) ORDER BY p.name
                    ) FILTER (WHERE p.id IS NOT NULL),
                    '[]'::jsonb
                ) as personas
            FROM chats_base cb
            LEFT JOIN scenario_personas sp ON sp.scenario_id = cb.scenario_id AND sp.active = true
            LEFT JOIN personas p ON p.id = sp.persona_id AND p.active = true
            GROUP BY cb.id
        ),
        hints_data AS (
            SELECT 
                rc.chat_id,
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
                    ) FILTER (WHERE m.role = 'assistant'),
                    '[]'::jsonb
                ) as hints
            FROM messages m
            JOIN message_runs mr ON mr.message_id = m.id
            JOIN chat_runs rc ON rc.run_id = mr.run_id
            CROSS JOIN chat_ids_list cil
            CROSS JOIN attempt_base ab
            WHERE rc.chat_id = ANY(cil.chat_ids)
              AND m.role IN ('user', 'assistant')
              AND ab.sim_practice_simulation = true
            GROUP BY rc.chat_id
        ),
        grades_data AS (
            -- Get latest grade per chat (DISTINCT ON to handle multiple grades)
            SELECT DISTINCT ON (rc.chat_id)
                rc.chat_id as chat_id,
                jsonb_build_object(
                    'id', scg.id::text,
                    'createdAt', scg.created_at,
                    'simulationChatId', rc.chat_id::text,
                    'rubricId', scg.rubric_id::text,
                    'description', scg.description,
                    'passed', scg.passed,
                    'score', scg.score,
                    'timeTaken', scg.time_taken
                ) as grade
            FROM grades scg
            JOIN runs r ON r.id = scg.run_id
            JOIN chat_runs rc ON rc.run_id = r.id
            CROSS JOIN chat_ids_list cil
            WHERE scg.eval = false
              AND rc.chat_id = ANY(cil.chat_ids)
            ORDER BY rc.chat_id, scg.created_at DESC
        ),
        feedbacks_grouped AS (
            SELECT 
                scf.grade_id as grade_id,
                COALESCE(
                    jsonb_agg(
                        jsonb_build_object(
                            'id', scf.id::text,
                            'createdAt', scf.created_at,
                            'standardId', scf.standard_id::text,
                            'simulationChatGradeId', scf.grade_id::text,
                            'total', scf.total,
                            'feedback', scf.feedback
                        )
                    ),
                    '[]'::jsonb
                ) as feedbacks
            FROM feedbacks scf
            WHERE scf.grade_id IN (
                SELECT (grade->>'id')::uuid
                FROM grades_data
            )
            GROUP BY scf.grade_id
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
            CROSS JOIN attempt_base ab
            WHERE ab.sim_rubric_id IS NOT NULL
              AND sg.rubric_id = ab.sim_rubric_id
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
        scenario_documents_data AS (
            SELECT COALESCE(
                jsonb_agg(DISTINCT
                    jsonb_build_object(
                        'document_id', d.id::text,
                        'name', d.name,
                        'type', '',
                        'updatedAt', d.updated_at,
                        'extension', COALESCE(SUBSTRING(u.file_path FROM '\\.([^\\.]+)$'), ''),
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
                        'file_path', u.file_path,
                        'mime_type', u.mime_type,
                        'upload_id', CASE WHEN du.upload_id IS NOT NULL THEN du.upload_id::text ELSE NULL END,
                        'field_ids', COALESCE(
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
            CROSS JOIN scenario_ids_list sil
            WHERE sd.scenario_id = ANY(sil.scenario_ids) AND d.active = true
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
                                 CROSS JOIN attempt_base ab 
                                 WHERE r.id = ab.sim_rubric_id),
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
                                    true  -- Simply mark standards that have feedback as achieved
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
                -- Recursively map child scenario ID to root parent scenario ID for matching with allSimulationScenarios
                COALESCE(
                    (SELECT srm.root_scenario_id 
                     FROM scenario_root_mapping srm 
                     WHERE srm.child_scenario_id = cb.scenario_id),
                    cb.scenario_id
                ) as parent_scenario_id,
                jsonb_build_object(
                    'chat', jsonb_build_object(
                        'id', cb.id::text,
                        'createdAt', cb.created_at,
                        'updatedAt', cb.updated_at,
                        'title', cb.title,
                        'scenarioId', cb.scenario_id::text,
                        'parentScenarioId', COALESCE(
                            (SELECT srm.root_scenario_id::text 
                             FROM scenario_root_mapping srm 
                             WHERE srm.child_scenario_id = cb.scenario_id),
                            cb.scenario_id::text
                        ),
                        'attemptId', cb.attempt_id::text,
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
                    'personas', COALESCE(ppc.personas, '[]'::jsonb),
                    -- Use root parent scenario ID to get previous chats from previous_chats_for_scenarios
                    'previousChats', COALESCE(
                        (SELECT previous_chats 
                         FROM previous_chats_for_scenarios pcf2 
                         WHERE pcf2.scenario_id = COALESCE(
                             (SELECT srm.root_scenario_id 
                              FROM scenario_root_mapping srm 
                              WHERE srm.child_scenario_id = cb.scenario_id),
                             cb.scenario_id
                         )),
                        '[]'::jsonb
                    )
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
            LEFT JOIN personas_per_chat ppc ON ppc.chat_id = cb.id
        ),
        -- Videos with quiz data
        videos_with_all_data AS (
            SELECT 
                vd.video_id,
                vd.position,
                -- Get quiz for this video and attempt
                aqd.quiz_id,
                aqd.quiz_completed,
                aqd.quiz_created_at,
                aqd.quiz_updated_at,
                -- Get quiz responses
                COALESCE(qrg.responses, '[]'::jsonb) as quiz_responses,
                jsonb_build_object(
                    'chat', jsonb_build_object(
                        'id', NULL::text,  -- Videos don't have chat IDs
                        'createdAt', COALESCE(aqd.quiz_created_at, NOW())::text,
                        'updatedAt', COALESCE(aqd.quiz_updated_at, NOW())::text,
                        'title', vd.video_title,
                        'scenarioId', NULL::text,  -- Videos don't have scenarios
                        'parentScenarioId', NULL::text,
                        'attemptId', (SELECT id::text FROM attempt_base),
                        'completed', COALESCE(aqd.quiz_completed, false),
                        'completedAt', CASE 
                            WHEN aqd.quiz_completed THEN aqd.quiz_updated_at::text
                            ELSE NULL 
                        END,
                        'traceId', NULL::text,
                        'documentIds', '[]'::jsonb
                    ),
                    'scenario', NULL::jsonb,  -- Videos don't have scenarios
                    'messages', '[]'::jsonb,  -- Videos don't have messages
                    'hints', '[]'::jsonb,  -- Videos don't have hints
                    'grade', NULL::jsonb,  -- Videos use quiz completion, not grades
                    'feedbacks', '[]'::jsonb,  -- Videos don't have feedbacks
                    'dynamicRubric', NULL::jsonb,  -- Videos don't have rubrics
                    'gradingState', NULL::jsonb,  -- Videos don't have grading state
                    'personas', '[]'::jsonb,  -- Videos don't have personas
                    'previousChats', '[]'::jsonb,  -- Videos don't have previous chats
                    'contentType', 'video'::text,
                    'video', jsonb_build_object(
                        'id', vd.video_id::text,
                        'title', vd.video_title,
                        'lengthSeconds', vd.length_seconds,
                        'uploadId', CASE WHEN vd.upload_id IS NOT NULL THEN vd.upload_id::text ELSE NULL END,
                        'videoDocuments', vd.videoDocuments,
                        'questions', vd.questions,
                        'showImage', vd.show_image
                    ),
                    'quiz', CASE 
                        WHEN aqd.quiz_id IS NOT NULL THEN
                            jsonb_build_object(
                                'id', aqd.quiz_id::text,
                                'completed', aqd.quiz_completed,
                                'responses', COALESCE(qrg.responses, '[]'::jsonb)
                            )
                        ELSE NULL
                    END
                ) as chat_data,
                COALESCE(aqd.quiz_completed, false) as completed,
                COALESCE(aqd.quiz_created_at, NOW()) as created_at,
                NULL::jsonb as grade
            FROM videos_data vd
            LEFT JOIN attempt_quizzes_data aqd ON aqd.video_id = vd.video_id
            LEFT JOIN quiz_responses_grouped qrg ON qrg.quiz_id = aqd.quiz_id
        ),
        -- Unified content: combine chats and videos, ordered by position
        -- For chats, we need to determine their position from simulation_scenarios
        chats_with_positions AS (
            SELECT 
                cwad.chat_id,
                cwad.chat_data,
                cwad.completed,
                cwad.created_at,
                cwad.grade,
                -- Determine position from scenario's position in simulation
                -- Extract parentScenarioId from chat_data
                COALESCE(
                    (SELECT ss.position
                     FROM simulation_scenarios ss
                     CROSS JOIN attempt_base ab
                     WHERE ss.simulation_id = ab.simulation_id 
                       AND ss.scenario_id = (cwad.chat_data->'chat'->>'parentScenarioId')::uuid
                       AND ss.active = true
                     LIMIT 1),
                    -- Fallback: use row number if position not found
                    (SELECT ROW_NUMBER() OVER (ORDER BY cwad.created_at) FROM chats_with_all_data LIMIT 1)
                ) as position,
                'scenario'::text as content_type
            FROM chats_with_all_data cwad
        ),
        -- Add contentType to existing chat data
        chats_with_content_type AS (
            SELECT 
                cwp.chat_id,
                cwp.chat_data || jsonb_build_object('contentType', 'scenario'::text) as chat_data,
                cwp.completed,
                cwp.created_at,
                cwp.grade,
                cwp.position
            FROM chats_with_positions cwp
        ),
        -- Combine chats and videos into unified content list
        unified_content AS (
            SELECT 
                chat_id::text as content_id,
                chat_data,
                completed,
                created_at,
                grade,
                position,
                'scenario'::text as content_type
            FROM chats_with_content_type
            
            UNION ALL
            
            SELECT 
                video_id::text as content_id,
                chat_data,
                completed,
                created_at,
                grade,
                position,
                'video'::text as content_type
            FROM videos_with_all_data
        ),
        aggregated_results_data AS (
            SELECT 
                CASE 
                    WHEN COUNT(*) FILTER (WHERE completed = true AND (grade IS NOT NULL OR content_type = 'video')) > 0 THEN
                        jsonb_build_object(
                            'totalScore', COALESCE(SUM((grade->>'score')::numeric) FILTER (WHERE completed = true AND grade IS NOT NULL), 0)::float,
                            'totalPossiblePoints', COALESCE(
                                (SELECT r.points FROM rubrics r 
                                 CROSS JOIN attempt_base ab 
                                 WHERE r.id = ab.sim_rubric_id) * COUNT(*) FILTER (WHERE completed = true AND grade IS NOT NULL),
                                0
                            )::float,
                            'percentage', CASE 
                                WHEN (SELECT r.points FROM rubrics r 
                                      CROSS JOIN attempt_base ab 
                                      WHERE r.id = ab.sim_rubric_id) > 0 
                                     AND COUNT(*) FILTER (WHERE completed = true AND grade IS NOT NULL) > 0 THEN
                                    ROUND(
                                        (SUM((grade->>'score')::numeric) FILTER (WHERE completed = true AND grade IS NOT NULL)::numeric / 
                                         ((SELECT r.points FROM rubrics r 
                                          CROSS JOIN attempt_base ab 
                                          WHERE r.id = ab.sim_rubric_id) * COUNT(*) FILTER (WHERE completed = true AND grade IS NOT NULL))::numeric) * 100.0,
                                        1
                                    )::float
                                ELSE 0.0
                            END,
                            'passed', BOOL_AND((grade->>'passed')::boolean) FILTER (WHERE completed = true AND grade IS NOT NULL),
                            'chatsCompleted', COUNT(*) FILTER (WHERE completed = true AND (grade IS NOT NULL OR content_type = 'video'))::int,
                            'totalChats', COUNT(*)::int
                        )
                    ELSE NULL
                END as aggregated_results
            FROM unified_content
            CROSS JOIN attempt_base ab
        ),
        elapsed_time_calc AS (
            SELECT 
                COALESCE(
                    SUM(
                        CASE 
                            WHEN uc.completed AND uc.grade IS NOT NULL THEN
                                (uc.grade->>'timeTaken')::integer
                            WHEN uc.completed AND uc.content_type = 'video' THEN
                                -- For videos, use quiz updated_at - created_at if quiz exists and is completed
                                CASE 
                                    WHEN uc.chat_data->'quiz' IS NOT NULL 
                                         AND uc.chat_data->'quiz' != 'null'::jsonb
                                         AND (uc.chat_data->'quiz'->>'completed')::boolean = true THEN
                                        EXTRACT(EPOCH FROM (
                                            (uc.chat_data->'chat'->>'updatedAt')::timestamp - 
                                            (uc.chat_data->'chat'->>'createdAt')::timestamp
                                        ))::integer
                                    ELSE 0
                                END
                            WHEN uc.completed THEN
                                EXTRACT(EPOCH FROM (
                                    (uc.grade->>'createdAt')::timestamp - uc.created_at
                                ))::integer
                            ELSE
                                EXTRACT(EPOCH FROM (NOW() - uc.created_at))::integer
                        END
                    ),
                    0
                ) as total_elapsed
            FROM unified_content uc
        ),
        timer_data AS (
            SELECT 
                jsonb_build_object(
                    'elapsed', etc.total_elapsed,
                    'limit', CASE 
                        WHEN ab.sim_time_limit IS NOT NULL THEN
                            (ab.sim_time_limit * 60)::int
                        ELSE NULL
                    END,
                    'exceeded', CASE 
                        WHEN ab.infinite_mode AND ab.sim_time_limit IS NOT NULL THEN
                            (GREATEST((ab.sim_time_limit * 60) - etc.total_elapsed, 0) <= 0)
                        WHEN ab.sim_time_limit IS NOT NULL THEN
                            ((ab.sim_time_limit * 60) - etc.total_elapsed < 0)
                        ELSE false
                    END,
                    'formatted', CASE 
                        WHEN ab.sim_time_limit IS NOT NULL THEN
                            CASE 
                                WHEN ab.infinite_mode THEN
                                    CONCAT(
                                        FLOOR(GREATEST((ab.sim_time_limit * 60) - etc.total_elapsed, 0) / 3600)::text, 'h ',
                                        FLOOR((GREATEST((ab.sim_time_limit * 60) - etc.total_elapsed, 0) % 3600) / 60)::text, 'm ',
                                        (GREATEST((ab.sim_time_limit * 60) - etc.total_elapsed, 0) % 60)::text, 's'
                                    )
                                ELSE
                                    CONCAT(
                                        FLOOR(GREATEST((ab.sim_time_limit * 60) - etc.total_elapsed, 0) / 3600)::text, 'h ',
                                        FLOOR((GREATEST((ab.sim_time_limit * 60) - etc.total_elapsed, 0) % 3600) / 60)::text, 'm ',
                                        (GREATEST((ab.sim_time_limit * 60) - etc.total_elapsed, 0) % 60)::text, 's'
                                    )
                            END
                        ELSE ''
                    END
                ) as timer
            FROM attempt_base ab
            CROSS JOIN elapsed_time_calc etc
        ),
        simulation_scenario_count AS (
            SELECT 
                COUNT(*)::integer as total_scenarios
            FROM simulation_scenarios ss
            CROSS JOIN attempt_base ab
            WHERE ss.simulation_id = ab.simulation_id AND ss.active = true
        ),
        -- Check if every parent scenario from simulation_scenarios has at least one graded chat
        -- A scenario is considered complete only if it has a chat (linked via attempt_chats) with a grade
        -- Uses simulation_scenarios as the source of truth
        scenarios_with_completed_chats AS (
            SELECT DISTINCT ss.scenario_id as parent_scenario_id
            FROM simulation_scenarios ss
            CROSS JOIN attempt_base ab
            JOIN attempt_chats ac ON ac.attempt_id = ab.id
            JOIN chats sc ON sc.id = ac.chat_id
            JOIN grades scg ON scg.eval = false
            JOIN runs r_scen ON r_scen.id = scg.run_id
            JOIN chat_runs rc_scen ON rc_scen.run_id = r_scen.id AND rc_scen.chat_id = sc.id
            WHERE ss.simulation_id = ab.simulation_id
              AND ss.active = true
              -- Recursively map child scenario to root parent scenario via scenario_tree
              -- If no mapping exists, assume child_id = parent_id (scenario is its own parent)
              AND (
                COALESCE(
                    (SELECT srm.root_scenario_id 
                     FROM scenario_root_mapping srm 
                     WHERE srm.child_scenario_id = sc.scenario_id),
                    sc.scenario_id
                ) = ss.scenario_id
                OR sc.scenario_id = ss.scenario_id
              )
        ),
        -- Count total content items (scenarios + videos)
        total_content_count AS (
            SELECT 
                (SELECT COUNT(*) FROM simulation_scenarios_list) + 
                (SELECT COUNT(*) FROM simulation_videos_list) as total_count
        ),
        metadata_computed AS (
            SELECT 
                COALESCE(
                    (SELECT row_num - 1
                     FROM (
                         SELECT 
                             content_id,
                             completed,
                             ROW_NUMBER() OVER (ORDER BY position, created_at) as row_num
                         FROM unified_content
                     ) ranked
                     WHERE completed = false
                     ORDER BY row_num
                     LIMIT 1),
                    0
                ) as current_chat_index,
                -- For infinite mode, still return total content count
                -- For normal mode, use total content count (scenarios + videos)
                COALESCE((SELECT total_count FROM total_content_count), COUNT(*)::integer) as expected_chat_count,
                COUNT(*) = 1 as is_single_chat_attempt,
                CASE 
                    -- In infinite mode, never last attempt (content cycles)
                    WHEN (SELECT infinite_mode FROM attempt_base) THEN false
                    -- Use total content count when available
                    WHEN (SELECT total_count FROM total_content_count) > 0 THEN
                        COALESCE(
                            (SELECT row_num - 1
                             FROM (
                                 SELECT 
                                     content_id,
                                     completed,
                                     ROW_NUMBER() OVER (ORDER BY position, created_at) as row_num
                                 FROM unified_content
                             ) ranked
                             WHERE completed = false
                             ORDER BY row_num
                             LIMIT 1),
                            0
                        ) = (SELECT total_count FROM total_content_count) - 1
                    -- Fallback to created content count
                    ELSE
                        COALESCE(
                            (SELECT row_num - 1
                             FROM (
                                 SELECT 
                                     content_id,
                                     completed,
                                     ROW_NUMBER() OVER (ORDER BY position, created_at) as row_num
                                 FROM unified_content
                             ) ranked
                             WHERE completed = false
                             ORDER BY row_num
                             LIMIT 1),
                            0
                        ) = COUNT(*) - 1
                END as is_last_attempt,
                COALESCE(BOOL_AND(completed), false) as show_results,
                -- Show controls only if there are positions without completed content (work remaining)
                -- Count completed scenarios and videos
                CASE 
                    WHEN (SELECT COUNT(*) FROM simulation_root_scenarios_list) + (SELECT COUNT(*) FROM simulation_videos_list) = 0 THEN false
                    ELSE COALESCE((
                        SELECT 
                            (SELECT COUNT(DISTINCT srsl.root_scenario_id) FROM simulation_root_scenarios_list srsl
                             LEFT JOIN scenarios_with_completed_chats swcc ON swcc.parent_scenario_id = srsl.root_scenario_id
                             WHERE swcc.parent_scenario_id IS NULL) +
                            (SELECT COUNT(*) FROM simulation_videos_list svl
                             LEFT JOIN videos_with_all_data vwad ON vwad.video_id = svl.video_id
                             WHERE COALESCE(vwad.completed, false) = false)
                        ) > 0, true)
                END as should_show_controls,
                -- Count remaining content (scenarios without completed chats + videos without completed quizzes)
                COALESCE((
                    SELECT 
                        (SELECT COUNT(DISTINCT srsl.root_scenario_id) FROM simulation_root_scenarios_list srsl
                         LEFT JOIN scenarios_with_completed_chats swcc ON swcc.parent_scenario_id = srsl.root_scenario_id
                         WHERE swcc.parent_scenario_id IS NULL) +
                        (SELECT COUNT(*) FROM simulation_videos_list svl
                         LEFT JOIN videos_with_all_data vwad ON vwad.video_id = svl.video_id
                         WHERE COALESCE(vwad.completed, false) = false)
                ), 0)::integer as remaining_scenarios_count,
                -- Check if this is the last remaining content
                COALESCE((
                    SELECT 
                        (SELECT COUNT(DISTINCT srsl.root_scenario_id) FROM simulation_root_scenarios_list srsl
                         LEFT JOIN scenarios_with_completed_chats swcc ON swcc.parent_scenario_id = srsl.root_scenario_id
                         WHERE swcc.parent_scenario_id IS NULL) +
                        (SELECT COUNT(*) FROM simulation_videos_list svl
                         LEFT JOIN videos_with_all_data vwad ON vwad.video_id = svl.video_id
                         WHERE COALESCE(vwad.completed, false) = false)
                ), 0) = 1 as is_last_remaining_scenario,
                -- Can pick multiple alternatives (not allowed for practice simulations)
                NOT (SELECT sim_practice_simulation FROM attempt_base) as can_pick_multiple_alternatives
            FROM unified_content
        ),
        -- Compute available continuation options with order constraint
        -- Generates sequential permutations (1, 1+2, 1+2+3, etc.) - no gaps allowed
        -- Note: This is complex, so we'll generate permutations on the frontend instead
        -- Here we just return the valid scenarios with their previous chats
        available_continuation_options AS (
            WITH current_scenario_position AS (
                -- Find the position of the current chat's scenario (first incomplete chat)
                SELECT COALESCE(
                    (SELECT ss.position
                     FROM simulation_scenarios ss
                     CROSS JOIN attempt_base ab
                     JOIN unified_content uc ON uc.content_type = 'scenario'
                     WHERE ss.simulation_id = ab.simulation_id
                       AND ss.scenario_id = (uc.chat_data->'chat'->>'parentScenarioId')::uuid
                       AND ss.active = true
                       AND uc.completed = false
                     ORDER BY uc.position, uc.created_at
                     LIMIT 1),
                    -- If no incomplete chat found, use position 1 (start from beginning)
                    1
                ) as current_position
            ),
            -- Find ALL scenarios with previous chats (for generating permutations)
            -- Include all scenarios from current position onwards that have previous chats
            -- Frontend will generate sequential permutations (1, 1+2, 1+2+3, etc.)
            valid_next_scenarios AS (
                SELECT 
                    ssl.scenario_id,
                    ssl.position,
                    asswpc.scenario_data->>'name' as scenario_name,
                    asswpc.previous_chats
                FROM simulation_scenarios_list ssl
                CROSS JOIN attempt_base ab
                CROSS JOIN current_scenario_position csp
                JOIN all_simulation_scenarios_with_previous_chats asswpc 
                    ON asswpc.scenario_id = ssl.scenario_id
                WHERE ssl.position >= csp.current_position
                  -- Exclude practice simulations (they can't use previous chats)
                  AND ab.sim_practice_simulation = false
                  -- Must have previous chats available
                  AND jsonb_array_length(COALESCE(asswpc.previous_chats, '[]'::jsonb)) > 0
                ORDER BY ssl.position
            ),
            -- Return scenarios with their previous chat options (no "continue normally")
            scenario_options_expanded AS (
                SELECT 
                    vns.scenario_id,
                    vns.position,
                    vns.scenario_name,
                    (pc->>'chatId')::text as previous_chat_id,
                    COALESCE(pc->>'title', 'Previous attempt') as title,
                    (pc->>'score')::numeric as score,
                    (pc->>'percentage')::numeric as percentage,
                    (pc->>'timeTaken')::numeric as time_taken
                FROM valid_next_scenarios vns
                CROSS JOIN LATERAL jsonb_array_elements(
                    CASE 
                        WHEN vns.previous_chats IS NULL THEN '[]'::jsonb
                        ELSE vns.previous_chats
                    END
                ) pc
            )
            SELECT 
                COALESCE(
                    jsonb_agg(
                        jsonb_build_object(
                            'scenarioId', scenario_id::text,
                            'position', position,
                            'scenarioName', scenario_name,
                            'previousChatId', previous_chat_id,
                            'title', title,
                            'score', score,
                            'percentage', percentage,
                            'timeTaken', time_taken
                        ) ORDER BY position, score DESC NULLS LAST
                    ),
                    '[]'::jsonb
                ) as next_sequential_options,
                CASE WHEN COUNT(*) > 0 THEN true ELSE false END as has_options
            FROM scenario_options_expanded
        )
        SELECT 
            jsonb_build_object(
                'id', ab.id::text,
                'createdAt', ab.created_at,
                'simulationId', ab.simulation_id::text,
                'infiniteMode', ab.infinite_mode,
                'archived', ab.archived,
                'profileId', CASE WHEN cap.profile_id IS NOT NULL THEN cap.profile_id::text ELSE NULL END
            ) as attempt,
            jsonb_build_object(
                'id', ab.sim_id::text,
                'title', ab.sim_title,
                'description', ab.sim_description,
                'departmentId', CASE WHEN ab.sim_department_id IS NOT NULL THEN ab.sim_department_id::text ELSE NULL END,
                'active', ab.sim_active,
                'defaultSimulation', false,
                'practiceSimulation', ab.sim_practice_simulation,
                'hintsEnabled', sf.hints_enabled,
                'objectivesEnabled', sf.objectives_enabled,
                'inputGuardrailActive', false,
                'outputGuardrailActive', false,
                'imageInputActive', sf.image_input_enabled,
                'copyPasteAllowed', sf.copy_paste_allowed,
                'timeLimit', ab.sim_time_limit,
                'rubricId', CASE WHEN ab.sim_rubric_id IS NOT NULL THEN ab.sim_rubric_id::text ELSE NULL END,
                'createdAt', ab.sim_created_at,
                'updatedAt', ab.sim_updated_at
            ) as simulation,
            apd.attempt_profiles as "attemptProfiles",
            COALESCE(
                (SELECT jsonb_agg(chat_data ORDER BY position, created_at) FROM unified_content),
                '[]'::jsonb
            ) as chats,
            sdd.scenario_documents as "scenarioDocuments",
            ard.aggregated_results as "aggregatedResults",
            td.timer,
            md.current_chat_index as "currentChatIndex",
            md.expected_chat_count as "expectedChatCount",
            md.is_single_chat_attempt as "isSingleChatAttempt",
            md.is_last_attempt as "isLastAttempt",
            md.show_results as "showResults",
            md.should_show_controls as "shouldShowControls",
            md.remaining_scenarios_count as "remainingScenariosCount",
            md.is_last_remaining_scenario as "isLastRemainingScenario",
            md.can_pick_multiple_alternatives as "canPickMultipleAlternatives",
            NOT (COALESCE((td.timer->>'expired')::boolean, false) OR md.show_results) as "isActive",
            rsc.rubric_structure as "rubricStructure",
            COALESCE(
                (
                    SELECT jsonb_agg(
                        jsonb_build_object(
                            'id', scenario_data->>'id',
                            'name', scenario_data->>'name',
                            'problemStatement', scenario_data->>'problemStatement',
                            'departmentId', scenario_data->>'departmentId',
                            'active', (scenario_data->>'active')::boolean,
                            'personaId', CASE WHEN scenario_data->>'personaId' != '' THEN scenario_data->>'personaId' ELSE NULL END,
                            'personaName', CASE WHEN scenario_data->>'personaName' != '' THEN scenario_data->>'personaName' ELSE NULL END,
                            'personaIcon', CASE WHEN scenario_data->>'personaIcon' != '' THEN scenario_data->>'personaIcon' ELSE NULL END,
                            'personaColor', CASE WHEN scenario_data->>'personaColor' != '' THEN scenario_data->>'personaColor' ELSE NULL END,
                            'createdAt', scenario_data->>'createdAt',
                            'updatedAt', scenario_data->>'updatedAt',
                            'generated', (scenario_data->>'generated')::boolean,
                            'defaultScenario', (scenario_data->>'defaultScenario')::boolean,
                            'copyPasteAllowed', (scenario_data->>'copyPasteAllowed')::boolean,
                            'objectives', scenario_data->'objectives',
                            'previousChats', previous_chats
                        ) ORDER BY position
                    )
                    FROM all_simulation_scenarios_with_previous_chats
                ),
                '[]'::jsonb
            ) as "allSimulationScenarios",
            COALESCE(
                (
                    SELECT jsonb_build_object(
                        'nextSequentialOptions', aco.next_sequential_options,
                        'hasOptions', aco.has_options
                    )
                    FROM available_continuation_options aco
                ),
                jsonb_build_object(
                    'nextSequentialOptions', '[]'::jsonb,
                    'hasOptions', false
                )
            ) as "availableContinuationOptions"
        FROM attempt_base ab
        CROSS JOIN attempt_profiles_data apd
        CROSS JOIN scenario_documents_data sdd
        CROSS JOIN aggregated_results_data ard
        CROSS JOIN timer_data td
        CROSS JOIN metadata_computed md
        CROSS JOIN simulation_flags sf
        CROSS JOIN current_attempt_profile cap
        LEFT JOIN rubric_structure_complete rsc ON true
        