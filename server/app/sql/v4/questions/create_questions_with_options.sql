-- Create questions and their options, return question IDs
-- Parameters: $1 = questions_json (JSONB) - format: [{"question_text": "...", "type": "choice|frq", "allow_multiple": bool, "options": [{"option_text": "...", "type": "discrete|freeform", "is_correct": bool}]}]
-- Returns: question_id, question_text, type, allow_multiple

WITH questions_data AS (
    -- Parse questions from JSON
    SELECT 
        q->>'question_text' as question_text,
        q->>'type' as question_type,
        COALESCE((q->>'allow_multiple')::boolean, false) as allow_multiple,
        q->'options' as options_json
    FROM jsonb_array_elements($1::jsonb) as q
),
create_questions AS (
    -- Create questions (or get existing if they match exactly)
    INSERT INTO questions (question_text, allow_multiple, active, created_at, updated_at)
    SELECT DISTINCT
        qd.question_text,
        qd.allow_multiple,
        true,
        NOW(),
        NOW()
    FROM questions_data qd
    WHERE qd.question_text IS NOT NULL AND qd.question_text != ''
    ON CONFLICT DO NOTHING
    RETURNING id::uuid as question_id, question_text, allow_multiple
),
get_existing_questions AS (
    -- Get existing questions that match
    SELECT 
        q.id as question_id,
        q.question_text,
        q.allow_multiple
    FROM questions q
    JOIN questions_data qd ON q.question_text = qd.question_text 
        AND q.allow_multiple = qd.allow_multiple
    WHERE q.active = true
),
all_questions AS (
    SELECT * FROM create_questions
    UNION
    SELECT * FROM get_existing_questions
),
options_data AS (
    -- Extract options from questions (only for choice questions)
    SELECT 
        aq.question_id,
        opt->>'option_text' as option_text,
        opt->>'type' as option_type,
        COALESCE((opt->>'is_correct')::boolean, false) as is_correct
    FROM all_questions aq
    JOIN questions_data qd ON aq.question_text = qd.question_text 
        AND aq.allow_multiple = qd.allow_multiple
    CROSS JOIN jsonb_array_elements(qd.options_json) as opt
    WHERE qd.question_type = 'choice' AND qd.options_json IS NOT NULL
),
create_options AS (
    -- Create options (reusable across questions)
    INSERT INTO options (option_text, type, active, created_at, updated_at)
    SELECT DISTINCT
        od.option_text,
        od.option_type::option_type,
        true,
        NOW(),
        NOW()
    FROM options_data od
    WHERE od.option_text IS NOT NULL AND od.option_text != ''
    ON CONFLICT DO NOTHING
    RETURNING id::uuid as option_id, option_text, type
),
get_existing_options AS (
    -- Get existing options that match
    SELECT 
        o.id as option_id,
        o.option_text,
        o.type
    FROM options o
    JOIN options_data od ON o.option_text = od.option_text 
        AND o.type::text = od.option_type
    WHERE o.active = true
),
all_options AS (
    SELECT * FROM create_options
    UNION
    SELECT * FROM get_existing_options
),
link_question_options AS (
    -- Link questions to options via question_options junction table
    INSERT INTO question_options (question_id, option_id, active, created_at, updated_at)
    SELECT DISTINCT
        od.question_id,
        ao.option_id,
        true,
        NOW(),
        NOW()
    FROM options_data od
    JOIN all_options ao ON ao.option_text = od.option_text 
        AND ao.type::text = od.option_type
    ON CONFLICT (question_id, option_id) DO UPDATE SET
        active = true,
        updated_at = NOW()
),
link_question_answers AS (
    -- Link questions to correct options via question_answers junction table
    INSERT INTO question_answers (question_id, option_id, active, created_at, updated_at)
    SELECT DISTINCT
        od.question_id,
        ao.option_id,
        true,
        NOW(),
        NOW()
    FROM options_data od
    JOIN all_options ao ON ao.option_text = od.option_text 
        AND ao.type::text = od.option_type
    WHERE od.is_correct = true
    ON CONFLICT (question_id, option_id) DO UPDATE SET
        active = true,
        updated_at = NOW()
)
SELECT DISTINCT
    aq.question_id,
    aq.question_text,
    aq.allow_multiple
FROM all_questions aq
ORDER BY aq.question_id;

