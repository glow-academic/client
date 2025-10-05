-- Analytics Leaderboard Bundle Function
-- Returns all leaderboard metrics by calling individual functions
-- Similar to reports bundle but for leaderboard data

CREATE OR REPLACE FUNCTION analytics_leaderboard_bundle_fn(
  p_start           timestamptz,
  p_end             timestamptz,
  p_cohort_ids      uuid[],
  p_roles           profile_role[],
  p_sim_filters     text[],
  p_profile_id      uuid
) RETURNS jsonb
LANGUAGE sql
STABLE
AS $$
SELECT jsonb_build_object(
  'hasData', EXISTS(SELECT 1 FROM (
    SELECT DISTINCT profile_id AS pid
    FROM analytics a
    WHERE a.chat_created_at >= p_start
      AND a.chat_created_at < p_end
      AND (p_cohort_ids IS NULL OR array_length(p_cohort_ids, 1) IS NULL OR a.cohort_ids && p_cohort_ids)
      AND (p_roles IS NULL OR a.profile_role = ANY (p_roles))
      AND (p_sim_filters IS NULL OR (
            ('general' = ANY (p_sim_filters) AND a.is_general) OR
            ('practice' = ANY (p_sim_filters) AND a.is_practice) OR
            ('archived' = ANY (p_sim_filters) AND a.is_archived)
          ))
      AND (p_profile_id IS NULL OR a.profile_id = p_profile_id)
  ) profiles),
  'data', (
    SELECT jsonb_agg(
      jsonb_build_object(
        'profileId', pid::text,
        'firstName', COALESCE(p.first_name, ''),
        'lastName', COALESCE(p.last_name, ''),
        'totalAttempts', 5, -- Placeholder values for now
        'highestScoreAvg', 100.0,
        'messagesPerSession', 10.0,
        'personaResponseSeconds', 30.0,
        'timeSpentMinutes', 60.0,
        'improvementRatePerDay', 5.0,
        'perfectScoreCount', 2,
        'quickestPassMinutes', 5.0,
        'mostImprovedPercent', 0.0
      )
      ORDER BY pid
    )
    FROM (
      SELECT DISTINCT a.profile_id AS pid
      FROM analytics a
      WHERE a.chat_created_at >= p_start
        AND a.chat_created_at < p_end
        AND (p_cohort_ids IS NULL OR array_length(p_cohort_ids, 1) IS NULL OR a.cohort_ids && p_cohort_ids)
        AND (p_roles IS NULL OR a.profile_role = ANY (p_roles))
        AND (p_sim_filters IS NULL OR (
              ('general' = ANY (p_sim_filters) AND a.is_general) OR
              ('practice' = ANY (p_sim_filters) AND a.is_practice) OR
              ('archived' = ANY (p_sim_filters) AND a.is_archived)
            ))
        AND (p_profile_id IS NULL OR a.profile_id = p_profile_id)
    ) profiles
    LEFT JOIN profiles p ON profiles.pid = p.id
  )
);
$$;
