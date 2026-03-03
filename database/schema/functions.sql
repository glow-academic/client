-- Prerequisite functions referenced by table column defaults
-- These must be loaded before tables. Most functions are JIT-compiled
-- by bootstrap_all_sql, but these are needed at CREATE TABLE time.
--

CREATE OR REPLACE FUNCTION public.gen_trace_id() RETURNS text
    LANGUAGE plpgsql
    AS $$
BEGIN
    RETURN 'trace_' || REPLACE(gen_random_uuid()::text, '-', '');
END;
$$;
