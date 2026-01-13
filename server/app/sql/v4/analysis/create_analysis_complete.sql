-- Create analysis record
-- Parameters: as=content (text), a=analysis content

-- Drop function if exists (handle signature changes)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'api_create_analysis_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_create_analysis_v4(%s)', r.sig);
    END LOOP;
END $$;

-- Create function
CREATE OR REPLACE FUNCTION api_create_analysis_v4(
    content text
)
RETURNS TABLE (
    id text
)
LANGUAGE sql
VOLATILE
AS $$
    INSERT INTO analyses_resource (content, created_at)
    VALUES (content, NOW())
    RETURNING id::text;
$$;

