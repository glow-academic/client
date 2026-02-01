-- View: view_chat_scenario_context_complete
-- Layer 2 Context View: Chat with full scenario and persona context.
-- Extends view_chat_base_complete with scenario details.
-- Includes scenario name, problem_statement, persona details, objectives, and scenario flags.
-- Write to _entry tables, read from this _view.

CREATE OR REPLACE VIEW view_chat_scenario_context_complete AS
SELECT
    cb.id AS chat_id,
    cb.created_at AS chat_created_at,
    cb.updated_at AS chat_updated_at,
    cb.title AS chat_title,
    cb.completed AS chat_completed,
    cb.attempt_id,
    cb.chat_type,
    -- Scenario resource and artifact IDs
    cb.scenario_resource_id,
    ssj.scenario_id,
    -- Scenario details
    (SELECT n.name
     FROM scenario_names_junction sn
     JOIN names_resource n ON sn.name_id = n.id
     WHERE sn.scenario_id = ssj.scenario_id
     LIMIT 1) AS scenario_name,
    (SELECT ps.problem_statement
     FROM scenario_problem_statements_junction sps
     JOIN problem_statements_resource ps ON ps.id = sps.problem_statement_id
     WHERE sps.scenario_id = ssj.scenario_id AND sps.active = true
     LIMIT 1) AS problem_statement,
    (SELECT department_id
     FROM scenario_departments_junction sd
     WHERE sd.scenario_id = ssj.scenario_id AND sd.active = true
     ORDER BY sd.created_at
     LIMIT 1) AS scenario_department_id,
    -- Persona details
    cb.persona_resource_id,
    sp.persona_id,
    (SELECT n.name
     FROM persona_names_junction pn
     JOIN names_resource n ON pn.name_id = n.id
     WHERE pn.persona_id = sp.persona_id
     LIMIT 1) AS persona_name,
    (SELECT i.value
     FROM persona_icons_junction pi
     JOIN icons_resource i ON pi.icon_id = i.id
     WHERE pi.persona_id = sp.persona_id
     LIMIT 1) AS persona_icon,
    (SELECT c.hex_code
     FROM persona_colors_junction pc
     JOIN colors_resource c ON pc.color_id = c.id
     WHERE pc.persona_id = sp.persona_id
     LIMIT 1) AS persona_color,
    -- Objectives array
    COALESCE(
        (SELECT ARRAY_AGG(o.objective ORDER BY so.idx)
         FROM scenario_objectives_junction so
         JOIN objectives_resource o ON o.id = so.objective_id
         WHERE so.scenario_id = ssj.scenario_id),
        ARRAY[]::text[]
    ) AS objectives,
    -- Scenario flags
    COALESCE(
        (SELECT sf.value
         FROM scenario_flags_junction sf
         JOIN flags_resource f ON sf.flag_id = f.id
         WHERE sf.scenario_id = ssj.scenario_id
           AND f.name = 'scenario_active'
         LIMIT 1),
        true
    ) AS scenario_active,
    COALESCE(
        (SELECT sf.value
         FROM scenario_flags_junction sf
         JOIN flags_resource f ON sf.flag_id = f.id
         WHERE sf.scenario_id = ssj.scenario_id
           AND f.name = 'objectives_enabled'
         LIMIT 1),
        true
    ) AS objectives_enabled,
    COALESCE(
        (SELECT sf.value
         FROM scenario_flags_junction sf
         JOIN flags_resource f ON sf.flag_id = f.id
         WHERE sf.scenario_id = ssj.scenario_id
           AND f.name = 'images_enabled'
         LIMIT 1),
        false
    ) AS images_enabled,
    COALESCE(
        (SELECT sf.value
         FROM scenario_flags_junction sf
         JOIN flags_resource f ON sf.flag_id = f.id
         WHERE sf.scenario_id = ssj.scenario_id
           AND f.name = 'text_enabled'
         LIMIT 1),
        true
    ) AS text_enabled,
    COALESCE(
        (SELECT sf.value
         FROM scenario_flags_junction sf
         JOIN flags_resource f ON sf.flag_id = f.id
         WHERE sf.scenario_id = ssj.scenario_id
           AND f.name = 'audio_enabled'
         LIMIT 1),
        false
    ) AS audio_enabled,
    COALESCE(
        (SELECT sf.value
         FROM scenario_flags_junction sf
         JOIN flags_resource f ON sf.flag_id = f.id
         WHERE sf.scenario_id = ssj.scenario_id
           AND f.name = 'show_problem_statement'
         LIMIT 1),
        true
    ) AS show_problem_statement,
    COALESCE(
        (SELECT sf.value
         FROM scenario_flags_junction sf
         JOIN flags_resource f ON sf.flag_id = f.id
         WHERE sf.scenario_id = ssj.scenario_id
           AND f.name = 'show_objectives'
         LIMIT 1),
        true
    ) AS show_objectives,
    COALESCE(
        (SELECT sf.value
         FROM scenario_flags_junction sf
         JOIN flags_resource f ON sf.flag_id = f.id
         WHERE sf.scenario_id = ssj.scenario_id
           AND f.name = 'show_images'
         LIMIT 1),
        true
    ) AS show_images,
    COALESCE(
        (SELECT sf.value
         FROM scenario_flags_junction sf
         JOIN flags_resource f ON sf.flag_id = f.id
         WHERE sf.scenario_id = ssj.scenario_id
           AND f.name = 'copy_paste_allowed'
         LIMIT 1),
        false
    ) AS copy_paste_allowed,
    -- Background image (upload_id is denormalized on images_resource)
    (SELECT i.upload_id
     FROM scenario_images_junction si
     JOIN images_resource i ON i.id = si.image_id AND i.active = true
     WHERE si.scenario_id = ssj.scenario_id
       AND si.active = true
       AND i.upload_id IS NOT NULL
     ORDER BY si.created_at ASC
     LIMIT 1) AS background_image_upload_id,
    -- Document IDs for scenario
    COALESCE(
        (SELECT array_agg(DISTINCT sd.document_id::text)
         FROM scenario_documents_junction sd
         WHERE sd.scenario_id = ssj.scenario_id AND sd.active = true),
        ARRAY[]::text[]
    ) AS document_ids
FROM view_chat_base_complete cb
-- Resolve scenario artifact ID
JOIN scenario_scenarios_junction ssj ON ssj.scenarios_id = cb.scenario_resource_id
-- Get persona from scenario (not chat connection)
LEFT JOIN scenario_personas_junction sp ON sp.scenario_id = ssj.scenario_id AND sp.active = true;
