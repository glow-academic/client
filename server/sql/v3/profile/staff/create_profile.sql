INSERT INTO profiles (
    id, first_name, last_name, alias, role, active, 
    default_profile, viewed_intro, viewed_chat
) VALUES (
    $1, $2, $3, $4, $5, $6,
    $7, $8, $9
)

