-- Link analysis to grade via junction table
-- Parameters: as=analysis_id (uuid), a=analysis_id, as=grade_id (uuid), a=grade_id

-- Drop function if exists (handle signature changes)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'api_link_analysis_to_grade_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_link_analysis_to_grade_v4(%s)', r.sig);
    END LOOP;
END $$;

-- Create function
CREATE OR REPLACE FUNCTION api_link_analysis_to_grade_v4(
    analysis_id uuid,
    grade_id uuid
)
RETURNS TABLE (
    success boolean
)
LANGUAGE sql
VOLATILE
AS $$
    INSERT INTO analysis_grades (analysis_id, grade_id, created_at)
    VALUES (analysis_id, grade_id, NOW())
    ON CONFLICT (analysis_id, grade_id) DO NOTHING
    RETURNING true as success;
$$;

