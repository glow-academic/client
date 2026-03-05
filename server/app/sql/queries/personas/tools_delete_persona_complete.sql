-- Tools layer: Delete persona with usage check and name fetch
-- Independent copy of delete_persona_complete.sql for tools layer evolution
-- Returns usage_count, name, and deleted (boolean)

-- Drop all versions of the function using DO block to handle signature variations
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'tools_delete_persona_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS tools_delete_persona_v4(%s)', r.sig);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION tools_delete_persona_v4(
    persona_id uuid,
    profile_id uuid,
    soft boolean DEFAULT false
)
RETURNS TABLE (
    usage_count bigint,
    name text,
    deleted boolean
)
LANGUAGE plpgsql
VOLATILE
AS $$
DECLARE
    v_usage_count bigint;
    v_name text;
    v_deleted boolean := false;
BEGIN
    -- Check usage
    SELECT COUNT(*)::bigint INTO v_usage_count
    FROM scenario_personas_junction sp
    WHERE sp.persona_id = tools_delete_persona_v4.persona_id AND sp.active = true;

    -- Get persona name
    SELECT n.name INTO v_name
    FROM persona_names_junction pn
    JOIN names_resource n ON pn.names_id = n.id
    WHERE pn.persona_id = tools_delete_persona_v4.persona_id
    LIMIT 1;

    -- Guard: only proceed if persona exists and has no usage
    IF v_name IS NOT NULL AND v_usage_count = 0 THEN
        IF soft THEN
            -- Soft delete: deactivate
            UPDATE persona_artifact SET active = false
            WHERE id = tools_delete_persona_v4.persona_id;
            v_deleted := true;
        ELSE
            -- Hard delete
            DELETE FROM persona_artifact
            WHERE id = tools_delete_persona_v4.persona_id;
            v_deleted := true;
        END IF;
    END IF;

    RETURN QUERY SELECT v_usage_count, v_name, v_deleted;
END;
$$;
