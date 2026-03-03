-- Prerequisite functions and types referenced by table/view definitions.
-- These must be loaded before tables and views. Most functions are JIT-compiled
-- by bootstrap_all_sql, but these are needed at CREATE TABLE/VIEW time.
--

CREATE OR REPLACE FUNCTION public.gen_trace_id() RETURNS text
    LANGUAGE plpgsql
    AS $$
BEGIN
    RETURN 'trace_' || REPLACE(gen_random_uuid()::text, '-', '');
END;
$$;

-- Composite type used by attempt_chat_mv
CREATE SCHEMA IF NOT EXISTS types;
DROP TYPE IF EXISTS types.persona_ref CASCADE;
CREATE TYPE types.persona_ref AS (
    personas_id uuid,
    personas_entry_id uuid
);
