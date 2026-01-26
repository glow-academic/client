-- Create calls_entry row for tool execution
DROP FUNCTION IF EXISTS infra_create_call_for_tool_v4(text, uuid, uuid, text);

CREATE OR REPLACE FUNCTION infra_create_call_for_tool_v4(
    external_call_id text,
    run_id uuid,
    template_id uuid,
    arguments_raw text
)
RETURNS TABLE (
    call_id uuid
)
LANGUAGE sql
VOLATILE
AS $$
    INSERT INTO calls_entry (
        external_call_id,
        run_id,
        template_id,
        arguments_raw,
        completed,
        created_at,
        updated_at
    )
    VALUES (
        external_call_id,
        run_id,
        template_id,
        arguments_raw,
        true,
        NOW(),
        NOW()
    )
    RETURNING id as call_id;
$$;
