-- Pricing analytics query - complete model run pricing with all mappings embedded
-- This query uses dynamic WHERE clause building
-- See app/queries/pricing_queries.py for the complete query construction
-- Parameters: department_ids (uuid[]), start_date (datetime), end_date (datetime),
--   cohort_ids (uuid[]), roles (text[]), sim_filters (text[]), profile_id (uuid)

