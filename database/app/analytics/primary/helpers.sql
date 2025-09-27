-- Helper functions for analytics calculations
-- These provide statistical functions needed for correlation analysis

-- Helper: fast normal CDF approximation (sufficient for p-values)
CREATE OR REPLACE FUNCTION analytics_normal_cdf(x double precision)
RETURNS double precision
LANGUAGE sql IMMUTABLE AS $$
  SELECT 0.5 * (1.0 + SIGN($1) * SQRT(1.0 - EXP(-2.0 * $1 * $1 / (PI()))));
$$;

-- Helper: two-tailed p-value from r and n
CREATE OR REPLACE FUNCTION analytics_p_value_from_r_n(r double precision, n int)
RETURNS double precision
LANGUAGE sql IMMUTABLE AS $$
  WITH z AS (
    SELECT CASE
             WHEN $2 <= 3 OR $1 IS NULL OR ABS($1) >= 0.999999 THEN NULL
             ELSE 0.5 * LN((1+$1)/(1-$1)) * SQRT(GREATEST($2-3,1))
           END AS zscore
  )
  SELECT CASE
           WHEN zscore IS NULL THEN NULL
           ELSE 2.0 * (1.0 - analytics_normal_cdf(ABS(zscore)))
         END
  FROM z;
$$;
