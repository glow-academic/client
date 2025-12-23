WITH requester_role AS (
    SELECT role
    FROM profiles p
    WHERE p.id = $1::uuid
),
simulatable_data AS (
    SELECT 
        p.id,
        p.first_name,
        p.last_name,
        ARRAY_AGG(pe.email ORDER BY pe.is_primary DESC, pe.created_at) FILTER (WHERE pe.active = true) as emails,
        (SELECT email FROM profile_emails WHERE profile_id = p.id AND is_primary = true AND active = true LIMIT 1) as primary_email,
        p.role,
        p.active,
        COALESCE(prl.requests_per_day, 0) as req_per_day,
        p.last_login,
        pa.last_active,
        p.created_at,
        p.updated_at,
        pd.department_id as primary_department_id
    FROM profiles p
    CROSS JOIN requester_role rr
    LEFT JOIN profile_emails pe ON pe.profile_id = p.id AND pe.active = true
    LEFT JOIN profile_departments pd ON p.id = pd.profile_id AND pd.is_primary = TRUE
    LEFT JOIN profile_request_limits prl ON prl.profile_id = p.id AND prl.active = true
    LEFT JOIN LATERAL (
        SELECT last_active 
        FROM profile_activity 
        WHERE profile_id = p.id 
        ORDER BY created_at DESC 
        LIMIT 1
    ) pa ON true
    WHERE p.id != $1::uuid
      AND CASE 
        WHEN rr.role = 'superadmin' THEN true
        WHEN rr.role = 'admin' THEN p.role IN ('instructional', 'member', 'guest')
        WHEN rr.role = 'instructional' THEN p.role IN ('member', 'guest')
        ELSE false
      END
      {search_where_clause}
    GROUP BY p.id, p.first_name, p.last_name, p.role, p.active, 
             prl.requests_per_day, p.last_login, pa.last_active, 
             p.created_at, p.updated_at, pd.department_id
    ORDER BY p.first_name, p.last_name
    LIMIT $2
)
SELECT 
    jsonb_agg(jsonb_build_object(
        'id', sp.id::text,
        'first_name', sp.first_name,
        'last_name', sp.last_name,
        'emails', sp.emails,
        'primary_email', sp.primary_email,
        'role', sp.role,
        'active', sp.active,
        'req_per_day', sp.req_per_day,
        'last_login', CASE WHEN sp.last_login IS NOT NULL THEN sp.last_login::text ELSE NULL END,
        'last_active', CASE WHEN sp.last_active IS NOT NULL THEN sp.last_active::text ELSE NULL END,
        'created_at', sp.created_at::text,
        'updated_at', sp.updated_at::text,
        'primary_department_id', CASE WHEN sp.primary_department_id IS NOT NULL THEN sp.primary_department_id::text ELSE NULL END
    ) ORDER BY sp.first_name, sp.last_name) as profiles
FROM simulatable_data sp

