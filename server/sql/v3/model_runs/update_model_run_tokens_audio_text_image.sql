-- Update token counts for a completed model run and populate run_pricing_usage
-- Parameters: $1=run_id (uuid), $2=input_text_tokens (integer), $3=input_audio_tokens (integer), $4=input_image_tokens (integer), $5=output_text_tokens (integer), $6=output_audio_tokens (integer), $7=cached_text_tokens (integer, nullable), $8=cached_audio_tokens (integer, nullable)
-- Tracks separate audio/text/image tokens for proper pricing calculation

WITH update_run AS (
    UPDATE runs 
    SET 
        input_tokens = COALESCE($2, 0) + COALESCE($3, 0) + COALESCE($4, 0),
        output_tokens = COALESCE($5, 0) + COALESCE($6, 0),
        cached_input_tokens = COALESCE($7, 0) + COALESCE($8, 0)
    WHERE id = $1::uuid
    RETURNING id, input_tokens, output_tokens, cached_input_tokens
),
million_text_unit AS (
    SELECT id FROM units 
    WHERE name = 'million_text' AND unit_category = 'tokens' AND active = true 
    LIMIT 1
),
million_audio_unit AS (
    SELECT id FROM units 
    WHERE name = 'million_audio' AND unit_category = 'tokens' AND active = true 
    LIMIT 1
),
million_image_unit AS (
    SELECT id FROM units 
    WHERE name = 'million_image' AND unit_category = 'tokens' AND active = true 
    LIMIT 1
),
upsert_input_text_usage AS (
    INSERT INTO run_pricing_usage (run_id, pricing_type, unit_id, count, updated_at)
    SELECT 
        ur.id,
        'input'::pricing_type,
        mtu.id,
        $2,
        now()
    FROM update_run ur
    CROSS JOIN million_text_unit mtu
    WHERE $2 > 0 AND mtu.id IS NOT NULL
    ON CONFLICT (run_id, pricing_type, unit_id) 
    DO UPDATE SET 
        count = EXCLUDED.count,
        updated_at = now()
),
upsert_input_audio_usage AS (
    INSERT INTO run_pricing_usage (run_id, pricing_type, unit_id, count, updated_at)
    SELECT 
        ur.id,
        'input'::pricing_type,
        mau.id,
        $3,
        now()
    FROM update_run ur
    CROSS JOIN million_audio_unit mau
    WHERE $3 > 0 AND mau.id IS NOT NULL
    ON CONFLICT (run_id, pricing_type, unit_id) 
    DO UPDATE SET 
        count = EXCLUDED.count,
        updated_at = now()
),
upsert_input_image_usage AS (
    INSERT INTO run_pricing_usage (run_id, pricing_type, unit_id, count, updated_at)
    SELECT 
        ur.id,
        'input'::pricing_type,
        miu.id,
        $4,
        now()
    FROM update_run ur
    CROSS JOIN million_image_unit miu
    WHERE $4 > 0 AND miu.id IS NOT NULL
    ON CONFLICT (run_id, pricing_type, unit_id) 
    DO UPDATE SET 
        count = EXCLUDED.count,
        updated_at = now()
),
upsert_output_text_usage AS (
    INSERT INTO run_pricing_usage (run_id, pricing_type, unit_id, count, updated_at)
    SELECT 
        ur.id,
        'output'::pricing_type,
        mtu.id,
        $5,
        now()
    FROM update_run ur
    CROSS JOIN million_text_unit mtu
    WHERE $5 > 0 AND mtu.id IS NOT NULL
    ON CONFLICT (run_id, pricing_type, unit_id) 
    DO UPDATE SET 
        count = EXCLUDED.count,
        updated_at = now()
),
upsert_output_audio_usage AS (
    INSERT INTO run_pricing_usage (run_id, pricing_type, unit_id, count, updated_at)
    SELECT 
        ur.id,
        'output'::pricing_type,
        mau.id,
        $6,
        now()
    FROM update_run ur
    CROSS JOIN million_audio_unit mau
    WHERE $6 > 0 AND mau.id IS NOT NULL
    ON CONFLICT (run_id, pricing_type, unit_id) 
    DO UPDATE SET 
        count = EXCLUDED.count,
        updated_at = now()
),
upsert_cached_text_usage AS (
    INSERT INTO run_pricing_usage (run_id, pricing_type, unit_id, count, updated_at)
    SELECT 
        ur.id,
        'cached'::pricing_type,
        mtu.id,
        $7,
        now()
    FROM update_run ur
    CROSS JOIN million_text_unit mtu
    WHERE $7 > 0 AND mtu.id IS NOT NULL
    ON CONFLICT (run_id, pricing_type, unit_id) 
    DO UPDATE SET 
        count = EXCLUDED.count,
        updated_at = now()
),
upsert_cached_audio_usage AS (
    INSERT INTO run_pricing_usage (run_id, pricing_type, unit_id, count, updated_at)
    SELECT 
        ur.id,
        'cached'::pricing_type,
        mau.id,
        $8,
        now()
    FROM update_run ur
    CROSS JOIN million_audio_unit mau
    WHERE $8 > 0 AND mau.id IS NOT NULL
    ON CONFLICT (run_id, pricing_type, unit_id) 
    DO UPDATE SET 
        count = EXCLUDED.count,
        updated_at = now()
)
SELECT 1

