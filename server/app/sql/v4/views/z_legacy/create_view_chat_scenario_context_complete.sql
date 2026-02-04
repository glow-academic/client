-- Legacy compatibility for attempt detail queries.

CREATE OR REPLACE VIEW view_chat_scenario_context_complete AS
SELECT
    c.id AS chat_id,
    c.attempt_id,
    c.created_at AS chat_created_at,
    c.updated_at AS chat_updated_at,
    ae.attempt_type AS chat_type,
    scc.scenarios_id AS scenario_id,
    scc.scenarios_id,
    COALESCE(ssf.value, FALSE) AS scenario_active,
    sd.department_id AS scenario_department_id,
    COALESCE(sn.name, '') AS scenario_name,
    spj.persona_id,
    COALESCE(pn.name, '') AS persona_name,
    COALESCE(pi.value, '') AS persona_icon,
    COALESCE(pc.hex_code, '') AS persona_color,
    COALESCE(mc.chat_completed, FALSE) AS chat_completed,
    COALESCE(mc.copy_paste_allowed, FALSE) AS copy_paste_allowed,
    COALESCE(mc.text_enabled, TRUE) AS text_enabled,
    COALESCE(mc.audio_enabled, FALSE) AS audio_enabled,
    COALESCE(mc.show_problem_statement, TRUE) AS show_problem_statement,
    COALESCE(mc.show_objectives, TRUE) AS show_objectives,
    COALESCE(mc.show_images, FALSE) AS show_images,
    NULL::uuid AS background_image_upload_id,
    COALESCE(mc.document_ids::text[], ARRAY[]::text[]) AS document_ids,
    ARRAY[]::text[] AS objectives,
    COALESCE(ps.problem_statement, '') AS problem_statement,
    COALESCE(sn.name, '') AS chat_title
FROM simulation_chats_entry c
JOIN attempts_entry ae ON ae.id = c.attempt_id
LEFT JOIN simulation_chats_scenarios_connection scc ON scc.chat_id = c.id
LEFT JOIN scenario_names_junction snj ON snj.scenario_id = scc.scenarios_id
LEFT JOIN names_resource sn ON sn.id = snj.name_id
LEFT JOIN scenario_departments_junction sd
       ON sd.scenario_id = scc.scenarios_id
      AND sd.active = TRUE
LEFT JOIN scenario_problem_statements_junction sps
       ON sps.scenario_id = scc.scenarios_id
      AND sps.active = TRUE
LEFT JOIN problem_statements_resource ps ON ps.id = sps.problem_statement_id
LEFT JOIN scenario_personas_junction spj ON spj.scenario_id = scc.scenarios_id
LEFT JOIN persona_names_junction pnj ON pnj.persona_id = spj.persona_id
LEFT JOIN names_resource pn ON pn.id = pnj.name_id
LEFT JOIN persona_icons_junction pij ON pij.persona_id = spj.persona_id
LEFT JOIN icons_resource pi ON pi.id = pij.icon_id
LEFT JOIN persona_colors_junction pcj ON pcj.persona_id = spj.persona_id
LEFT JOIN colors_resource pc ON pc.id = pcj.color_id
LEFT JOIN LATERAL (
    SELECT sfj2.value
    FROM scenario_flags_junction sfj2
    JOIN flags_resource sf2 ON sf2.id = sfj2.flag_id
    WHERE sfj2.scenario_id = scc.scenarios_id
      AND sf2.name = 'scenario_active'
    LIMIT 1
) ssf ON TRUE
LEFT JOIN mv_simulation_chats mc ON mc.chat_id = c.id
WHERE c.active = TRUE;
