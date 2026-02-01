-- Get recursive persona resource tree from seed resources
-- Returns a single row containing an array of (resource_type, resource_id) nodes
-- 1) Drop function first (breaks dependency on types)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_get_persona_resource_tree_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_persona_resource_tree_v4(%s)', r.sig);
    END LOOP;
END $$;

-- 2) Drop types WITHOUT CASCADE
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT typname
        FROM pg_type
        WHERE typname LIKE 'q_get_persona_resource_tree_v4_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I', r.typname);
    END LOOP;
END $$;

-- 3) Recreate types
CREATE TYPE types.q_get_persona_resource_tree_v4_node AS (
    resource_type public.resource_type,
    resource_id uuid
);

-- 4) Recreate function
CREATE OR REPLACE FUNCTION api_get_persona_resource_tree_v4(
    profile_id uuid,
    seed_nodes types.q_get_persona_resource_tree_v4_node[]
)
RETURNS TABLE (
    resources types.q_get_persona_resource_tree_v4_node[]
)
LANGUAGE plpgsql
VOLATILE
AS $$
DECLARE
    parent_node RECORD;
    rel RECORD;
    child_id uuid;
    frontier_count integer;
BEGIN
    -- Profile_id is accepted for standard signature consistency
    -- Seed nodes define the resource traversal boundary

    CREATE TEMP TABLE tmp_persona_resource_nodes (
        resource_type public.resource_type NOT NULL,
        resource_id uuid NOT NULL,
        PRIMARY KEY (resource_type, resource_id)
    ) ON COMMIT DROP;

    CREATE TEMP TABLE tmp_persona_resource_frontier (
        resource_type public.resource_type NOT NULL,
        resource_id uuid NOT NULL,
        PRIMARY KEY (resource_type, resource_id)
    ) ON COMMIT DROP;

    CREATE TEMP TABLE tmp_persona_resource_next_frontier (
        resource_type public.resource_type NOT NULL,
        resource_id uuid NOT NULL,
        PRIMARY KEY (resource_type, resource_id)
    ) ON COMMIT DROP;

    -- Initialize frontier from seed nodes
    INSERT INTO tmp_persona_resource_frontier (resource_type, resource_id)
    SELECT (n).resource_type, (n).resource_id
    FROM unnest(seed_nodes) AS n
    WHERE (n).resource_type IS NOT NULL
      AND (n).resource_id IS NOT NULL;

    INSERT INTO tmp_persona_resource_nodes
    SELECT resource_type, resource_id
    FROM tmp_persona_resource_frontier
    ON CONFLICT DO NOTHING;

    LOOP
        SELECT COUNT(*) INTO frontier_count FROM tmp_persona_resource_frontier;
        EXIT WHEN frontier_count = 0;

        TRUNCATE tmp_persona_resource_next_frontier;

        FOR parent_node IN
            SELECT resource_type, resource_id
            FROM tmp_persona_resource_frontier
        LOOP
            FOR rel IN
                SELECT
                    rtr.child_resource,
                    parent.relname AS parent_table,
                    parent_col.attname AS fk_col
                FROM resource_resource_relation rtr
                JOIN pg_class parent
                  ON parent.relname = rtr.parent_resource || '_resource'
                JOIN pg_class child
                  ON child.relname = rtr.child_resource || '_resource'
                JOIN pg_constraint c
                  ON c.conrelid = parent.oid
                 AND c.confrelid = child.oid
                 AND c.contype = 'f'
                JOIN pg_attribute parent_col
                  ON parent_col.attrelid = parent.oid
                 AND parent_col.attnum = c.conkey[1]
                WHERE rtr.parent_resource = parent_node.resource_type
                  AND rtr.active = true
            LOOP
                EXECUTE format(
                    'SELECT %I FROM %I WHERE id = $1',
                    rel.fk_col,
                    rel.parent_table
                )
                INTO child_id
                USING parent_node.resource_id;

                IF child_id IS NOT NULL THEN
                    INSERT INTO tmp_persona_resource_next_frontier (resource_type, resource_id)
                    SELECT rel.child_resource, child_id
                    WHERE NOT EXISTS (
                        SELECT 1
                        FROM tmp_persona_resource_nodes
                        WHERE resource_type = rel.child_resource
                          AND resource_id = child_id
                    );
                END IF;
            END LOOP;
        END LOOP;

        INSERT INTO tmp_persona_resource_nodes
        SELECT resource_type, resource_id
        FROM tmp_persona_resource_next_frontier
        ON CONFLICT DO NOTHING;

        TRUNCATE tmp_persona_resource_frontier;
        INSERT INTO tmp_persona_resource_frontier
        SELECT resource_type, resource_id
        FROM tmp_persona_resource_next_frontier;
    END LOOP;

    RETURN QUERY
    SELECT COALESCE(
        ARRAY_AGG(
            ROW(resource_type, resource_id)::types.q_get_persona_resource_tree_v4_node
        ),
        ARRAY[]::types.q_get_persona_resource_tree_v4_node[]
    )
    FROM tmp_persona_resource_nodes;
END $$;
