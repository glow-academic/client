-- Patch tool draft - accepts resource IDs and creates/updates draft
-- Creates draft if input_draft_id is NULL, updates if exists
-- Links resources via junction tables

-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'api_patch_tool_draft_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_patch_tool_draft_v4(%s)', r.sig);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION api_patch_tool_draft_v4(
    profile_id uuid,
    input_draft_id uuid DEFAULT NULL,
    schema_ids uuid[] DEFAULT NULL,
    template_ids uuid[] DEFAULT NULL,
    expected_version int DEFAULT 0
)
RETURNS TABLE (
    draft_id uuid,
    new_version int,
    draft_exists boolean
)
LANGUAGE plpgsql
VOLATILE
AS $$
DECLARE
    v_draft_id uuid;
    v_new_version int;
    v_draft_exists boolean := false;
    v_profile_id uuid := profile_id;
    v_group_id uuid;
BEGIN
    -- Validate schema IDs exist (error if missing and provided)
    IF schema_ids IS NOT NULL AND COALESCE(array_length(schema_ids, 1), 0) > 0 THEN
        IF EXISTS (
            SELECT 1 FROM UNNEST(schema_ids) AS schema_id
            WHERE NOT EXISTS (SELECT 1 FROM schemas_resource WHERE id = schema_id)
        ) THEN
            RAISE EXCEPTION 'One or more schema resources not found';
        END IF;
    END IF;
    
    -- Validate template IDs exist (error if missing and provided)
    IF template_ids IS NOT NULL AND COALESCE(array_length(template_ids, 1), 0) > 0 THEN
        IF EXISTS (
            SELECT 1 FROM UNNEST(template_ids) AS template_id
            WHERE NOT EXISTS (SELECT 1 FROM templates_resource WHERE id = template_id)
        ) THEN
            RAISE EXCEPTION 'One or more template resources not found';
        END IF;
    END IF;
    
    -- Try to update existing draft
    IF input_draft_id IS NOT NULL THEN
        -- Get existing draft's group_id
        SELECT group_id INTO v_group_id FROM drafts WHERE id = input_draft_id;
        
        -- Create group if draft doesn't have one (shouldn't happen after migration, but safety check)
        IF v_group_id IS NULL THEN
            INSERT INTO groups (created_at, updated_at)
            VALUES (NOW(), NOW())
            RETURNING id INTO v_group_id;
        END IF;
        
        UPDATE drafts
        SET version = drafts.version + 1,
            updated_at = now(),
            group_id = COALESCE(group_id, v_group_id)
        WHERE id = input_draft_id
          AND drafts.profile_id = v_profile_id
          AND drafts.version = expected_version
        RETURNING id, version INTO v_draft_id, v_new_version;
        
        IF v_draft_id IS NOT NULL THEN
            v_draft_exists := true;
            
            -- Delete old resource links
            DELETE FROM draft_schemas WHERE draft_schemas.draft_id = v_draft_id;
            DELETE FROM draft_templates WHERE draft_templates.draft_id = v_draft_id;
            
            -- Insert new resource links
            IF schema_ids IS NOT NULL AND COALESCE(array_length(schema_ids, 1), 0) > 0 THEN
                INSERT INTO draft_schemas (draft_id, schemas_id, version, generated, mcp)
                SELECT v_draft_id, schema_id, v_new_version, false, false
                FROM UNNEST(schema_ids) as schema_id
                ON CONFLICT ON CONSTRAINT draft_schemas_pkey DO UPDATE
                SET version = v_new_version,
                    updated_at = now();
            END IF;
            
            IF template_ids IS NOT NULL AND COALESCE(array_length(template_ids, 1), 0) > 0 THEN
                INSERT INTO draft_templates (draft_id, templates_id, version, generated, mcp)
                SELECT v_draft_id, template_id, v_new_version, false, false
                FROM UNNEST(template_ids) as template_id
                ON CONFLICT ON CONSTRAINT draft_templates_pkey DO UPDATE
                SET version = v_new_version,
                    updated_at = now();
            END IF;
            
            RETURN QUERY SELECT v_draft_id, v_new_version, v_draft_exists;
            RETURN;
        END IF;
    END IF;
    
    -- Create new draft with group
    -- First create a group for this draft
    INSERT INTO groups (created_at, updated_at)
    VALUES (NOW(), NOW())
    RETURNING id INTO v_group_id;
    
    -- Create new draft with group_id
    INSERT INTO drafts (artifact, profile_id, group_id)
    VALUES ('tool'::artifacts, v_profile_id, v_group_id)
    RETURNING id, version INTO v_draft_id, v_new_version;
    
    -- Link resources to draft
    IF schema_ids IS NOT NULL AND COALESCE(array_length(schema_ids, 1), 0) > 0 THEN
        INSERT INTO draft_schemas (draft_id, schemas_id, version, generated, mcp)
        SELECT v_draft_id, schema_id, v_new_version, false, false
        FROM UNNEST(schema_ids) as schema_id
        ON CONFLICT ON CONSTRAINT draft_schemas_pkey DO UPDATE
        SET version = v_new_version,
            updated_at = now();
    END IF;
    
    IF template_ids IS NOT NULL AND COALESCE(array_length(template_ids, 1), 0) > 0 THEN
        INSERT INTO draft_templates (draft_id, templates_id, version, generated, mcp)
        SELECT v_draft_id, template_id, v_new_version, false, false
        FROM UNNEST(template_ids) as template_id
        ON CONFLICT ON CONSTRAINT draft_templates_pkey DO UPDATE
        SET version = v_new_version,
            updated_at = now();
    END IF;
    
    RETURN QUERY SELECT v_draft_id, v_new_version, false;
END;
$$;
