-- Duplicate video with all questions, options, times, and department links
-- Parameters: $1=videoId
WITH source_video AS (
    SELECT 
        v.id as source_id,
        v.name,
        v.description,
        v.length_seconds,
        v.active
    FROM videos v
    WHERE v.id = $1::uuid
),
new_video AS (
    INSERT INTO videos (
        name,
        description,
        length_seconds,
        active,
        created_at,
        updated_at
    )
    SELECT 
        sv.name || ' Copy',
        sv.description,
        sv.length_seconds,
        false,  -- Duplicated videos start inactive
        NOW(),
        NOW()
    FROM source_video sv
    RETURNING id::uuid as video_id
),
insert_tree_edge AS (
    INSERT INTO video_tree (parent_id, child_id, active, created_at, updated_at)
    SELECT nv.video_id, nv.video_id, true, NOW(), NOW()
    FROM new_video nv
),
copy_departments AS (
    INSERT INTO video_departments (video_id, department_id, active, created_at, updated_at)
    SELECT 
        nv.video_id,
        vd.department_id,
        vd.active,
        NOW(),
        NOW()
    FROM source_video sv
    JOIN video_departments vd ON vd.video_id = sv.source_id AND vd.active = true
    CROSS JOIN new_video nv
),
copy_questions AS (
    -- Copy questions (reuse existing questions - they're standalone)
    INSERT INTO video_questions (video_id, question_id, active, created_at, updated_at)
    SELECT 
        nv.video_id,
        vq.question_id,
        vq.active,
        NOW(),
        NOW()
    FROM source_video sv
    JOIN video_questions vq ON vq.video_id = sv.source_id AND vq.active = true
    CROSS JOIN new_video nv
),
copy_question_times AS (
    -- Copy question times
    INSERT INTO question_times (video_id, question_id, time, active, created_at, updated_at)
    SELECT 
        nv.video_id,
        qt.question_id,
        qt.time,
        qt.active,
        NOW(),
        NOW()
    FROM source_video sv
    JOIN question_times qt ON qt.video_id = sv.source_id AND qt.active = true
    CROSS JOIN new_video nv
)
SELECT video_id::text as video_id FROM new_video

