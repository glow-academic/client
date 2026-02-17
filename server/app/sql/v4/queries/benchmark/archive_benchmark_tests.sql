WITH inserted AS (
    INSERT INTO benchmark_archives_entry (test_id, archived)
    SELECT unnest($1::uuid[]), $2
    RETURNING id
)
SELECT COUNT(*)::int AS updated_count
FROM inserted;
