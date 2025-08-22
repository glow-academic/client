import re
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field
from sqlalchemy import text
from sqlmodel import Session


class AnalyticsFilters(BaseModel):
    startDate: str
    endDate: str
    cohortIds: List[str] = Field(default_factory=list)
    roles: List[str] = Field(default_factory=list)
    simulationFilters: List[str] = Field(default_factory=lambda: ["general"])  # "general" | "practice" | "archived"
    profileId: Optional[str] = None


UUID_RE = re.compile(r"^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$")


def to_pg_array_literal(values: List[str]) -> str:
    if not values:
        return "{}"
    sanitized: List[str] = []
    for v in values:
        # keep as-is but escape quotes; optionally validate UUID-like strings where appropriate
        vv = str(v).replace('"', '\\"')
        sanitized.append(f'"{vv}"')
    return "{" + ",".join(sanitized) + "}"


def fetch_analytics_base(session: Session, filters: AnalyticsFilters) -> Dict[str, Any]:
    cohort_ids_arr = to_pg_array_literal(filters.cohortIds)
    roles_arr = to_pg_array_literal(filters.roles)
    sim_filters_arr = to_pg_array_literal(filters.simulationFilters)

    sql_text = f"""
with base_entities as (
  select p.id as profile_id, s.id as simulation_id
  from profiles p
  cross join simulations s
  where s.active = true and (
    (
      array_length('{cohort_ids_arr}'::uuid[], 1) > 0
      and (
        exists (
          select 1 from cohorts c
          where c.id = any('{cohort_ids_arr}'::uuid[]) and p.id = any(c.profile_ids)
        )
        or exists (
          select 1 from cohorts c
          where c.id = any('{cohort_ids_arr}'::uuid[]) and s.id = any(c.simulation_ids)
        )
      )
    )
    or (
      (array_length('{cohort_ids_arr}'::uuid[], 1) is null or array_length('{cohort_ids_arr}'::uuid[], 1) = 0)
      and (
        array_length('{roles_arr}'::text[], 1) is null or array_length('{roles_arr}'::text[], 1) = 0
        or p.role = any('{roles_arr}'::profile_role[])
      )
    )
  )
),
filtered_attempts as (
  select sa.*
  from simulation_attempts sa
  join simulations s on s.id = sa.simulation_id
  where sa.created_at between CAST(:start_date AS timestamptz) and CAST(:end_date AS timestamptz)
    and (:profile_id is null or sa.profile_id = CAST(:profile_id AS uuid))
    and exists (
      select 1 from base_entities be
      where be.profile_id = sa.profile_id and be.simulation_id = sa.simulation_id
    )
    and (
      ('general' = any('{sim_filters_arr}'::text[]) and s.practice_simulation = false and sa.archived = false)
      or ('practice' = any('{sim_filters_arr}'::text[]) and s.practice_simulation = true and sa.archived = false)
      or ('archived' = any('{sim_filters_arr}'::text[]) and sa.archived = true)
    )
),
message_counts as (
  select chat_id, count(id) as message_count
  from simulation_messages
  group by chat_id
),
filtered_chats as (
  select sc.* from simulation_chats sc
  where sc.attempt_id in (select id from filtered_attempts)
),
filtered_grades as (
  select scg.* from simulation_chat_grades scg
  where scg.simulation_chat_id in (select id from filtered_chats)
),
filtered_feedbacks as (
  select scf.* from simulation_chat_feedbacks scf
  where scf.simulation_chat_grade_id in (select id from filtered_grades)
),
filtered_simulations as (
  select distinct s.* from simulations s
  join filtered_attempts fa on fa.simulation_id = s.id
),
scenario_ids_from_chats as (
  select distinct (t.scen_id_text)::uuid as scen_id
  from (
    select sc.scenario_id::text as scen_id_text
    from filtered_chats sc
    where sc.scenario_id is not null
    union all
    select x.scen_id_text::text as scen_id_text
    from filtered_simulations s
    cross join lateral unnest(s.scenario_ids) as x(scen_id_text)
  ) t
  where t.scen_id_text ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
),
filtered_scenarios as (
  select distinct scen.* from scenarios scen
  where scen.active = true and scen.id in (select scen_id from scenario_ids_from_chats)
),
filtered_messages as (
  select sm.* from simulation_messages sm where sm.chat_id in (select id from filtered_chats)
),
filtered_rubrics as (
  select distinct r.* from rubrics r where r.id in (select distinct rubric_id from filtered_simulations)
),
filtered_standard_groups as (
  select distinct sg.* from standard_groups sg where sg.rubric_id in (select id from filtered_rubrics)
),
filtered_standards as (
  select distinct s.* from standards s where s.standard_group_id in (select id from filtered_standard_groups)
),
filtered_profiles as (
  select distinct p.* from profiles p where p.id in (select distinct profile_id from filtered_attempts)
),
derived_cohorts as (
  select c.* from cohorts c
  where c.active = true and (
    (array_length('{cohort_ids_arr}'::uuid[],1) > 0 and c.id = any('{cohort_ids_arr}'::uuid[]))
    or (array_length('{cohort_ids_arr}'::uuid[],1) = 0)
  )
)
select json_build_object(
  'attempts', (select coalesce(json_agg(fa.*), '[]'::json) from filtered_attempts fa),
  'chats', (select coalesce(json_agg(sc.*), '[]'::json) from filtered_chats sc),
  'grades', (select coalesce(json_agg(scg.*), '[]'::json) from filtered_grades scg),
  'feedbacks', (select coalesce(json_agg(scf.*), '[]'::json) from filtered_feedbacks scf),
  'messages', (select coalesce(json_agg(sm.*), '[]'::json) from filtered_messages sm),
  'simulations', (select coalesce(json_agg(s.*), '[]'::json) from filtered_simulations s),
  'scenarios', (select coalesce(json_agg(scen.*), '[]'::json) from filtered_scenarios scen),
  'profiles', (select coalesce(json_agg(p.*), '[]'::json) from filtered_profiles p),
  'cohorts', (select coalesce(json_agg(c.*), '[]'::json) from derived_cohorts c),
  'rubrics', (select coalesce(json_agg(r.*), '[]'::json) from filtered_rubrics r),
  'standardGroups', (select coalesce(json_agg(sg.*), '[]'::json) from filtered_standard_groups sg),
  'standards', (select coalesce(json_agg(st.*), '[]'::json) from filtered_standards st)
) as payload;
"""

    stmt = text(sql_text).bindparams(
        start_date=filters.startDate,
        end_date=filters.endDate,
        profile_id=filters.profileId,
    )
    result = session.execute(stmt)
    row = result.first()
    
    if not row:
        return {
            "attempts": [],
            "chats": [],
            "grades": [],
            "feedbacks": [],
            "messages": [],
            "simulations": [],
            "scenarios": [],
            "profiles": [],
            "cohorts": [],
            "rubrics": [],
            "standardGroups": [],
            "standards": [],
        }
    # row is a Row with key 'payload'
    payload: Dict[str, Any] = row[0] if isinstance(row, (list, tuple)) else getattr(row, "payload", {})
    if not payload:
        # Some drivers return RowMapping
        try:
            payload = row._mapping.get("payload", {})  # type: ignore[attr-defined]
        except Exception:
            payload = {}
    return payload  # type: ignore[return-value]
