WITH updated AS (
    UPDATE benchmark_tests_entry
    SET archived = $2,
        updated_at = now()
    WHERE id = ANY($1::uuid[])
      AND active = true
      AND archived IS DISTINCT FROM $2
    RETURNING id
)
SELECT COUNT(*)::int AS updated_count
FROM updated;
