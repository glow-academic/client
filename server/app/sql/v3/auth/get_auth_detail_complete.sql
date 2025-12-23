-- Get auth detail with items (values managed separately in settings)
WITH auth_id_resolved AS (
    SELECT $1::uuid as auth_id
),
user_profile AS (
    SELECT 
        p.role,
        p.first_name || ' ' || p.last_name as actor_name
    FROM profiles p
    WHERE p.id = $2::uuid
),
auth_data AS (
    SELECT 
        a.name,
        a.description,
        a.active,
        CASE 
            WHEN up.role IN ('admin', 'superadmin') THEN true
            ELSE false
        END as can_edit
    FROM auth_id_resolved aid
    JOIN auth a ON a.id = aid.auth_id
    CROSS JOIN user_profile up
),
auth_items_data AS (
    -- Get all auth items (values managed separately in settings page)
    SELECT 
        ai.id::uuid as auth_item_id,
        ai.name::text as name,
        ai.description::text as description,
        ai.position::integer as position,
        ai.active::boolean as active,
        ai.encrypted::boolean as encrypted,
        NULL::text as key_id,
        CASE 
            WHEN ai.encrypted THEN '****'::text
            ELSE ''::text
        END as value_masked
    FROM auth_id_resolved aid
    JOIN auth_items ai ON ai.auth_id = aid.auth_id
    ORDER BY ai.position
)
SELECT 
    ad.name::text as name,
    ad.description::text as description,
    ad.active::boolean as active,
    ad.can_edit::boolean as can_edit,
    aid.auth_item_id::text as "auth_items__auth_item_id",
    aid.name::text as "auth_items__name",
    aid.description::text as "auth_items__description",
    aid.position::integer as "auth_items__position",
    aid.active::boolean as "auth_items__active",
    aid.value_masked::text as "auth_items__value_masked",
    aid.key_id::text as "auth_items__key_id",
    aid.encrypted::boolean as "auth_items__encrypted",
    up.actor_name::text as actor_name
FROM auth_data ad
CROSS JOIN user_profile up
LEFT JOIN auth_items_data aid ON true
WHERE ad.name IS NOT NULL

