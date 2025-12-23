-- Create simulation hints for a message
-- Parameters: $1=message_id (uuid), $2=hint_texts (text[])
-- Returns: hint_ids (jsonb array with simulation_message_id, idx, and hint text)
-- Creates hints with sequential idx values, skipping empty hints
WITH hint_texts_array AS (
    SELECT 
        t.hint_text,
        t.idx
    FROM unnest($2::text[]) WITH ORDINALITY AS t(hint_text, idx)
    WHERE trim(t.hint_text) != ''
),
hints_with_next_idx AS (
    SELECT 
        hta.hint_text,
        hta.idx as original_idx,
        COALESCE(
            (SELECT MAX(sh.idx) FROM simulation_hints sh WHERE sh.simulation_message_id = $1::uuid),
            -1
        ) + ROW_NUMBER() OVER (ORDER BY hta.idx) as next_idx
    FROM hint_texts_array hta
),
inserted_hints AS (
    INSERT INTO simulation_hints (simulation_message_id, idx, hint)
    SELECT 
        $1::uuid,
        hwni.next_idx,
        hwni.hint_text
    FROM hints_with_next_idx hwni
    RETURNING simulation_message_id, idx, hint
)
SELECT 
    jsonb_agg(
        jsonb_build_object(
            'simulation_message_id', simulation_message_id::text,
            'idx', idx,
            'hint', hint
        )
    ) as hint_ids
FROM inserted_hints

