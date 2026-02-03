-- Create entry record via api_create_entry_record_v4
SELECT * FROM api_create_entry_record_v4(
    $1::text,
    $2::uuid,
    $3::boolean,
    $4::jsonb
);
