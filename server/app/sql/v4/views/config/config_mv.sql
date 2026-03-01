-- config_mv has been removed.
-- Runtime config is now stored directly on config_resource (referenced by runs_configs_connection).
-- No materialized view needed — config_resource is a static resource table.

-- Drop the old MV if it exists (cleanup)
DROP MATERIALIZED VIEW IF EXISTS config_mv CASCADE;
