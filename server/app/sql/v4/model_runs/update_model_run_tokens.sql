-- Update token counts for a completed model run and populate run_pricing_usage
-- Parameters: $1=run_id (uuid), $2=input_tokens (integer), $3=output_tokens (integer)
-- Note: Currently assumes all tokens are text tokens. Future enhancements will support
-- separate tracking for text/audio/image tokens, seconds, and image counts.

WITH update_run AS (
    UPDATE runs 
    SET input_tokens = $2, output_tokens = $3
    WHERE id = $1::uuid
    RETURNING id, input_tokens, output_tokens, cached_input_tokens
),
million_text_unit AS (
    SELECT id FROM units 
    WHERE name = 'million_text' AND unit_category = 'tokens' AND active = true 
    LIMIT 1
),
upsert_input_usage AS (
    INSERT INTO run_pricing_usage (run_id, pricing_type, unit_id, count, updated_at)
    SELECT 
        ur.id,
        'input'::pricing_type,
        mtu.id,
        ur.input_tokens,
        now()
    FROM update_run ur
    CROSS JOIN million_text_unit mtu
    WHERE ur.input_tokens > 0 AND mtu.id IS NOT NULL
    ON CONFLICT (run_id, pricing_type, unit_id) 
    DO UPDATE SET 
        count = EXCLUDED.count,
        updated_at = now()
),
upsert_output_usage AS (
    INSERT INTO run_pricing_usage (run_id, pricing_type, unit_id, count, updated_at)
    SELECT 
        ur.id,
        'output'::pricing_type,
        mtu.id,
        ur.output_tokens,
        now()
    FROM update_run ur
    CROSS JOIN million_text_unit mtu
    WHERE ur.output_tokens > 0 AND mtu.id IS NOT NULL
    ON CONFLICT (run_id, pricing_type, unit_id) 
    DO UPDATE SET 
        count = EXCLUDED.count,
        updated_at = now()
),
upsert_cached_usage AS (
    INSERT INTO run_pricing_usage (run_id, pricing_type, unit_id, count, updated_at)
    SELECT 
        ur.id,
        'cached'::pricing_type,
        mtu.id,
        ur.cached_input_tokens,
        now()
    FROM update_run ur
    CROSS JOIN million_text_unit mtu
    WHERE ur.cached_input_tokens > 0 AND mtu.id IS NOT NULL
    ON CONFLICT (run_id, pricing_type, unit_id) 
    DO UPDATE SET 
        count = EXCLUDED.count,
        updated_at = now()
)
SELECT 1

