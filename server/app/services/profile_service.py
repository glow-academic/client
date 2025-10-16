"""Profile service layer - business logic for profile and emulation operations."""

import re
from typing import Any, Dict, List, Optional, Tuple

from app.queries.profile_queries import ProfileQueries
from app.schemas.profile import (BreadcrumbItem, CohortItem, CohortsData,
                                 DepartmentItem, ProfileContextRequest,
                                 ProfileContextResponse, ProfileItem,
                                 SimulationContextItem, SimulationsData,
                                 UserProfileItem)
from sqlalchemy import text
from sqlalchemy.orm import Session


class ProfileService:
    """Service layer for profile operations."""

    def __init__(self, db: Session):
        """Initialize service with database session."""
        self.db = db
        self.queries = ProfileQueries()

    def get_profile(self, profile_id: str) -> Optional[ProfileItem]:
        """Get profile by ID.

        Args:
            profile_id: UUID of the profile

        Returns:
            ProfileItem if found, None otherwise
        """
        query, params = self.queries.get_profile(profile_id)
        result = self.db.execute(text(query), params).fetchone()

        if not result:
            return None

        return self._row_to_profile_item(result)

    def update_profile(
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
            return self.get_profile(profile_id)

        query, params = self.queries.update_profile(profile_id, updates)
        result = self.db.execute(text(query), params).fetchone()
        self.db.commit()

        if not result:
            return None

        return self._row_to_profile_item(result)

    def mark_intro_complete(self, profile_id: str) -> bool:
        """Mark viewedIntro as complete for a profile.

        Args:
            profile_id: UUID of the profile

        Returns:
            True if successful, False otherwise
        """
        result = self.update_profile(profile_id, {"viewedIntro": True})
        return result is not None

    def mark_chat_complete(self, profile_id: str) -> bool:
        """Mark viewedChat as complete for a profile.

        Args:
            profile_id: UUID of the profile

        Returns:
            True if successful, False otherwise
        """
        result = self.update_profile(profile_id, {"viewedChat": True})
        return result is not None

    def get_simulatable_profiles(
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
        role_result = self.db.execute(text(role_query), role_params).fetchone()

        if not role_result:
            return []

        requester_role = role_result.role

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

        result = self.db.execute(text(query), params).fetchall()

        return [self._row_to_profile_item(row) for row in result]

    def authorize_emulation(
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

        # Get requester profile
        requester_query, requester_params = self.queries.get_profile(
            requester_profile_id
        )
        requester_result = self.db.execute(
            text(requester_query), requester_params
        ).fetchone()

        if not requester_result:
            return (False, "Requester profile not found")

        # Get target profile
        target_query, target_params = self.queries.get_profile(target_profile_id)
        target_result = self.db.execute(text(target_query), target_params).fetchone()

        if not target_result:
            return (False, "Target profile not found")

        requester_role = requester_result.role
        target_role = target_result.role

        # Apply role hierarchy rules
        if requester_role == "superadmin":
            return (True, None)

        if requester_role == "admin":
            if target_role in ["instructional", "ta", "guest"]:
                return (True, None)
            return (False, f"Admins cannot emulate {target_role} profiles")

        if requester_role == "instructional":
            if target_role in ["ta", "guest"]:
                return (True, None)
            return (
                False,
                f"Instructional staff cannot emulate {target_role} profiles",
            )

        # ta and guest cannot emulate anyone
        return (False, f"{requester_role.capitalize()}s cannot emulate other profiles")

    def _row_to_profile_item(self, row: Any) -> ProfileItem:
        """Convert database row to ProfileItem schema.

        Args:
            row: Database row result

        Returns:
            ProfileItem schema
        """
        return ProfileItem(
            id=str(row.id),
            firstName=row.first_name,
            lastName=row.last_name,
            alias=row.alias,
            role=row.role,
            active=row.active,
            viewedIntro=row.viewed_intro,
            viewedChat=row.viewed_chat,
            defaultProfile=row.default_profile,
            reqPerDay=row.req_per_day,
            lastLogin=row.last_login.isoformat() if row.last_login else "",
            lastActive=row.last_active.isoformat() if row.last_active else None,
            createdAt=row.created_at.isoformat() if row.created_at else "",
            updatedAt=row.updated_at.isoformat() if row.updated_at else "",
        )

    # ============================================================================
    # PROFILE CONTEXT OPERATIONS (Consolidated Layout Data)
    # ============================================================================

    def get_profile_context(
        self, request: ProfileContextRequest
    ) -> ProfileContextResponse:
        """Get consolidated profile context in a single transaction."""
        user_id = request.userId
        effective_profile_id = request.effectiveProfileId
        pathname = request.pathname

        # Get actual profile ID from user ID (join users -> profiles)
        actual_profile_id = self._get_profile_id_from_user_id(user_id)
        if not actual_profile_id:
            raise ValueError(f"Profile not found for user: {user_id}")

        # Fetch both profiles
        actual_profile = self._get_profile_by_id(actual_profile_id)
        if not actual_profile:
            raise ValueError(f"Actual profile not found: {actual_profile_id}")

        # If effective profile is different, fetch it; otherwise use actual profile
        if effective_profile_id != actual_profile_id:
            effective_profile = self._get_profile_by_id(effective_profile_id)
            if not effective_profile:
                raise ValueError(f"Effective profile not found: {effective_profile_id}")
        else:
            effective_profile = actual_profile

        # Fetch departments, cohorts, and breadcrumbs based on EFFECTIVE profile
        departments = self._get_user_departments(effective_profile_id)

        # Get department IDs
        department_ids = [dept.id for dept in departments]

        # Fetch cohorts and member counts
        cohorts = self._get_user_cohorts(effective_profile_id, department_ids)

        # Get cohort IDs
        cohort_ids = [cohort.id for cohort in cohorts.items]

        # Fetch simulations based on EFFECTIVE profile
        simulations = self._get_user_simulations(effective_profile_id, department_ids)

        # Get simulation IDs
        simulation_ids = [sim.id for sim in simulations.items]

        # Resolve breadcrumbs
        breadcrumbs = self._resolve_breadcrumbs(pathname)

        # Fetch simulatable profiles based on ACTUAL profile (not effective)
        # This allows users to see who they can emulate based on their real permissions
        simulatable_profiles = self.get_simulatable_profiles(
            actual_profile_id, department_ids
        )

        # Get earliest attempt date (global across all attempts)
        earliest_attempt_date = self._get_earliest_attempt_date()

        # Get permissions data based on effective profile's role
        from typing import cast

        from app.schemas.permissions import ProfileRole
        from app.services.permissions_service import permissions_service

        # Cast role to ProfileRole for type safety
        profile_role = cast(ProfileRole, effective_profile.role)
        
        available_sections = permissions_service.get_available_sections_for_role(
            profile_role
        )
        redirect_path = permissions_service.get_redirect_path_for_role(
            profile_role
        )

        return ProfileContextResponse(
            actualProfile=actual_profile,
            effectiveProfile=effective_profile,
            departments=departments,
            departmentIds=department_ids,
            cohorts=cohorts,
            cohortIds=cohort_ids,
            simulations=simulations,
            simulationIds=simulation_ids,
            breadcrumbs=breadcrumbs,
            simulatableProfiles=simulatable_profiles,
            earliestAttemptDate=earliest_attempt_date,
            availableSections=available_sections,
            redirectPath=redirect_path,
        )

    def _get_profile_id_from_user_id(self, user_id: str) -> Optional[str]:
        """Get profile ID from user ID by joining users and profiles tables."""
        query = text(
            """
            SELECT p.id
            FROM profiles p
            INNER JOIN users u ON u.profile_id = p.id
            WHERE u.id = :user_id
            """
        )
        result = self.db.execute(query, {"user_id": user_id}).fetchone()
        return str(result.id) if result else None

    def _get_profile_by_id(self, profile_id: str) -> Optional[ProfileItem]:
        """Fetch profile by ID (for context operations)."""
        query = text(
            """
            SELECT 
                id, first_name, last_name, alias, role, active,
                viewed_intro, viewed_chat, default_profile, req_per_day,
                last_login, last_active, created_at, updated_at
            FROM profiles
            WHERE id = :profile_id
            """
        )
        result = self.db.execute(query, {"profile_id": profile_id}).fetchone()

        if not result:
            return None

        return ProfileItem(
            id=str(result.id),
            firstName=result.first_name,
            lastName=result.last_name,
            alias=result.alias,
            role=result.role,
            active=result.active,
            viewedIntro=result.viewed_intro,
            viewedChat=result.viewed_chat,
            defaultProfile=result.default_profile,
            reqPerDay=result.req_per_day,
            lastLogin=result.last_login.isoformat() if result.last_login else "",
            lastActive=result.last_active.isoformat() if result.last_active else None,
            createdAt=result.created_at.isoformat() if result.created_at else "",
            updatedAt=result.updated_at.isoformat() if result.updated_at else "",
        )

    def _get_user_departments(self, profile_id: str) -> List[DepartmentItem]:
        """Fetch departments the user belongs to."""
        query = text(
            """
            SELECT DISTINCT 
                d.id, d.title, d.description, d.active, 
                d.created_at, d.updated_at
            FROM departments d
            INNER JOIN profile_departments pd ON d.id = pd.department_id
            WHERE pd.profile_id = :profile_id
            AND d.active = true
            ORDER BY d.title
            """
        )
        results = self.db.execute(query, {"profile_id": profile_id}).fetchall()

        return [
            DepartmentItem(
                id=str(row.id),
                title=row.title,
                description=row.description,
                active=row.active,
                createdAt=row.created_at.isoformat() if row.created_at else "",
                updatedAt=row.updated_at.isoformat() if row.updated_at else "",
            )
            for row in results
        ]

    def _get_user_cohorts(
        self, profile_id: str, department_ids: List[str]
    ) -> CohortsData:
        """Fetch cohorts the user has access to with member counts."""
        if not department_ids:
            return CohortsData(items=[], memberCounts={})

        # Fetch cohorts for user's departments
        placeholders = ", ".join([f":dept_id_{i}" for i in range(len(department_ids))])
        query = text(
            f"""
            SELECT 
                c.id, c.title, c.description, c.department_id, 
                c.active, c.created_at, c.updated_at
            FROM cohorts c
            WHERE c.department_id IN ({placeholders})
            AND c.active = true
            ORDER BY c.title
            """
        )
        params = {f"dept_id_{i}": dept_id for i, dept_id in enumerate(department_ids)}
        cohort_results = self.db.execute(query, params).fetchall()

        cohorts = [
            CohortItem(
                id=str(row.id),
                title=row.title,
                description=row.description,
                departmentId=str(row.department_id),
                active=row.active,
                createdAt=row.created_at.isoformat() if row.created_at else "",
                updatedAt=row.updated_at.isoformat() if row.updated_at else "",
            )
            for row in cohort_results
        ]

        # Get member counts for all cohorts
        member_counts: Dict[str, int] = {}
        if cohorts:
            cohort_ids = [c.id for c in cohorts]
            cohort_placeholders = ", ".join(
                [f":cohort_id_{i}" for i in range(len(cohort_ids))]
            )
            count_query = text(
                f"""
                SELECT cohort_id, COUNT(*) as member_count
                FROM cohort_profiles
                WHERE cohort_id IN ({cohort_placeholders})
                AND active = true
                GROUP BY cohort_id
                """
            )
            count_params = {
                f"cohort_id_{i}": cohort_id for i, cohort_id in enumerate(cohort_ids)
            }
            count_results = self.db.execute(count_query, count_params).fetchall()

            member_counts = {
                str(row.cohort_id): int(row.member_count) for row in count_results
            }

        return CohortsData(items=cohorts, memberCounts=member_counts)

    def _get_user_simulations(
        self, profile_id: str, department_ids: List[str]
    ) -> SimulationsData:
        """Fetch simulations for user's departments."""
        if not department_ids:
            return SimulationsData(items=[])

        # Fetch simulations for user's departments
        placeholders = ", ".join([f":dept_id_{i}" for i in range(len(department_ids))])
        query = text(
            f"""
            SELECT 
                s.id, s.title as name, s.description, s.department_id,
                s.time_limit, s.active, s.practice_simulation, s.default_simulation
            FROM simulations s
            WHERE s.department_id IN ({placeholders})
            AND s.active = true
            ORDER BY s.practice_simulation DESC, s.default_simulation DESC, s.title
            """
        )
        params = {f"dept_id_{i}": dept_id for i, dept_id in enumerate(department_ids)}
        results = self.db.execute(query, params).fetchall()

        simulations = [
            SimulationContextItem(
                id=str(row.id),
                name=row.name,
                description=row.description or "",
                departmentId=str(row.department_id),
                timeLimit=row.time_limit,
                active=row.active,
                practiceSimulation=row.practice_simulation,
                defaultSimulation=row.default_simulation,
            )
            for row in results
        ]

        return SimulationsData(items=simulations)

    def _resolve_breadcrumbs(self, pathname: str) -> List[BreadcrumbItem]:
        """Resolve breadcrumbs from pathname."""
        segments = [s for s in pathname.split("/") if s]
        breadcrumbs: List[BreadcrumbItem] = []

        for i, segment in enumerate(segments):
            # Skip single letter segments (route markers)
            if re.match(r"^[a-z]$", segment):
                continue

            prev_segment = segments[i - 1] if i > 0 else ""
            title = segment
            context = None

            # Check if this looks like an ID (UUID or hex with dashes)
            is_likely_id = bool(
                re.match(r"^[a-f0-9-]{8,}", segment)
                or (len(segment) > 15 and "-" in segment)
            )

            if is_likely_id:
                # Determine context and resolve ID
                context = self._determine_context(prev_segment, segments)
                if context:
                    title = self._resolve_entity_title(segment, context) or title
            else:
                # Convert known segments to readable titles
                title = self._humanize_segment(segment)

            breadcrumbs.append(
                BreadcrumbItem(segment=segment, title=title, context=context)
            )

        return breadcrumbs

    def _determine_context(self, prev_segment: str, all_segments: List[str]) -> Optional[str]:
        """Determine entity context from route structure."""
        context_map = {
            ("c", "cohorts"): "cohort",
            ("e", "cohorts"): "cohort",
            ("s", "simulations"): "simulation",
            ("p", "personas"): "persona",
            ("a", "agents"): "agent",
            ("s", "scenarios"): "scenario",
            ("p", "staff"): "profile",
            ("p", "providers"): "provider",
            ("r", "rubrics"): "rubric",
            ("p", "parameters"): "parameter",
            ("d", "departments"): "department",
            ("a", "home"): "attempt",
            ("a", "practice"): "attempt",
            ("c", "practice"): "chat",
        }

        for parent in all_segments:
            if (prev_segment, parent) in context_map:
                return context_map[(prev_segment, parent)]

        return None

    def _resolve_entity_title(self, entity_id: str, context: str) -> Optional[str]:
        """Resolve entity ID to human-readable title."""
        query_map = {
            "cohort": "SELECT title FROM cohorts WHERE id = :id",
            "simulation": "SELECT title FROM simulations WHERE id = :id",
            "persona": "SELECT title FROM personas WHERE id = :id",
            "agent": "SELECT title FROM agents WHERE id = :id",
            "scenario": "SELECT title FROM scenarios WHERE id = :id",
            "profile": "SELECT first_name || ' ' || last_name as title FROM profiles WHERE id = :id",
            "provider": "SELECT title FROM providers WHERE id = :id",
            "rubric": "SELECT title FROM rubrics WHERE id = :id",
            "parameter": "SELECT title FROM parameters WHERE id = :id",
            "department": "SELECT title FROM departments WHERE id = :id",
            "attempt": "SELECT title FROM attempts WHERE id = :id",
            "chat": "SELECT title FROM chats WHERE id = :id",
        }

        if context not in query_map:
            return None

        try:
            result = self.db.execute(
                text(query_map[context]), {"id": entity_id}
            ).fetchone()
            return result.title if result else None
        except Exception:
            return None

    def _humanize_segment(self, segment: str) -> str:
        """Convert URL segment to human-readable title."""
        segment_titles = {
            "home": "Home",
            "practice": "Practice",
            "progress": "Progress",
            "rubric": "Rubric",
            "analytics": "Analytics",
            "simulations": "Simulations",
            "management": "Management",
            "system": "System",
            "profile": "Profile",
            "create": "Create",
            "overview": "Overview",
            "performance": "Performance",
            "reports": "Reports",
            "personas": "Personas",
            "scenarios": "Scenarios",
            "rubrics": "Rubrics",
            "documents": "Documents",
            "staff": "Staff",
            "context": "Context",
            "providers": "Providers",
            "pricing": "Pricing",
            "parameters": "Parameters",
            "models": "Models",
            "departments": "Departments",
            "agents": "Agents",
            "feedback": "Feedback",
            "health": "Health",
            "logs": "Logs",
            "cohorts": "Cohorts",
            "new": "New",
            "edit": "Edit",
        }

        return segment_titles.get(segment, segment.capitalize())

    def _get_earliest_attempt_date(self) -> Optional[str]:
        """Get the earliest simulation attempt date across all attempts.

        Returns:
            ISO datetime string of earliest attempt, or None if no attempts exist
        """
        query = text(
            """
            SELECT MIN(created_at) as earliest_date
            FROM simulation_attempts
            """
        )
        result = self.db.execute(query).fetchone()

        if not result or not result.earliest_date:
            return None

        earliest_date = result.earliest_date
        return str(earliest_date.isoformat()) if hasattr(earliest_date, 'isoformat') else str(earliest_date)

    # ============================================================================
    # PROFILE BY ALIAS OPERATIONS
    # ============================================================================

    def get_profile_by_alias(self, alias: str) -> Optional[ProfileItem]:
        """Get profile by alias.

        Args:
            alias: Profile alias (e.g., 'jdoe')

        Returns:
            ProfileItem if found, None otherwise
        """
        query, params = self.queries.get_profile_by_alias(alias)
        result = self.db.execute(text(query), params).fetchone()

        if not result:
            return None

        return self._row_to_profile_item(result)

    # ============================================================================
    # USER PROFILES OPERATIONS (Junction Table)
    # ============================================================================

    def list_user_profiles_by_user(self, user_id: int) -> List[UserProfileItem]:
        """List user_profiles by user ID.

        Args:
            user_id: Integer user ID

        Returns:
            List of UserProfileItem
        """
        query, params = self.queries.list_user_profiles_by_user(user_id)
        result = self.db.execute(text(query), params).fetchall()

        return [self._row_to_user_profile_item(row) for row in result]

    def list_user_profiles_by_profile(
        self, profile_id: str
    ) -> List[UserProfileItem]:
        """List user_profiles by profile ID.

        Args:
            profile_id: UUID of the profile

        Returns:
            List of UserProfileItem
        """
        query, params = self.queries.list_user_profiles_by_profile(profile_id)
        result = self.db.execute(text(query), params).fetchall()

        return [self._row_to_user_profile_item(row) for row in result]

    def create_user_profile(
        self, user_id: int, profile_id: str, is_primary: bool, active: bool
    ) -> UserProfileItem:
        """Create a user_profile link.

        Args:
            user_id: Integer user ID
            profile_id: UUID of the profile
            is_primary: Whether this is the primary profile for the user
            active: Whether the link is active

        Returns:
            Created UserProfileItem
        """
        query, params = self.queries.create_user_profile(
            user_id, profile_id, is_primary, active
        )
        result = self.db.execute(text(query), params).fetchone()
        self.db.commit()

        return self._row_to_user_profile_item(result)

    def _row_to_user_profile_item(self, row: Any) -> UserProfileItem:
        """Convert database row to UserProfileItem schema.

        Args:
            row: Database row result

        Returns:
            UserProfileItem schema
        """
        return UserProfileItem(
            userId=row.user_id,
            profileId=str(row.profile_id),
            isPrimary=row.is_primary,
            active=row.active,
            createdAt=row.created_at.isoformat() if row.created_at else "",
            updatedAt=row.updated_at.isoformat() if row.updated_at else "",
        )

