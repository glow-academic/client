"""Profile service layer - business logic for profile and emulation operations."""

import re
from typing import Any, Dict, List, Optional, Tuple

import asyncpg # type: ignore
from app.queries.profile_queries import ProfileQueries
from app.schemas.profile import (BreadcrumbItem, CohortItem, CohortsData,
                                 DepartmentItem, ProfileContextRequest,
                                 ProfileContextResponse, ProfileItem,
                                 SimulationContextItem, SimulationsData,
                                 UserProfileItem)


class ProfileService:
    """Service layer for profile operations."""

    def __init__(self, conn: asyncpg.Connection):
        """Initialize service with database connection."""
        self.conn = conn
        self.queries = ProfileQueries()

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

        return self._row_to_profile_item(result)

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
        target_ids = {p.profile_id for p in simulatable_profiles}

        if target_profile_id in target_ids:
            return (True, None)
        else:
            return (False, "You do not have permission to emulate this profile")

    async def get_profile_context(
        self, request: ProfileContextRequest
    ) -> ProfileContextResponse:
        """Get consolidated profile context (profile, departments, cohorts, breadcrumbs).

        Args:
            request: ProfileContextRequest with userId, effectiveProfileId, pathname

        Returns:
            ProfileContextResponse with all consolidated data
        """
        # Get profile
        profile = await self.get_profile(request.effectiveProfileId)

        if not profile:
            raise ValueError(f"Profile not found: {request.effectiveProfileId}")

        # Get departments for this profile
        query = """
        SELECT 
            d.id,
            d.title,
            d.description,
            d.active,
            pd.primary_department
        FROM profile_departments pd
        JOIN departments d ON d.id = pd.department_id
        WHERE pd.profile_id = $1 AND pd.active = true
        ORDER BY pd.primary_department DESC, d.title
        """
        dept_rows = await self.conn.fetch(query, request.effectiveProfileId)

        departments = [
            DepartmentItem(
                department_id=str(row['id']),
                title=row['title'],
                description=row['description'],
                active=row['active'],
                primary_department=row['primary_department']
            )
            for row in dept_rows
        ]

        # Get cohorts for this profile across all departments
        cohorts_data = CohortsData(cohorts=[])
        simulations_data = SimulationsData(simulations=[])

        if departments:
            dept_ids = [d.department_id for d in departments]
            
            # Get cohorts via profile_cohorts junction
            query = """
            SELECT DISTINCT
                c.id,
                c.name,
                c.description,
                c.active,
                c.department_id,
                CASE WHEN EXISTS (
                    SELECT 1 FROM cohort_staff cs
                    WHERE cs.cohort_id = c.id AND cs.profile_id = $1
                ) THEN true ELSE false END as is_staff
            FROM cohorts c
            JOIN profile_cohorts pc ON pc.cohort_id = c.id
            WHERE pc.profile_id = $1 
              AND pc.active = true
              AND c.active = true
            ORDER BY c.name
            """
            cohort_rows = await self.conn.fetch(query, request.effectiveProfileId)

            cohorts = [
                CohortItem(
                    cohort_id=str(row['id']),
                    name=row['name'],
                    description=row['description'],
                    active=row['active'],
                    department_id=str(row['department_id']),
                    is_staff=row['is_staff']
                )
                for row in cohort_rows
            ]
            cohorts_data = CohortsData(cohorts=cohorts)

            # Get simulations from cohort memberships
            if cohorts:
                cohort_ids = [c.cohort_id for c in cohorts]
                placeholders = ','.join(f'${i+1}' for i in range(len(cohort_ids)))
                
                query = f"""
                SELECT DISTINCT
                    s.id,
                    s.name,
                    s.description,
                    s.time_limit,
                    s.active,
                    s.default_simulation,
                    s.practice_simulation
                FROM simulations s
                JOIN cohort_simulations cs ON cs.simulation_id = s.id
                WHERE cs.cohort_id IN ({placeholders})
                  AND s.active = true
                ORDER BY s.name
                """
                sim_rows = await self.conn.fetch(query, *cohort_ids)

                simulations = [
                    SimulationContextItem(
                        simulation_id=str(row['id']),
                        name=row['name'],
                        description=row['description'],
                        time_limit=row['time_limit'],
                        active=row['active'],
                        default_simulation=row['default_simulation'],
                        practice_simulation=row['practice_simulation']
                    )
                    for row in sim_rows
                ]
                simulations_data = SimulationsData(simulations=simulations)

        # Parse breadcrumbs from pathname
        breadcrumbs = self._parse_breadcrumbs(request.pathname)

        return ProfileContextResponse(
            profile=profile,
            departments=departments,
            cohorts=cohorts_data,
            simulations=simulations_data,
            breadcrumbs=breadcrumbs,
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

    async def list_user_profiles_by_user(self, user_id: int) -> List[UserProfileItem]:
        """List user_profiles by user ID.

        Args:
            user_id: Integer user ID

        Returns:
            List of UserProfileItem
        """
        query, params = self.queries.list_user_profiles_by_user(user_id)
        result = await self.conn.fetch(query, *params)

        return [self._row_to_user_profile_item(row) for row in result]

    async def list_user_profiles_by_profile(
        self, profile_id: str
    ) -> List[UserProfileItem]:
        """List user_profiles by profile ID.

        Args:
            profile_id: UUID of the profile

        Returns:
            List of UserProfileItem
        """
        query, params = self.queries.list_user_profiles_by_profile(profile_id)
        result = await self.conn.fetch(query, *params)

        return [self._row_to_user_profile_item(row) for row in result]

    async def create_user_profile(
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
        result = await self.conn.fetchrow(query, *params)

        return self._row_to_user_profile_item(result)

    # Helper methods
    def _row_to_profile_item(self, row: asyncpg.Record) -> ProfileItem:
        """Convert database row to ProfileItem."""
        return ProfileItem(
            profile_id=str(row['id']),
            first_name=row['first_name'],
            last_name=row['last_name'],
            alias=row['alias'],
            role=row['role'],
            active=row['active'],
            viewed_intro=row['viewed_intro'],
            viewed_chat=row['viewed_chat'],
            default_profile=row['default_profile'],
            req_per_day=row['req_per_day'],
            last_login=row['last_login'].isoformat() if row['last_login'] else None,
            last_active=row['last_active'].isoformat() if row['last_active'] else None,
            created_at=row['created_at'].isoformat() if row['created_at'] else None,
            updated_at=row['updated_at'].isoformat() if row['updated_at'] else None,
        )

    def _row_to_user_profile_item(self, row: asyncpg.Record) -> UserProfileItem:
        """Convert database row to UserProfileItem."""
        return UserProfileItem(
            user_id=row['user_id'],
            profile_id=str(row['profile_id']),
            is_primary=row['is_primary'],
            active=row['active'],
            created_at=row['created_at'].isoformat() if row['created_at'] else None,
            updated_at=row['updated_at'].isoformat() if row['updated_at'] else None,
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
        breadcrumbs.append(BreadcrumbItem(label="Home", href="/"))

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

            breadcrumbs.append(BreadcrumbItem(label=label, href=current_path))

        return breadcrumbs

    def _is_uuid(self, value: str) -> bool:
        """Check if string is a UUID."""
        uuid_pattern = re.compile(
            r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$',
            re.IGNORECASE
        )
        return bool(uuid_pattern.match(value))
