"""Profile service layer - business logic for profile and emulation operations."""

import re
import uuid
from typing import Any, Dict, List, Optional, Tuple, cast
from uuid import UUID

import asyncpg  # type: ignore
from app.cache import keys
from app.queries.profile_queries import ProfileQueries
from app.schemas.permissions import ProfileRole
from app.schemas.profile import (BreadcrumbItem, CohortItem, CohortsData,
                                 DepartmentItem, ProfileContextRequest,
                                 ProfileContextResponse, ProfileItem,
                                 SimulationContextItem, SimulationsData)
from app.services.base import BaseService, with_cache
from app.services.permissions_service import PermissionsService
from app.utils.csv import parse_csv_file
from app.utils.search import build_fuzzy_conditions, normalize_text, tokenize


class ProfileService(BaseService):
    """Service layer for profile operations."""

    def __init__(self, conn: asyncpg.Connection):
        """Initialize service with database connection."""
        super().__init__(conn)
        self.queries = ProfileQueries()

    @with_cache(lambda self, profile_id: keys.profile_by_id(profile_id))
    async def get_profile(self, profile_id: str) -> Optional[ProfileItem]:
        """Get profile by ID.

        Args:
            profile_id: UUID of the profile

        Returns:
            ProfileItem if found, None otherwise
        """
        query, params = self.queries.get_profile(profile_id)
        result = await self.conn.fetchrow(query, *params)
        if not result:
            return None
        return self._row_to_profile_item(result)

    async def update_profile(
        self, profile_id: str, updates: Dict[str, Any]
    ) -> Optional[ProfileItem]:
        """Update profile fields.

        Args:
            profile_id: UUID of the profile
            updates: Dictionary of fields to update

        Returns:
            Updated ProfileItem if successful, None otherwise
        """
        if not updates:
            # No updates, just return the current profile
            return await self.get_profile(profile_id)

        query, params = self.queries.update_profile(profile_id, updates)
        result = await self.conn.fetchrow(query, *params)

        if not result:
            return None

        profile_item = self._row_to_profile_item(result)
        
        # Invalidate caches
        await self._invalidate_cache([
            keys.tag_profile_by_id(profile_id),
            keys.tag_profile_all(),
            keys.tag_analytics_all(),  # Profile changes may affect analytics
        ])
        
        return profile_item

    async def mark_intro_complete(self, profile_id: str) -> bool:
        """Mark viewedIntro as complete for a profile.

        Args:
            profile_id: UUID of the profile

        Returns:
            True if successful, False otherwise
        """
        result = await self.update_profile(profile_id, {"viewed_intro": True})
        return result is not None

    async def mark_chat_complete(self, profile_id: str) -> bool:
        """Mark viewedChat as complete for a profile.

        Args:
            profile_id: UUID of the profile

        Returns:
            True if successful, False otherwise
        """
        result = await self.update_profile(profile_id, {"viewed_chat": True})
        return result is not None

    async def get_default_guest_profile_id(self) -> Optional[UUID]:
        """Get default guest profile ID.
        
        Returns:
            UUID of default guest profile, or None if not found
        """
        query, params = self.queries.get_default_guest_profile()
        result = await self.conn.fetchrow(query, *params)
        return UUID(result['id']) if result else None

    async def get_simulatable_profiles(
        self, profile_id: str, department_ids: List[str]
    ) -> List[ProfileItem]:
        """Get profiles that the requester can emulate.

        Role hierarchy for emulation:
        - superadmin: can emulate all profiles except self
        - admin: can emulate instructional/ta/guest (not superadmin/admin)
        - instructional: can emulate ta/guest (not superadmin/admin/instructional)
        - ta/guest: cannot emulate anyone

        Args:
            profile_id: UUID of the requester
            department_ids: List of department IDs (for future filtering)

        Returns:
            List of ProfileItem that can be emulated
        """
        # Get requester's role
        role_query, role_params = self.queries.get_profile_role(profile_id)
        role_result = await self.conn.fetchrow(role_query, *role_params)

        if not role_result:
            return []

        requester_role = role_result['role']

        # Get simulatable profiles based on role
        if requester_role == "superadmin":
            query, params = self.queries.get_simulatable_profiles_superadmin(profile_id)
        elif requester_role == "admin":
            query, params = self.queries.get_simulatable_profiles_admin(profile_id)
        elif requester_role == "instructional":
            query, params = self.queries.get_simulatable_profiles_instructional(
                profile_id
            )
        else:
            # ta and guest cannot emulate anyone
            return []

        result = await self.conn.fetch(query, *params)

        return [self._row_to_profile_item(row) for row in result]

    async def authorize_emulation(
        self, requester_profile_id: str, target_profile_id: str, department_ids: List[str]
    ) -> Tuple[bool, Optional[str]]:
        """Check if emulation is authorized.

        Args:
            requester_profile_id: UUID of the requester
            target_profile_id: UUID of the target profile to emulate
            department_ids: List of department IDs (for future filtering)

        Returns:
            Tuple of (allowed, reason)
        """
        # Check if trying to emulate self
        if requester_profile_id == target_profile_id:
            return (True, None)  # Emulating self is always allowed

        # Get simulatable profiles for the requester
        simulatable_profiles = await self.get_simulatable_profiles(
            requester_profile_id, department_ids
        )

        # Check if target is in the list
        target_ids = {p.id for p in simulatable_profiles}

        if target_profile_id in target_ids:
            return (True, None)
        else:
            return (False, "You do not have permission to emulate this profile")

    async def get_profile_context(
        self, request: ProfileContextRequest
    ) -> ProfileContextResponse:
        """Get consolidated profile context (profile, departments, cohorts, breadcrumbs).

        Args:
            request: ProfileContextRequest with effectiveProfileId, pathname

        Returns:
            ProfileContextResponse with all consolidated data
        """
        # Resolve "guest-profile-id" to actual default guest profile
        effective_profile_id = request.effectiveProfileId
        if effective_profile_id == "guest-profile-id":
            guest_id = await self.get_default_guest_profile_id()
            if guest_id:
                effective_profile_id = str(guest_id)
            else:
                raise ValueError("No default guest profile found in database")
        
        # Get profile
        profile = await self.get_profile(effective_profile_id)

        if not profile:
            raise ValueError(f"Profile not found: {effective_profile_id}")

        # Get departments for this profile
        query, params = self.queries.get_profile_departments(effective_profile_id)
        dept_rows = await self.conn.fetch(query, *params)

        departments = [
            DepartmentItem(
                id=str(row['id']),
                title=row['title'],
                description=row['description'],
                active=row['active'],
                createdAt="",  # Not available in this query
                updatedAt=""   # Not available in this query
            )
            for row in dept_rows
        ]

        # Get cohorts for this profile across all departments
        cohorts_data = CohortsData(items=[], memberCounts={})
        simulations_data = SimulationsData(items=[])

        if departments:
            dept_ids = [d.id for d in departments]
            
            # Get cohorts via cohort_profiles junction
            query, params = self.queries.get_profile_cohorts(effective_profile_id)
            cohort_rows = await self.conn.fetch(query, *params)

            cohorts = [
                CohortItem(
                    id=str(row['id']),
                    title=row['title'],
                    description=row['description'],
                    active=row['active'],
                    departmentId=str(row['department_id']),
                    createdAt="",  # Not available in this query
                    updatedAt=""   # Not available in this query
                )
                for row in cohort_rows
            ]
            cohorts_data = CohortsData(items=cohorts, memberCounts={})

            # Get simulations from cohort memberships
            if cohorts:
                cohort_ids = [c.id for c in cohorts]
                query, params = self.queries.get_cohort_simulations(cohort_ids)
                sim_rows = await self.conn.fetch(query, *params)

                simulations = [
                    SimulationContextItem(
                        id=str(row['id']),
                        name=row['title'],
                        description=row['description'],
                        departmentId=str(row['department_id']),
                        timeLimit=row['time_limit'],
                        active=row['active'],
                        defaultSimulation=row['default_simulation'],
                        practiceSimulation=row['practice_simulation']
                    )
                    for row in sim_rows
                ]
                simulations_data = SimulationsData(items=simulations)

        # Parse breadcrumbs from pathname
        breadcrumbs = self._parse_breadcrumbs(request.pathname)

        # Extract IDs from collections
        dept_ids_list = [d.id for d in departments]
        cohort_ids_list = [c.id for c in cohorts_data.items]
        simulation_ids_list = [s.id for s in simulations_data.items]
        
        # Get simulatable profiles
        simulatable_profiles = await self.get_simulatable_profiles(
            effective_profile_id, dept_ids_list
        )
        
        # Use permissions service for available sections and redirect path
        # profile.role is validated in the database, so we can safely cast it
        role = cast(ProfileRole, profile.role)
        available_sections = PermissionsService.get_available_subsections_for_role(role)  # type: ignore
        redirect_path = PermissionsService.get_redirect_path_for_role(role)  # type: ignore

        # Get earliest attempt date for the effective profile
        earliest_attempt_date = None
        query, params = self.queries.get_earliest_attempt_date(effective_profile_id)
        earliest_row = await self.conn.fetchrow(query, *params)
        if earliest_row and earliest_row['earliest']:
            earliest_attempt_date = earliest_row['earliest'].isoformat()

        return ProfileContextResponse(
            actualProfile=profile,
            effectiveProfile=profile,  # Same for now, emulation logic would differ
            departments=departments,
            departmentIds=dept_ids_list,
            cohorts=cohorts_data,
            cohortIds=cohort_ids_list,
            simulations=simulations_data,
            simulationIds=simulation_ids_list,
            breadcrumbs=breadcrumbs,
            simulatableProfiles=simulatable_profiles,
            earliestAttemptDate=earliest_attempt_date,
            availableSections=available_sections,
            redirectPath=redirect_path,
        )

    async def get_profile_by_alias(self, alias: str) -> Optional[ProfileItem]:
        """Get profile by alias.

        Args:
            alias: Profile alias (e.g., 'jdoe')

        Returns:
            ProfileItem if found, None otherwise
        """
        query, params = self.queries.get_profile_by_alias(alias)
        result = await self.conn.fetchrow(query, *params)

        if not result:
            return None

        return self._row_to_profile_item(result)

    async def create_profiles_from_csv(self, file_path: str) -> Dict[str, Any]:
        """
        Process CSV file and create profiles in database.

        Args:
            file_path: Path to the CSV file

        Returns:
            Dictionary with processing results:
            - success: bool - whether processing was successful
            - users_created: int - number of users created
            - users_skipped: int - number of users skipped
            - errors: List[str] - list of errors encountered
            - created_users: List[Dict] - list of created user details
            - skipped_users: List[Dict] - list of skipped user details
        """
        # Step 1: Parse the CSV file
        parse_result = parse_csv_file(file_path)

        if not parse_result["success"]:
            return {
                "success": False,
                "error": parse_result.get("error", "Failed to parse CSV file"),
                "users_created": 0,
                "users_skipped": 0,
                "errors": parse_result.get("errors", []),
            }

        users_data = parse_result["users"]
        errors = parse_result["errors"].copy()
        users_created = []
        users_skipped = []

        # Step 2: Process each user within a transaction
        try:
            async with self.conn.transaction():
                for user in users_data:
                    try:
                        name = user["name"]
                        username = user["username"]
                        row_num = user["row_num"]

                        # Check if user already exists
                        check_query, check_params = self.queries.check_profile_exists_by_alias(username)
                        existing_user = await self.conn.fetchrow(check_query, *check_params)

                        if existing_user:
                            users_skipped.append(
                                {"username": username, "reason": "User already exists"}
                            )
                            continue

                        # Create new user with 'ta' role
                        user_id = str(uuid.uuid4())
                        insert_query, insert_params = self.queries.insert_profile(
                            user_id, name, username, "ta", False
                        )
                        await self.conn.execute(insert_query, *insert_params)

                        users_created.append({"name": name, "username": username})

                    except Exception as e:
                        errors.append(f"Row {row_num}: {str(e)}")
                        continue

            return {
                "success": True,
                "users_created": len(users_created),
                "users_skipped": len(users_skipped),
                "errors": errors,
                "created_users": users_created,
                "skipped_users": users_skipped,
            }

        except Exception as e:
            return {
                "success": False,
                "error": f"Database error: {str(e)}",
                "users_created": 0,
                "users_skipped": 0,
                "errors": errors,
            }

    # Helper methods
    def _row_to_profile_item(self, row: asyncpg.Record) -> ProfileItem:
        """Convert database row to ProfileItem."""
        return ProfileItem(
            id=str(row['id']),
            firstName=row['first_name'],
            lastName=row['last_name'],
            alias=row['alias'],
            role=row['role'],
            active=row['active'],
            viewedIntro=row['viewed_intro'],
            viewedChat=row['viewed_chat'],
            defaultProfile=row['default_profile'],
            reqPerDay=row['req_per_day'],
            lastLogin=row['last_login'].isoformat() if row['last_login'] else "",
            lastActive=row['last_active'].isoformat() if row['last_active'] else "",
            createdAt=row['created_at'].isoformat() if row['created_at'] else "",
            updatedAt=row['updated_at'].isoformat() if row['updated_at'] else "",
            primaryDepartmentId=str(row['primary_department_id']) if row.get('primary_department_id') else None,
        )

    def _parse_breadcrumbs(self, pathname: str) -> List[BreadcrumbItem]:
        """Parse breadcrumbs from pathname.

        Args:
            pathname: URL pathname (e.g., '/cohorts/123/simulations/456')

        Returns:
            List of BreadcrumbItem
        """
        breadcrumbs: List[BreadcrumbItem] = []

        # Always add home
        breadcrumbs.append(BreadcrumbItem(segment="", title="Home", context=None))

        # Parse pathname segments
        segments = [s for s in pathname.split('/') if s]

        if not segments:
            return breadcrumbs

        # Build breadcrumbs from segments
        current_path = ""
        for i, segment in enumerate(segments):
            current_path += f"/{segment}"

            # Skip UUIDs (they're IDs, not labels)
            if self._is_uuid(segment):
                continue

            # Convert segment to label (e.g., 'cohorts' -> 'Cohorts')
            label = segment.replace('-', ' ').title()

            breadcrumbs.append(BreadcrumbItem(segment=segment, title=label, context=None))

        return breadcrumbs

    def _is_uuid(self, value: str) -> bool:
        """Check if string is a UUID."""
        uuid_pattern = re.compile(
            r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$',
            re.IGNORECASE
        )
        return bool(uuid_pattern.match(value))

    # ===== Analytics Methods for MCP Tools =====

    async def get_student_simulation_report(
        self, profile_id: str, recent: int = 50
    ) -> Dict[str, Any]:
        """Get comprehensive student simulation report.
        
        Deep dive: every attempt, chat, grade, feedback for a student.
        
        Args:
            profile_id: UUID string of the student profile
            recent: Limit messages per chat (default: 50)
            
        Returns:
            Dict with structure: {"profile": {...}, "attempts": [...]}
            or {"error": "..."}
        """
        try:
            profile_uuid = uuid.UUID(profile_id)
        except ValueError:
            return {"error": f"Invalid profile_id format: {profile_id}"}

        try:
            # Get profile
            query, params = self.queries.get_student_simulation_report_profile(
                str(profile_uuid)
            )
            profile = await self.conn.fetchrow(query, *params)
            
            if not profile:
                return {"error": f"Profile not found: {profile_id}"}

            profile_data = {
                "id": str(profile["id"]),
                "first_name": profile["first_name"],
                "last_name": profile["last_name"],
                "alias": profile["alias"],
                "role": profile["role"],
                "created_at": profile["created_at"].isoformat() if profile["created_at"] else None,
            }

            # Get all attempts with their chats, grades
            query, params = self.queries.get_student_simulation_report_attempts(
                str(profile_uuid)
            )
            attempts_raw = await self.conn.fetch(query, *params)

            # Group attempts by attempt_id and chat_id
            attempts_dict: Dict[str, Dict[str, Any]] = {}
            
            for row in attempts_raw:
                attempt_id = str(row["attempt_id"])
                chat_id = str(row["chat_id"]) if row["chat_id"] else None
                
                if attempt_id not in attempts_dict:
                    attempts_dict[attempt_id] = {
                        "simulation_id": str(row["simulation_id"]),
                        "title": row["simulation_title"],
                        "chats": {}
                    }
                
                if chat_id and chat_id not in attempts_dict[attempt_id]["chats"]:
                    attempts_dict[attempt_id]["chats"][chat_id] = {
                        "id": chat_id,
                        "title": row["chat_title"],
                        "completed": row["chat_completed"],
                        "completed_at": row["chat_completed_at"].isoformat() if row["chat_completed_at"] else None,
                        "scenario": {
                            "id": str(row["scenario_id"]) if row["scenario_id"] else None,
                            "name": row["scenario_name"],
                            "description": row["scenario_description"],
                        } if row["scenario_id"] else {},
                        "grade": {
                            "score": row["score"],
                            "passed": row["passed"],
                            "time_taken": row["time_taken"],
                            "created_at": row["grade_created_at"].isoformat() if row["grade_created_at"] else None,
                        } if row["grade_id"] else {},
                        "messages": [],
                        "feedback": [],
                        "grade_id": row["grade_id"]
                    }

            # Get messages for all chats
            chat_ids = []
            for attempt in attempts_dict.values():
                chat_ids.extend(attempt["chats"].keys())
            
            if chat_ids:
                # Convert string UUIDs for query
                chat_uuids = [str(uuid.UUID(cid)) for cid in chat_ids]
                query, params = self.queries.get_student_simulation_report_messages(
                    chat_uuids
                )
                messages = await self.conn.fetch(query, *params)
                
                # Group messages by chat_id
                messages_by_chat: Dict[str, List[Dict[str, Any]]] = {}
                for msg in messages:
                    chat_id_str = str(msg["chat_id"])
                    if chat_id_str not in messages_by_chat:
                        messages_by_chat[chat_id_str] = []
                    messages_by_chat[chat_id_str].append({
                        "created_at": msg["created_at"].isoformat() if msg["created_at"] else None,
                        "type": msg["type"],
                        "content": msg["content"],
                        "completed": msg["completed"],
                    })
                
                # Add messages to chats (limit to recent)
                for attempt in attempts_dict.values():
                    for chat_id, chat_data in attempt["chats"].items():
                        if chat_id in messages_by_chat:
                            all_messages = messages_by_chat[chat_id]
                            if len(all_messages) > recent:
                                chat_data["messages"] = all_messages[-recent:]
                            else:
                                chat_data["messages"] = all_messages

            # Get feedback for all grades
            grade_ids = []
            for attempt in attempts_dict.values():
                for chat_data in attempt["chats"].values():
                    if chat_data.get("grade_id"):
                        grade_ids.append(chat_data["grade_id"])
            
            if grade_ids:
                query, params = self.queries.get_student_simulation_report_feedback(
                    grade_ids
                )
                feedback = await self.conn.fetch(query, *params)
                
                # Group feedback by grade_id
                feedback_by_grade: Dict[str, List[Dict[str, Any]]] = {}
                for fb in feedback:
                    grade_id = fb["simulation_chat_grade_id"]
                    if grade_id not in feedback_by_grade:
                        feedback_by_grade[grade_id] = []
                    feedback_by_grade[grade_id].append({
                        "standard": fb["standard_name"],
                        "points": fb["points"],
                        "feedback": fb["feedback"],
                    })
                
                # Add feedback to chats
                for attempt in attempts_dict.values():
                    for chat_data in attempt["chats"].values():
                        if chat_data.get("grade_id") and chat_data["grade_id"] in feedback_by_grade:
                            chat_data["feedback"] = feedback_by_grade[chat_data["grade_id"]]
                        # Remove grade_id from output
                        if "grade_id" in chat_data:
                            del chat_data["grade_id"]

            # Convert to list format
            attempts_data = []
            for attempt_data in attempts_dict.values():
                for chat_data in attempt_data["chats"].values():
                    attempts_data.append({
                        "simulation_id": attempt_data["simulation_id"],
                        "title": attempt_data["title"],
                        "scenario": chat_data["scenario"],
                        "chat": {
                            "id": chat_data["id"],
                            "title": chat_data["title"],
                            "completed": chat_data["completed"],
                            "completed_at": chat_data["completed_at"],
                            "messages": chat_data["messages"],
                            "grade": chat_data["grade"],
                            "feedback": chat_data["feedback"],
                        }
                    })

            return {"profile": profile_data, "attempts": attempts_data}

        except Exception as e:
            return {"error": f"Database error: {str(e)}"}

    async def search_profiles(
        self, query: str, limit: int = 10
    ) -> List[Dict[str, Any]]:
        """
        Fuzzy search profiles by first_name, last_name, and alias.
        Returns scored and sorted results.
        
        Args:
            query: Search query string
            limit: Maximum number of results to return
            
        Returns:
            List of profile dictionaries with scores
        """
        q_norm = normalize_text(query)
        if not q_norm:
            return []

        toks = tokenize(query)

        # Build fuzzy search conditions
        where_clause, params, param_idx = build_fuzzy_conditions(
            ["p.first_name", "p.last_name", "p.alias"], query
        )

        # Build and execute query
        query_template, _ = self.queries.search_profiles_fuzzy(where_clause, limit * 5)
        sql = query_template.replace("{param_count}", str(param_idx))
        params.append(limit * 5)  # Candidate pool

        profiles = await self.conn.fetch(sql, *params)

        # Score and build results
        results = []
        for profile in profiles:
            first = profile["first_name"]
            last = profile["last_name"]
            alias = profile["alias"]
            full_name = " ".join(x for x in (first, last) if x) or alias or "Unknown"

            score = self._score_profile(q_norm, toks, first, last, alias)

            results.append({
                "id": str(profile["id"]),
                "first_name": first,
                "last_name": last,
                "alias": alias,
                "role": profile["role"],
                "full_name": full_name,
                "score": score,
            })

        results.sort(key=lambda r: (-r["score"], r["full_name"]))
        return results[:limit]

    def _score_profile(
        self,
        q_norm: str,
        toks: List[str],
        first: str | None,
        last: str | None,
        alias: str | None,
    ) -> int:
        """
        Score profile relevance. Bigger is better.
        
        Args:
            q_norm: Normalized query string
            toks: Query tokens
            first: First name
            last: Last name
            alias: Alias
            
        Returns:
            Relevance score (higher is better)
        """
        first_n = normalize_text(first or "")
        last_n = normalize_text(last or "")
        alias_n = normalize_text(alias or "")

        full_n = (first_n + " " + last_n).strip()

        score = 0

        # Exact full-name match
        if full_n and full_n == q_norm:
            score += 100

        # Exact single-field matches
        if first_n and first_n == q_norm:
            score += 90
        if last_n and last_n == q_norm:
            score += 90
        if alias_n and alias_n == q_norm:
            score += 90

        # Prefix bumps (full query)
        if first_n.startswith(q_norm):
            score += 60
        if last_n.startswith(q_norm):
            score += 60
        if alias_n.startswith(q_norm):
            score += 40

        # Per-token prefix + contains bumps
        for t in toks:
            if first_n.startswith(t):
                score += 30
            if last_n.startswith(t):
                score += 30
            if alias_n.startswith(t):
                score += 20

            if t in first_n:
                score += 10
            if t in last_n:
                score += 10
            if t in alias_n:
                score += 5

        # Whole-query contains bump
        if q_norm in first_n or q_norm in last_n or q_norm in alias_n:
            score += 5

        return score

    # ===== Overview Methods for MCP Tools =====

    async def get_profile_overview(self, profile_id: str) -> Dict[str, Any]:
        """Get profile overview with all related data in ONE optimized query.
        
        Returns profile details and latest grades. Supports searching by UUID or name.
        
        Args:
            profile_id: UUID string or name pattern (searches first_name, last_name, alias)
            
        Returns:
            Dict with profile overview data or {"error": "..."}
        """
        try:
            query, params = self.queries.get_profile_overview_complete(profile_id, limit=5)
            result = await self.conn.fetchrow(query, *params)
            
            if not result:
                return {"error": f"Profile not found: {profile_id}"}

            profile_data = {
                "id": str(result["id"]),
                "first_name": result["first_name"],
                "last_name": result["last_name"],
                "alias": result["alias"],
                "role": result["role"],
                "last_login": result["last_login"].isoformat() if result["last_login"] else None,
                "viewed_intro": result["viewed_intro"],
                "active": result["active"],
                "created_at": result["created_at"].isoformat() if result["created_at"] else None,
            }

            # Transform latest grades (jsonb array to list of dicts)
            latest_grades = []
            for grade in result["latest_grades"]:
                latest_grades.append({
                    "simulation_title": grade["simulation_title"],
                    "score": float(grade["score"]) if grade["score"] else None,
                    "passed": grade["passed"],
                    "time_taken": grade["time_taken"],
                    "created_at": grade["created_at"] if grade.get("created_at") else None,
                })

            return {
                "profile": profile_data,
                "latest_grades": latest_grades,
            }

        except Exception as e:
            return {"error": f"Database error: {str(e)}"}


def get_profile_service(conn: asyncpg.Connection) -> ProfileService:
    """Get profile service instance."""
    return ProfileService(conn)
