"""Profile service layer - business logic for profile and emulation operations."""

import re
import uuid
from typing import Any, Dict, List, Optional, Tuple, cast
from uuid import UUID

import asyncpg  # type: ignore
from app.queries.profile_queries import ProfileQueries
from app.schemas.permissions import ProfileRole
from app.schemas.profile import (BreadcrumbItem, CohortItem, CohortsData,
                                 DepartmentItem, ProfileContextRequest,
                                 ProfileContextResponse, ProfileItem,
                                 SimulationContextItem, SimulationsData,
                                 UserProfileItem)
from app.services.permissions_service import PermissionsService
from app.utils.csv import parse_csv_file


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
            request: ProfileContextRequest with userId, effectiveProfileId, pathname

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
        query = """
        SELECT 
            d.id,
            d.title,
            d.description,
            d.active,
            pd.is_primary
        FROM profile_departments pd
        JOIN departments d ON d.id = pd.department_id
        WHERE pd.profile_id = $1 AND pd.active = true
        ORDER BY pd.is_primary DESC, d.title
        """
        dept_rows = await self.conn.fetch(query, effective_profile_id)

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
            query = """
            SELECT DISTINCT
                c.id,
                c.title,
                c.description,
                c.active,
                c.department_id
            FROM cohorts c
            JOIN cohort_profiles pc ON pc.cohort_id = c.id
            WHERE pc.profile_id = $1 
              AND pc.active = true
              AND c.active = true
            ORDER BY c.title
            """
            cohort_rows = await self.conn.fetch(query, effective_profile_id)

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
                placeholders = ','.join(f'${i+1}' for i in range(len(cohort_ids)))
                
                query = f"""
                SELECT DISTINCT
                    s.id,
                    s.title,
                    s.description,
                    s.department_id,
                    s.time_limit,
                    s.active,
                    s.default_simulation,
                    s.practice_simulation
                FROM simulations s
                JOIN cohort_simulations cs ON cs.simulation_id = s.id
                WHERE cs.cohort_id IN ({placeholders})
                  AND s.active = true
                ORDER BY s.title
                """
                sim_rows = await self.conn.fetch(query, *cohort_ids)

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
        earliest_query = """
        SELECT MIN(sa.created_at) as earliest
        FROM simulation_attempts sa
        JOIN attempt_profiles ap ON ap.attempt_id = sa.id
        WHERE ap.profile_id = $1
        """
        earliest_row = await self.conn.fetchrow(earliest_query, effective_profile_id)
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
        )

    def _row_to_user_profile_item(self, row: asyncpg.Record) -> UserProfileItem:
        """Convert database row to UserProfileItem."""
        return UserProfileItem(
            userId=row['user_id'],
            profileId=str(row['profile_id']),
            isPrimary=row['is_primary'],
            active=row['active'],
            createdAt=row['created_at'].isoformat() if row['created_at'] else "",
            updatedAt=row['updated_at'].isoformat() if row['updated_at'] else "",
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
