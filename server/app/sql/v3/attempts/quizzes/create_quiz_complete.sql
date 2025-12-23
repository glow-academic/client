-- Create quiz for attempt + video if doesn't exist
-- Parameters: $1 = attempt_id (uuid), $2 = video_id (uuid)
-- Returns: quiz_id (uuid)

WITH attempt_video_check AS (
    -- Verify attempt and video exist and are linked via simulation
    SELECT 
        sa.id as attempt_id,
        v.id as video_id,
        sa.simulation_id
    FROM simulation_attempts sa
    JOIN simulations s ON s.id = sa.simulation_id
    JOIN simulation_scenarios ss ON ss.simulation_id = s.id AND ss.active = true
    JOIN scenario_videos sv ON sv.scenario_id = ss.scenario_id AND sv.active = true
    JOIN videos v ON v.id = sv.video_id AND v.active = true
    WHERE sa.id = $1::uuid AND v.id = $2::uuid
    LIMIT 1
),
create_quiz AS (
    -- Create quiz if it doesn't exist
    INSERT INTO quizzes (title, video_id, completed, created_at, updated_at)
    SELECT 
        CONCAT('Quiz for video ', v.name),
        avc.video_id,
        false,
        NOW(),
        NOW()
    FROM attempt_video_check avc
    JOIN videos v ON v.id = avc.video_id
    WHERE NOT EXISTS (
        SELECT 1 FROM quizzes q
        JOIN attempt_quizzes aq ON aq.quiz_id = q.id
        WHERE aq.attempt_id = avc.attempt_id AND q.video_id = avc.video_id
    )
    RETURNING id as quiz_id
),
link_quiz_to_attempt AS (
    -- Link quiz to attempt
    INSERT INTO attempt_quizzes (attempt_id, quiz_id, created_at, updated_at)
    SELECT 
        avc.attempt_id,
        cq.quiz_id,
        NOW(),
        NOW()
    FROM attempt_video_check avc
    CROSS JOIN create_quiz cq
    WHERE NOT EXISTS (
        SELECT 1 FROM attempt_quizzes aq
        WHERE aq.attempt_id = avc.attempt_id AND aq.quiz_id = cq.quiz_id
    )
)
SELECT 
    COALESCE(
        (SELECT quiz_id FROM create_quiz),
        (SELECT q.id FROM quizzes q
         JOIN attempt_quizzes aq ON aq.quiz_id = q.id
         WHERE aq.attempt_id = $1::uuid AND q.video_id = $2::uuid
         LIMIT 1)
    ) as quiz_id

