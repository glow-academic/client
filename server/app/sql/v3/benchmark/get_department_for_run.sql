SELECT d.id::text as department_id
FROM runs r
JOIN run_profiles rp ON rp.run_id = r.id AND rp.active = true
JOIN profile_departments pd ON pd.profile_id = rp.profile_id AND pd.active = true
JOIN departments d ON d.id = pd.department_id AND d.active = true
WHERE r.id = $1::uuid
LIMIT 1
