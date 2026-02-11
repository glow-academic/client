-- Create a test chat for socket tests.
-- Returns chat_id.
-- Uses training_bundle_department_id scope (no legacy simulation_chats_*_connection writes).

DROP FUNCTION IF EXISTS test_create_test_chat_v4(uuid, text);
DROP FUNCTION IF EXISTS test_create_test_chat_v4(uuid, uuid, text, boolean);

CREATE OR REPLACE FUNCTION test_create_test_chat_v4(
    scenario_id uuid,
    attempt_id uuid,
    trace_id text DEFAULT 'test-trace-id',
    is_practice boolean DEFAULT false
)
RETURNS TABLE (
    chat_id uuid
)
LANGUAGE plpgsql
VOLATILE
AS $$
DECLARE
    v_training_id uuid;
    v_training_bundle_id uuid;
    v_training_bundle_department_id uuid;
    v_scenarios_resource_id uuid;
    v_departments_resource_id uuid;
BEGIN
    SELECT a.training_id INTO v_training_id
    FROM simulation_attempts_entry a
    WHERE a.id = test_create_test_chat_v4.attempt_id
    LIMIT 1;

    SELECT ssj.scenarios_id INTO v_scenarios_resource_id
    FROM scenario_scenarios_junction ssj
    WHERE ssj.scenario_id = test_create_test_chat_v4.scenario_id
      AND ssj.active = true
    LIMIT 1;

    SELECT adc.departments_id INTO v_departments_resource_id
    FROM simulation_attempts_departments_connection adc
    WHERE adc.attempt_id = test_create_test_chat_v4.attempt_id
      AND adc.active = true
    LIMIT 1;

    IF v_training_id IS NOT NULL AND v_scenarios_resource_id IS NOT NULL THEN
        INSERT INTO training_bundle_entry (
            training_id,
            scenarios_id,
            created_at,
            updated_at,
            active,
            generated,
            mcp
        )
        VALUES (
            v_training_id,
            v_scenarios_resource_id,
            NOW(),
            NOW(),
            true,
            false,
            false
        )
        ON CONFLICT (training_id, scenarios_id)
        DO UPDATE SET updated_at = NOW(), active = true
        RETURNING id INTO v_training_bundle_id;

        IF v_departments_resource_id IS NOT NULL THEN
            INSERT INTO training_bundle_departments_entry (
                training_bundle_id,
                departments_id,
                config_signature,
                created_at,
                updated_at,
                active,
                generated,
                mcp
            )
            VALUES (
                v_training_bundle_id,
                v_departments_resource_id,
                'runtime-v1',
                NOW(),
                NOW(),
                true,
                false,
                false
            )
            ON CONFLICT (training_bundle_id, departments_id, config_signature)
            DO UPDATE SET updated_at = NOW(), active = true
            RETURNING id INTO v_training_bundle_department_id;

            INSERT INTO training_bundle_departments_scenarios_connection (
                training_bundle_department_id,
                scenarios_id,
                created_at,
                active,
                generated,
                mcp
            )
            VALUES (
                v_training_bundle_department_id,
                v_scenarios_resource_id,
                NOW(),
                true,
                false,
                false
            )
            ON CONFLICT (training_bundle_department_id, scenarios_id) DO NOTHING;
        END IF;
    END IF;

    RETURN QUERY
    INSERT INTO simulation_chats_entry (title, attempt_id, training_bundle_department_id)
    VALUES ('Test Chat', test_create_test_chat_v4.attempt_id, v_training_bundle_department_id)
    RETURNING id;
END;
$$;
