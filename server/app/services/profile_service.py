"""Profile service layer - business logic for profile and emulation operations."""

import json
import re
import uuid
from typing import Any, cast
from uuid import UUID

import asyncpg  # type: ignore
from app.cache import keys
from app.queries.profile_queries import ProfileQueries
from app.schemas.permissions import ProfileRole
from app.schemas.profile import (BreadcrumbItem, CohortItem, CohortsData,
                                 DepartmentItem, ProfileContextRequest,
                                 ProfileContextResponse, ProfileItem,
                                 SimulationContextItem, SimulationsData)
from app.services.base_service import BaseService, with_cache
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
    async def get_profile(self, profile_id: str) -> ProfileItem | None:
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
        self, profile_id: str, updates: dict[str, Any]
    ) -> ProfileItem | None:
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
        await self._invalidate_cache(
            [
                keys.tag_profile_by_id(profile_id),
                keys.tag_profile_all(),
                keys.tag_analytics_all(),  # Profile changes may affect analytics
            ]
        )

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

    async def get_default_guest_profile_id(self) -> UUID | None:
        """Get default guest profile ID.

        Returns:
            UUID of default guest profile, or None if not found
        """
        query, params = self.queries.get_default_guest_profile()
        result = await self.conn.fetchrow(query, *params)
        if not result:
            return None
        # asyncpg returns UUID objects directly, convert to string then to UUID
        return UUID(str(result["id"]))

    async def get_simulatable_profiles(
        self, profile_id: str, department_ids: list[str]
    ) -> list[ProfileItem]:
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
        # Get simulatable profiles in ONE optimized query (includes role check)
        query, params = self.queries.get_simulatable_profiles_combined(profile_id)
        result = await self.conn.fetch(query, *params)

        return [self._row_to_profile_item(row) for row in result]

    async def authorize_emulation(
        self,
        requester_profile_id: str,
        target_profile_id: str,
        department_ids: list[str],
    ) -> tuple[bool, str | None]:
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

        # Get all context data in ONE optimized query (includes role lookup internally)
        query, params = self.queries.get_profile_context_complete(effective_profile_id)
        result = await self.conn.fetchrow(query, *params)

        if not result:
            raise ValueError(f"Profile context not found: {effective_profile_id}")

        # Parse profile from result
        profile = ProfileItem(
            id=str(result["id"]),
            firstName=result["first_name"],
            lastName=result["last_name"],
            alias=result["alias"],
            role=result["role"],
            active=result["active"],
            viewedIntro=result["viewed_intro"],
            viewedChat=result["viewed_chat"],
            defaultProfile=result["default_profile"],
            reqPerDay=result["req_per_day"],
            lastLogin=result["last_login"].isoformat() if result["last_login"] else "",
            lastActive=result["last_active"].isoformat()
            if result["last_active"]
            else "",
            createdAt=result["created_at"].isoformat() if result["created_at"] else "",
            updatedAt=result["updated_at"].isoformat() if result["updated_at"] else "",
            primaryDepartmentId=str(result["primary_department_id"])
            if result.get("primary_department_id")
            else None,
        )

        # Parse departments from JSONB (may be string or list)
        departments = []
        departments_data = result["departments"]
        if isinstance(departments_data, str):
            departments_data = json.loads(departments_data)
        if departments_data and isinstance(departments_data, list):
            for dept in departments_data:
                if isinstance(dept, dict):
                    departments.append(
                        DepartmentItem(
                            id=dept["id"],
                            title=dept["title"],
                            description=dept["description"],
                            active=dept["active"],
                            createdAt="",
                            updatedAt="",
                        )
                    )

        # Parse cohorts from JSONB (may be string or list)
        cohorts = []
        cohorts_data = result["cohorts"]
        if isinstance(cohorts_data, str):
            cohorts_data = json.loads(cohorts_data)
        if cohorts_data and isinstance(cohorts_data, list):
            for cohort in cohorts_data:
                if isinstance(cohort, dict):
                    cohorts.append(
                        CohortItem(
                            id=cohort["id"],
                            title=cohort["title"],
                            description=cohort["description"],
                            active=cohort["active"],
                            departmentId=cohort["department_id"],
                            createdAt="",
                            updatedAt="",
                        )
                    )

        # Parse simulations from JSONB (may be string or list)
        simulations = []
        simulations_data = result["simulations"]
        if isinstance(simulations_data, str):
            simulations_data = json.loads(simulations_data)
        if simulations_data and isinstance(simulations_data, list):
            for sim in simulations_data:
                if isinstance(sim, dict):
                    simulations.append(
                        SimulationContextItem(
                            id=sim["id"],
                            name=sim["title"],
                            description=sim["description"],
                            departmentId=sim["department_id"],
                            timeLimit=sim["time_limit"],
                            active=sim["active"],
                            defaultSimulation=sim["default_simulation"],
                            practiceSimulation=sim["practice_simulation"],
                        )
                    )

        # Parse simulatable profiles from JSONB (may be string or list)
        simulatable_profiles = []
        simulatable_profiles_data = result["simulatable_profiles"]
        if isinstance(simulatable_profiles_data, str):
            simulatable_profiles_data = json.loads(simulatable_profiles_data)
        if simulatable_profiles_data and isinstance(simulatable_profiles_data, list):
            for sp in simulatable_profiles_data:
                if isinstance(sp, dict):
                    # Helper to convert datetime to ISO string if needed
                    def to_iso_string(val: Any) -> str:
                        if val is None:
                            return ""
                        if isinstance(val, str):
                            return val  # Already a string (from JSONB)
                        return val.isoformat()  # type: ignore

                    simulatable_profiles.append(
                        ProfileItem(
                            id=sp["id"],
                            firstName=sp["first_name"],
                            lastName=sp["last_name"],
                            alias=sp["alias"],
                            role=sp["role"],
                            active=sp["active"],
                            viewedIntro=sp["viewed_intro"],
                            viewedChat=sp["viewed_chat"],
                            defaultProfile=sp["default_profile"],
                            reqPerDay=sp["req_per_day"],
                            lastLogin=to_iso_string(sp.get("last_login")),
                            lastActive=to_iso_string(sp.get("last_active")),
                            createdAt=to_iso_string(sp.get("created_at")),
                            updatedAt=to_iso_string(sp.get("updated_at")),
                            primaryDepartmentId=sp["primary_department_id"]
                            if sp.get("primary_department_id")
                            else None,
                        )
                    )

        # Parse earliest attempt date
        earliest_attempt_date = None
        if result["earliest_attempt_date"]:
            earliest_attempt_date = result["earliest_attempt_date"].isoformat()

        # Parse breadcrumbs from pathname
        breadcrumbs = self._parse_breadcrumbs(request.pathname)

        # Extract IDs from collections
        dept_ids_list = [d.id for d in departments]
        cohort_ids_list = [c.id for c in cohorts]
        simulation_ids_list = [s.id for s in simulations]

        # Use permissions service for available sections and redirect path
        role = cast(ProfileRole, profile.role)
        available_sections = PermissionsService.get_available_subsections_for_role(role)  # type: ignore
        redirect_path = PermissionsService.get_redirect_path_for_role(role)  # type: ignore

        return ProfileContextResponse(
            actualProfile=profile,
            effectiveProfile=profile,
            departments=departments,
            departmentIds=dept_ids_list,
            cohorts=CohortsData(items=cohorts, memberCounts={}),
            cohortIds=cohort_ids_list,
            simulations=SimulationsData(items=simulations),
            simulationIds=simulation_ids_list,
            breadcrumbs=breadcrumbs,
            simulatableProfiles=simulatable_profiles,
            earliestAttemptDate=earliest_attempt_date,
            availableSections=available_sections,
            redirectPath=redirect_path,
        )

    async def get_profile_by_alias(self, alias: str) -> ProfileItem | None:
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

    async def create_profiles_from_csv(self, file_path: str) -> dict[str, Any]:
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
                        check_query, check_params = (
                            self.queries.check_profile_exists_by_alias(username)
                        )
                        existing_user = await self.conn.fetchrow(
                            check_query, *check_params
                        )

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
            id=str(row["id"]),
            firstName=row["first_name"],
            lastName=row["last_name"],
            alias=row["alias"],
            role=row["role"],
            active=row["active"],
            viewedIntro=row["viewed_intro"],
            viewedChat=row["viewed_chat"],
            defaultProfile=row["default_profile"],
            reqPerDay=row["req_per_day"],
            lastLogin=row["last_login"].isoformat() if row["last_login"] else "",
            lastActive=row["last_active"].isoformat() if row["last_active"] else "",
            createdAt=row["created_at"].isoformat() if row["created_at"] else "",
            updatedAt=row["updated_at"].isoformat() if row["updated_at"] else "",
            primaryDepartmentId=str(row["primary_department_id"])
            if row.get("primary_department_id")
            else None,
        )

    def _parse_breadcrumbs(self, pathname: str) -> list[BreadcrumbItem]:
        """Parse breadcrumbs from pathname.

        Args:
            pathname: URL pathname (e.g., '/cohorts/123/simulations/456')

        Returns:
            List of BreadcrumbItem
        """
        breadcrumbs: list[BreadcrumbItem] = []

        # Always add home
        breadcrumbs.append(BreadcrumbItem(segment="", title="Home", context=None))

        # Parse pathname segments
        segments = [s for s in pathname.split("/") if s]

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
            label = segment.replace("-", " ").title()

            breadcrumbs.append(
                BreadcrumbItem(segment=segment, title=label, context=None)
            )

        return breadcrumbs

    def _is_uuid(self, value: str) -> bool:
        """Check if string is a UUID."""
        uuid_pattern = re.compile(
            r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$",
            re.IGNORECASE,
        )
        return bool(uuid_pattern.match(value))

    # ===== Analytics Methods for MCP Tools =====

    async def get_student_simulation_report(
        self, profile_id: str, recent: int = 50
    ) -> dict[str, Any]:
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
            # Get complete report in ONE optimized query
            query, params = self.queries.get_student_simulation_report_complete(
                str(profile_uuid), recent
            )
            result = await self.conn.fetchrow(query, *params)

            if not result:
                return {"error": f"Profile not found: {profile_id}"}

            profile_data = {
                "id": str(result["id"]),
                "first_name": result["first_name"],
                "last_name": result["last_name"],
                "alias": result["alias"],
                "role": result["role"],
                "created_at": result["created_at"].isoformat()
                if result["created_at"]
                else None,
            }

            # Parse attempts from JSONB (may be string or list)
            attempts_data = []
            attempts_json = result["attempts"]
            if isinstance(attempts_json, str):
                attempts_json = json.loads(attempts_json)
            if attempts_json and isinstance(attempts_json, list):
                for attempt in attempts_json:
                    if isinstance(attempt, dict):
                        # Parse chat data
                        chat_data = attempt.get("chat", {})
                        if isinstance(chat_data, dict):
                            # Parse messages
                            messages = []
                            if chat_data.get("messages") and isinstance(
                                chat_data["messages"], list
                            ):
                                for msg in chat_data["messages"]:
                                    if isinstance(msg, dict):
                                        messages.append(
                                            {
                                                "created_at": msg.get("created_at"),
                                                "type": msg.get("type"),
                                                "content": msg.get("content"),
                                                "completed": msg.get("completed"),
                                            }
                                        )

                            # Parse feedback
                            feedback = []
                            if chat_data.get("feedback") and isinstance(
                                chat_data["feedback"], list
                            ):
                                for fb in chat_data["feedback"]:
                                    if isinstance(fb, dict):
                                        feedback.append(
                                            {
                                                "standard": fb.get("standard"),
                                                "points": fb.get("points"),
                                                "feedback": fb.get("feedback"),
                                            }
                                        )

                            # Build attempt entry
                            attempts_data.append(
                                {
                                    "simulation_id": attempt.get("simulation_id"),
                                    "title": attempt.get("title"),
                                    "scenario": attempt.get("scenario", {}),
                                    "chat": {
                                        "id": chat_data.get("id"),
                                        "title": chat_data.get("title"),
                                        "completed": chat_data.get("completed"),
                                        "messages": messages,
                                        "grade": chat_data.get("grade", {}),
                                        "feedback": feedback,
                                    },
                                }
                            )

            return {"profile": profile_data, "attempts": attempts_data}

        except Exception as e:
            return {"error": f"Database error: {str(e)}"}

    async def search_profiles(
        self, query: str, limit: int = 10
    ) -> list[dict[str, Any]]:
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

            results.append(
                {
                    "id": str(profile["id"]),
                    "first_name": first,
                    "last_name": last,
                    "alias": alias,
                    "role": profile["role"],
                    "full_name": full_name,
                    "score": score,
                }
            )

        results.sort(key=lambda r: (-r["score"], r["full_name"]))
        return results[:limit]

    def _score_profile(
        self,
        q_norm: str,
        toks: list[str],
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

    async def get_profile_overview(self, profile_id: str) -> dict[str, Any]:
        """Get profile overview with all related data in ONE optimized query.

        Returns profile details and latest grades. Supports searching by UUID or name.

        Args:
            profile_id: UUID string or name pattern (searches first_name, last_name, alias)

        Returns:
            Dict with profile overview data or {"error": "..."}
        """
        try:
            query, params = self.queries.get_profile_overview_complete(
                profile_id, limit=5
            )
            result = await self.conn.fetchrow(query, *params)

            if not result:
                return {"error": f"Profile not found: {profile_id}"}

            profile_data = {
                "id": str(result["id"]),
                "first_name": result["first_name"],
                "last_name": result["last_name"],
                "alias": result["alias"],
                "role": result["role"],
                "last_login": result["last_login"].isoformat()
                if result["last_login"]
                else None,
                "viewed_intro": result["viewed_intro"],
                "active": result["active"],
                "created_at": result["created_at"].isoformat()
                if result["created_at"]
                else None,
            }

            # Transform latest grades (jsonb array to list of dicts) - may be string or list
            latest_grades = []
            latest_grades_data = result["latest_grades"]
            if isinstance(latest_grades_data, str):
                latest_grades_data = json.loads(latest_grades_data)
            if latest_grades_data and isinstance(latest_grades_data, list):
                for grade in latest_grades_data:
                    if isinstance(grade, dict):
                        latest_grades.append(
                            {
                                "simulation_title": grade.get("simulation_title"),
                                "score": float(grade["score"])
                                if grade.get("score")
                                else None,
                                "passed": grade.get("passed"),
                                "time_taken": grade.get("time_taken"),
                                "created_at": grade.get("created_at"),
                            }
                        )

            return {
                "profile": profile_data,
                "latest_grades": latest_grades,
            }

        except Exception as e:
            return {"error": f"Database error: {str(e)}"}


def get_profile_service(conn: asyncpg.Connection) -> ProfileService:
    """Get profile service instance."""
    return ProfileService(conn)
