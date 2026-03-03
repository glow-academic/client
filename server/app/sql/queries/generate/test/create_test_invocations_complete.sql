-- Create test invocations for a benchmark test.
-- Extracted from start_benchmark_attempt to allow separate invocation creation.
-- Returns use_groups flag and invocation list (as chats jsonb).
--
-- Uses sub-entry pattern: each run/group gets its own entry row
-- (test_invocation_runs_entry / test_invocation_groups_entry) with attached config.

-- 1) Drop function first
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'socket_create_test_invocations_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS socket_create_test_invocations_v4(%s)', r.sig);
    END LOOP;
END $$;

-- 2) Create the function
CREATE OR REPLACE FUNCTION socket_create_test_invocations_v4(
    p_test_id uuid,
    p_eval_id uuid
)
RETURNS TABLE (
    use_groups boolean,
    chats jsonb
)
LANGUAGE plpgsql
VOLATILE
AS $$
DECLARE
    v_use_groups boolean;
    v_chats jsonb := '[]'::jsonb;
    v_run RECORD;
    v_group RECORD;
    v_chat_id uuid;
    v_sub_entry_id uuid;
    v_first_group_id uuid;
    v_run_resource_id uuid;
    v_total_runs integer;
BEGIN
    -- Determine if eval uses groups or individual runs
    v_use_groups := EXISTS (
        SELECT 1 FROM eval_groups_junction egj WHERE egj.eval_id = p_eval_id AND egj.active = true
    );

    IF v_use_groups THEN
        -- Create invocation for each group
        FOR v_group IN
            SELECT
                egj.group_id as groups_resource_id
            FROM eval_groups_junction egj
            WHERE egj.eval_id = p_eval_id AND egj.active = true
            ORDER BY egj.created_at
        LOOP
            -- Create invocation
            INSERT INTO test_invocation_entry (test_id, title, generated, mcp, created_at, updated_at)
            VALUES (p_test_id, '', false, false, NOW(), NOW())
            RETURNING id INTO v_chat_id;

            -- Set group_id directly on invocation from groups_entry
            SELECT ggc.group_id INTO v_first_group_id
            FROM groups_groups_connection ggc
            WHERE ggc.groups_id = v_group.groups_resource_id AND ggc.active = true
            LIMIT 1;

            UPDATE test_invocation_entry SET group_id = v_first_group_id WHERE id = v_chat_id;

            -- Create groups sub-entry and link to groups_resource
            INSERT INTO test_invocation_groups_entry (test_invocation_id, active, created_at, updated_at)
            VALUES (v_chat_id, true, NOW(), NOW())
            RETURNING id INTO v_sub_entry_id;

            INSERT INTO test_invocation_groups_groups_connection (test_invocation_groups_id, groups_id, active)
            VALUES (v_sub_entry_id, v_group.groups_resource_id, true);

            IF v_first_group_id IS NOT NULL THEN
                -- Create runs sub-entries for each run in this group
                FOR v_run IN
                    SELECT DISTINCT rrc.runs_id
                    FROM runs_entry re
                    JOIN runs_runs_connection rrc ON rrc.run_id = re.id AND rrc.active = true
                    WHERE re.group_id = v_first_group_id
                    ORDER BY rrc.runs_id
                LOOP
                    INSERT INTO test_invocation_runs_entry (test_invocation_id, active, created_at, updated_at)
                    VALUES (v_chat_id, true, NOW(), NOW())
                    RETURNING id INTO v_sub_entry_id;

                    INSERT INTO test_invocation_runs_runs_connection (test_invocation_runs_id, runs_id, active)
                    VALUES (v_sub_entry_id, v_run.runs_id, true);
                END LOOP;

                -- Count total runs
                SELECT COUNT(DISTINCT rrc.runs_id) INTO v_total_runs
                FROM runs_entry re
                JOIN runs_runs_connection rrc ON rrc.run_id = re.id AND rrc.active = true
                WHERE re.group_id = v_first_group_id;
            ELSE
                v_total_runs := 0;
            END IF;

            -- Add to output array (chat_id key preserved for compatibility)
            v_chats := v_chats || jsonb_build_object(
                'chat_id', v_chat_id,
                'run_resource_id', NULL,
                'group_resource_id', v_group.groups_resource_id,
                'total_runs', COALESCE(v_total_runs, 0)
            );
        END LOOP;
    ELSE
        -- Create invocation for each run
        FOR v_run IN
            SELECT
                erj.run_id as runs_resource_id
            FROM eval_runs_junction erj
            WHERE erj.eval_id = p_eval_id AND erj.active = true
            ORDER BY erj.created_at
        LOOP
            -- Create invocation
            INSERT INTO test_invocation_entry (test_id, title, generated, mcp, created_at, updated_at)
            VALUES (p_test_id, '', false, false, NOW(), NOW())
            RETURNING id INTO v_chat_id;

            -- Create runs sub-entry and link to runs_resource
            INSERT INTO test_invocation_runs_entry (test_invocation_id, active, created_at, updated_at)
            VALUES (v_chat_id, true, NOW(), NOW())
            RETURNING id INTO v_sub_entry_id;

            INSERT INTO test_invocation_runs_runs_connection (test_invocation_runs_id, runs_id, active)
            VALUES (v_sub_entry_id, v_run.runs_resource_id, true);

            -- Set group_id on chat from runs_resource's linked runs_entry
            SELECT re.group_id INTO v_first_group_id
            FROM runs_runs_connection rrc
            JOIN runs_entry re ON re.id = rrc.run_id
            WHERE rrc.runs_id = v_run.runs_resource_id AND rrc.active = true
            LIMIT 1;

            IF v_first_group_id IS NOT NULL THEN
                UPDATE test_invocation_entry SET group_id = v_first_group_id WHERE id = v_chat_id;

                -- Create groups sub-entry if resolvable
                INSERT INTO test_invocation_groups_entry (test_invocation_id, active, created_at, updated_at)
                VALUES (v_chat_id, true, NOW(), NOW())
                RETURNING id INTO v_sub_entry_id;

                INSERT INTO test_invocation_groups_groups_connection (test_invocation_groups_id, groups_id, active)
                SELECT v_sub_entry_id, ggc.groups_id, true
                FROM groups_groups_connection ggc
                WHERE ggc.group_id = v_first_group_id
                  AND ggc.active = true;
            END IF;

            -- Add to chats array
            v_chats := v_chats || jsonb_build_object(
                'chat_id', v_chat_id,
                'run_resource_id', v_run.runs_resource_id,
                'group_resource_id', NULL,
                'total_runs', 1
            );
        END LOOP;
    END IF;

    RETURN QUERY SELECT v_use_groups, v_chats;
END;
$$;
