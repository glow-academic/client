-- Materialized View: mv_model_pricing_ppm
-- Pre-computes price-per-million tokens for each model.
-- This eliminates complex CASE/SUM calculations in pricing queries.
-- Uses idempotent drop/recreate pattern - safe to run multiple times.
--
-- Key principle: Pricing rarely changes, so this MV can be refreshed infrequently.
-- Queries join to this MV to get pre-computed PPM values.
-- ============================================================================
-- Step 1: Drop all indexes on mv_model_pricing_ppm materialized view (if it exists)
-- ============================================================================

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT indexname
        FROM pg_indexes
        WHERE schemaname = 'public'
          AND tablename = 'mv_model_pricing_ppm'
    LOOP
        EXECUTE format('DROP INDEX IF EXISTS %I', r.indexname);
    END LOOP;
END $$;

-- ============================================================================
-- Step 2: Drop mv_model_pricing_ppm materialized view if it exists
-- ============================================================================

DROP MATERIALIZED VIEW IF EXISTS mv_model_pricing_ppm CASCADE;

-- ============================================================================
-- Step 3: Create mv_model_pricing_ppm Materialized View
-- ============================================================================

CREATE MATERIALIZED VIEW mv_model_pricing_ppm AS
WITH model_prices AS (
    SELECT
        mpj.model_id,
        pr.pricing_type,
        pr.price,
        au.value AS unit_value,
        -- Calculate price per million tokens
        -- price * (1,000,000 / unit_value) = price per million
        CASE
            WHEN au.value > 0 THEN (pr.price * (1000000.0 / au.value))
            ELSE 0
        END AS price_per_million
    FROM model_pricing_junction mpj
    JOIN pricing_resource pr ON pr.id = mpj.pricing_id AND pr.active = TRUE
    JOIN artifact_units_relation au ON au.id = pr.unit_id AND au.active = TRUE
    WHERE mpj.active = TRUE
)
SELECT
    model_id,
    -- Pivot pricing types into columns
    MAX(price_per_million) FILTER (WHERE pricing_type = 'input')::numeric AS input_ppm,
    MAX(price_per_million) FILTER (WHERE pricing_type = 'output')::numeric AS output_ppm,
    MAX(price_per_million) FILTER (WHERE pricing_type = 'cached')::numeric AS cached_ppm,
    -- Also store raw prices for reference
    MAX(price) FILTER (WHERE pricing_type = 'input')::numeric AS input_price,
    MAX(price) FILTER (WHERE pricing_type = 'output')::numeric AS output_price,
    MAX(price) FILTER (WHERE pricing_type = 'cached')::numeric AS cached_price,
    -- Store unit value for reference
    MAX(unit_value) FILTER (WHERE pricing_type = 'input')::int AS input_unit_value,
    MAX(unit_value) FILTER (WHERE pricing_type = 'output')::int AS output_unit_value,
    MAX(unit_value) FILTER (WHERE pricing_type = 'cached')::int AS cached_unit_value,
    -- Timestamp for tracking when pricing was last computed
    now() AS updated_at
FROM model_prices
GROUP BY model_id
WITH NO DATA;

-- ============================================================================
-- Step 4: Create Unique Index (Required for CONCURRENT refresh)
-- ============================================================================

CREATE UNIQUE INDEX mv_model_pricing_ppm_pk
    ON mv_model_pricing_ppm (model_id);

-- ============================================================================
-- Step 5: Create Filter/Slicing Indexes
-- ============================================================================

-- PPM indexes for cost calculations
CREATE INDEX mv_model_pricing_ppm_input_ppm_idx
    ON mv_model_pricing_ppm (input_ppm)
    WHERE input_ppm IS NOT NULL;

CREATE INDEX mv_model_pricing_ppm_output_ppm_idx
    ON mv_model_pricing_ppm (output_ppm)
    WHERE output_ppm IS NOT NULL;

CREATE INDEX mv_model_pricing_ppm_cached_ppm_idx
    ON mv_model_pricing_ppm (cached_ppm)
    WHERE cached_ppm IS NOT NULL;

-- ============================================================================
-- Step 6: Refresh Materialized View with Data
-- ============================================================================

REFRESH MATERIALIZED VIEW mv_model_pricing_ppm;
