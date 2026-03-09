"""Shared fixtures for infra integration tests.

Uses black-box tool functions to set up real test data.
All data lives in the disposable testcontainers DB.
"""

from dataclasses import dataclass
from uuid import UUID

import pytest
import pytest_asyncio
from tests.helpers import unique_tag

# Seeded profile IDs (from test-seed.sql)
SUPERADMIN_PROFILE_ID = UUID("019b3be4-36f0-788c-9df2-481eb5917940")
ADMIN_PROFILE_ID = UUID("019b3be4-36ef-7a5f-98ab-ccb879770be0")
INSTRUCTIONAL_PROFILE_ID = UUID("019b3be4-36f0-785d-9d61-32eae65689ca")
MEMBER_PROFILE_ID = UUID("019b3be4-36f0-7eb3-bc4e-bcab772edd92")
GUEST_PROFILE_ID = UUID("019b3be4-36f0-792c-82d6-126664ed18b6")

pytestmark = pytest.mark.asyncio


@dataclass(frozen=True)
class ProfileIdentityFixture:
    artifact_id: UUID
    profile_resource_id: UUID
    name: str | None
    role: str | None
    role_name: str | None
    role_description: str | None
    role_artifacts: list[str]
    departments: list[str]
    emails: list[str]


@pytest_asyncio.fixture
async def name_id(pool, redis_client) -> UUID:
    """Create a fresh name resource via black-box tool."""
    from app.routes.v5.tools.resources.names.create import create_name

    async with pool.acquire() as conn:
        result = await create_name(conn, "Test Name", redis_client)
    return result.id


@pytest_asyncio.fixture
async def description_id(pool, redis_client) -> UUID:
    """Create a fresh description resource via black-box tool."""
    from app.routes.v5.tools.resources.descriptions.create import create_description

    async with pool.acquire() as conn:
        result = await create_description(conn, "Test description", redis_client)
    return result.id


@pytest_asyncio.fixture
async def profile_identity_factory(pool, redis_client):
    """Create real profile artifacts plus linked resources for context tests."""

    async def _create(
        *,
        name: str | None = "Test User",
        role: tuple[str, str, str] | None = (
            "admin",
            "Admin",
            "Administrator role",
        ),
        departments: list[str] | None = None,
        emails: list[str] | None = None,
        artifact_active: bool = True,
    ) -> ProfileIdentityFixture:
        from app.routes.v5.tools.artifacts.profile.create import (
            create_profile as create_profile_artifact,
        )
        from app.routes.v5.tools.resources.departments.create import create_department
        from app.routes.v5.tools.resources.emails.create import create_email
        from app.routes.v5.tools.resources.names.create import create_name
        from app.routes.v5.tools.resources.profiles.create import (
            create_profile as create_profile_resource,
        )
        from app.routes.v5.tools.resources.roles.create import create_role

        tag = unique_tag()

        expected_name = f"{name}-{tag}" if name is not None else None
        expected_departments = (
            [f"{dept_name}-{tag}" for dept_name in departments]
            if departments is not None
            else []
        )
        expected_emails: list[str] = []

        async with pool.acquire() as conn:
            name_id = None
            if expected_name is not None:
                name_res = await create_name(conn, expected_name, redis_client)
                name_id = name_res.id

            role_ids = None
            expected_role = None
            expected_role_name = None
            expected_role_description = None
            expected_role_artifacts: list[str] = []
            if role is not None:
                role_key, role_name, role_description = role
                expected_role = f"{role_key}_{tag}"
                expected_role_name = f"{role_name} {tag}"
                expected_role_description = role_description
                role_res = await create_role(
                    conn,
                    role=expected_role,
                    name=expected_role_name,
                    description=role_description,
                    redis=redis_client,
                )
                role_ids = [role_res.id]
                expected_role_artifacts = role_res.artifacts

            department_ids = None
            if departments is not None:
                department_ids = []
                for dept_name in expected_departments:
                    dept_res = await create_department(
                        conn,
                        name=dept_name,
                        description="Test department",
                        redis=redis_client,
                    )
                    department_ids.append(dept_res.id)

            email_ids = None
            if emails is not None:
                email_ids = []
                for email in emails:
                    local, domain = email.split("@", 1)
                    expected_email = f"{local}+{tag}@{domain}"
                    email_res = await create_email(
                        conn,
                        email=expected_email,
                        redis=redis_client,
                    )
                    email_ids.append(email_res.id)
                    expected_emails.append(expected_email)

            profile_res = await create_profile_resource(
                conn,
                redis_client,
                name=f"profile-resource-{tag}",
                description="Test profile resource",
            )

            artifact_res = await create_profile_artifact(
                conn,
                name_id=name_id,
                department_ids=department_ids,
                email_ids=email_ids,
                role_ids=role_ids,
                profile_ids=[profile_res.id],
                soft=not artifact_active,
            )

        return ProfileIdentityFixture(
            artifact_id=artifact_res.id,
            profile_resource_id=profile_res.id,
            name=expected_name,
            role=expected_role,
            role_name=expected_role_name,
            role_description=expected_role_description,
            role_artifacts=expected_role_artifacts,
            departments=expected_departments,
            emails=expected_emails,
        )

    return _create
