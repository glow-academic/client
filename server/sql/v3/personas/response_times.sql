-- Get persona response time analysis
-- Params: $1 = persona_id, $2 = cutoff_date
WITH persona_scenarios AS (
    SELECT 
        s.id,
        s.name
    FROM scenario_personas sp
    JOIN scenarios s ON s.id = sp.scenario_id
    WHERE sp.persona_id = $1 AND sp.active = true
),
scenario_ids_array AS (
    SELECT COALESCE(array_agg(id), ARRAY[]::uuid[]) as ids
    FROM persona_scenarios
),
message_pairs AS (
    SELECT 
        sc.id as chat_id,
        s.name as scenario_name,
        sm1.created_at as query_time,
        sm2.created_at as response_time,
        sm2.created_at - sm1.created_at as response_interval,
        LENGTH(sm1.content) as query_length,
        LENGTH(sm2.content) as response_length,
        ROW_NUMBER() OVER (
            PARTITION BY sc.id 
            ORDER BY sm1.created_at
        ) as pair_num
    FROM simulation_chats sc
    JOIN scenarios s ON s.id = sc.scenario_id
    JOIN simulation_messages sm1 ON sm1.chat_id = sc.id
    JOIN simulation_messages sm2 ON sm2.chat_id = sc.id
    CROSS JOIN scenario_ids_array sia
    WHERE sc.scenario_id = ANY(sia.ids)
      AND sia.ids != ARRAY[]::uuid[]
      AND sc.created_at >= $2
      AND sm1.type = 'query'
      AND sm2.type = 'response'
      AND sm2.created_at > sm1.created_at
      AND NOT EXISTS (
          SELECT 1 FROM simulation_messages sm_between
          WHERE sm_between.chat_id = sc.id
            AND sm_between.created_at > sm1.created_at
            AND sm_between.created_at < sm2.created_at
      )
)
SELECT 
    p.id::text as persona_id,
    p.name as persona_name,
    p.description as persona_description,
    (
        SELECT COALESCE(json_agg(jsonb_build_object(
            'id', ps.id::text,
            'name', ps.name
        )), '[]'::json)
        FROM persona_scenarios ps
    ) as scenarios,
    (
        SELECT COALESCE(json_agg(jsonb_build_object(
            'chat_id', mp.chat_id::text,
            'scenario_name', mp.scenario_name,
            'query_time', mp.query_time,
            'response_time', mp.response_time,
            'response_time_seconds', EXTRACT(EPOCH FROM mp.response_interval),
            'query_length', mp.query_length,
            'response_length', mp.response_length
        )), '[]'::json)
        FROM message_pairs mp
    ) as response_data
FROM personas p
WHERE p.id = $1;

