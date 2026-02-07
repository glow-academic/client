"""Unit tests for profile permissions module.

Tests pure Python business logic — no database needed.
"""

from uuid import uuid4

from app.api.v4.artifacts.profile.permissions import (
    compute_can_create,
    compute_can_delete,
    compute_can_draft,
    compute_can_duplicate,
    compute_can_edit,
    compute_can_save,
    compute_disabled_reason,
    compute_show_cohorts,
    compute_show_departments,
    compute_show_emails,
    compute_show_flag,
    compute_show_name,
    compute_show_request_limit,
    has_access,
)

# ========== compute_can_edit ==========


class TestComputeCanEdit:
    def test_superadmin_can_edit_any(self) -> None:
        assert (
            compute_can_edit(
                "superadmin", target_is_self=False, target_department_ids=[]
            )
            is True
        )

    def test_admin_can_edit(self) -> None:
        assert (
            compute_can_edit("admin", target_is_self=False, target_department_ids=[])
            is True
        )

    def test_instructional_can_edit(self) -> None:
        assert (
            compute_can_edit(
                "instructional", target_is_self=False, target_department_ids=[]
            )
            is True
        )

    def test_staff_can_edit_self(self) -> None:
        assert (
            compute_can_edit("staff", target_is_self=True, target_department_ids=[])
            is True
        )

    def test_staff_cannot_edit_others(self) -> None:
        assert (
            compute_can_edit("staff", target_is_self=False, target_department_ids=[])
            is False
        )

    def test_learner_cannot_edit(self) -> None:
        assert (
            compute_can_edit("learner", target_is_self=False, target_department_ids=[])
            is False
        )

    def test_none_role_cannot_edit(self) -> None:
        assert (
            compute_can_edit(None, target_is_self=False, target_department_ids=[])
            is False
        )


# ========== compute_disabled_reason ==========


class TestComputeDisabledReason:
    def test_superadmin_no_reason(self) -> None:
        assert (
            compute_disabled_reason(
                "superadmin", target_is_self=False, target_department_ids=[]
            )
            is None
        )

    def test_admin_no_reason(self) -> None:
        assert (
            compute_disabled_reason(
                "admin", target_is_self=False, target_department_ids=[]
            )
            is None
        )

    def test_staff_self_no_reason(self) -> None:
        assert (
            compute_disabled_reason(
                "staff", target_is_self=True, target_department_ids=[]
            )
            is None
        )

    def test_staff_other_has_reason(self) -> None:
        reason = compute_disabled_reason(
            "staff", target_is_self=False, target_department_ids=[]
        )
        assert reason is not None
        assert "only edit your own" in reason

    def test_learner_has_reason(self) -> None:
        reason = compute_disabled_reason(
            "learner", target_is_self=False, target_department_ids=[]
        )
        assert reason is not None
        assert "do not have permission" in reason


# ========== has_access ==========


class TestHasAccess:
    def test_superadmin_has_access(self) -> None:
        assert has_access("superadmin", [], [uuid4()]) is True

    def test_no_target_departments_accessible(self) -> None:
        assert has_access("staff", [uuid4()], []) is True

    def test_overlapping_departments(self) -> None:
        dept_id = uuid4()
        assert has_access("admin", [dept_id, uuid4()], [dept_id]) is True

    def test_no_overlap_no_access(self) -> None:
        assert has_access("admin", [uuid4()], [uuid4()]) is False

    def test_no_user_departments_no_access(self) -> None:
        assert has_access("admin", [], [uuid4()]) is False

    def test_none_user_departments_no_access(self) -> None:
        assert has_access("admin", None, [uuid4()]) is False


# ========== compute_can_delete ==========


class TestComputeCanDelete:
    def test_cannot_delete_self(self) -> None:
        assert compute_can_delete("superadmin", target_is_self=True) is False

    def test_superadmin_can_delete_others(self) -> None:
        assert compute_can_delete("superadmin", target_is_self=False) is True

    def test_admin_can_delete_others(self) -> None:
        assert compute_can_delete("admin", target_is_self=False) is True

    def test_instructional_cannot_delete(self) -> None:
        assert compute_can_delete("instructional", target_is_self=False) is False

    def test_staff_cannot_delete(self) -> None:
        assert compute_can_delete("staff", target_is_self=False) is False


# ========== compute_can_duplicate ==========


class TestComputeCanDuplicate:
    def test_superadmin_can_duplicate(self) -> None:
        assert compute_can_duplicate("superadmin") is True

    def test_admin_can_duplicate(self) -> None:
        assert compute_can_duplicate("admin") is True

    def test_instructional_can_duplicate(self) -> None:
        assert compute_can_duplicate("instructional") is True

    def test_staff_cannot_duplicate(self) -> None:
        assert compute_can_duplicate("staff") is False

    def test_learner_cannot_duplicate(self) -> None:
        assert compute_can_duplicate("learner") is False


# ========== compute_can_create ==========


class TestComputeCanCreate:
    def test_superadmin_can_create_without_departments(self) -> None:
        assert compute_can_create("superadmin", department_ids=None) is True

    def test_superadmin_can_create_with_departments(self) -> None:
        assert compute_can_create("superadmin", department_ids=[uuid4()]) is True

    def test_admin_can_create_with_departments(self) -> None:
        assert compute_can_create("admin", department_ids=[uuid4()]) is True

    def test_admin_cannot_create_without_departments(self) -> None:
        assert compute_can_create("admin", department_ids=None) is False

    def test_admin_cannot_create_with_empty_departments(self) -> None:
        assert compute_can_create("admin", department_ids=[]) is False

    def test_instructional_cannot_create(self) -> None:
        assert compute_can_create("instructional", department_ids=[uuid4()]) is False

    def test_staff_cannot_create(self) -> None:
        assert compute_can_create("staff", department_ids=[uuid4()]) is False


# ========== compute_can_save ==========


class TestComputeCanSave:
    def test_superadmin_can_save(self) -> None:
        assert (
            compute_can_save(
                "superadmin", user_department_ids=None, target_department_ids=[uuid4()]
            )
            is True
        )

    def test_admin_can_save_same_dept(self) -> None:
        dept = uuid4()
        assert (
            compute_can_save(
                "admin", user_department_ids=[dept], target_department_ids=[dept]
            )
            is True
        )

    def test_admin_cannot_save_different_dept(self) -> None:
        assert (
            compute_can_save(
                "admin", user_department_ids=[uuid4()], target_department_ids=[uuid4()]
            )
            is False
        )

    def test_instructional_can_save(self) -> None:
        dept = uuid4()
        assert (
            compute_can_save(
                "instructional",
                user_department_ids=[dept],
                target_department_ids=[dept],
            )
            is True
        )

    def test_staff_cannot_save(self) -> None:
        assert (
            compute_can_save("staff", user_department_ids=[], target_department_ids=[])
            is False
        )


# ========== compute_can_draft ==========


class TestComputeCanDraft:
    def test_superadmin_can_draft(self) -> None:
        assert compute_can_draft("superadmin") is True

    def test_admin_can_draft(self) -> None:
        assert compute_can_draft("admin") is True

    def test_instructional_can_draft(self) -> None:
        assert compute_can_draft("instructional") is True

    def test_staff_cannot_draft(self) -> None:
        assert compute_can_draft("staff") is False

    def test_learner_cannot_draft(self) -> None:
        assert compute_can_draft("learner") is False


# ========== show flags ==========


class TestShowFlags:
    def test_show_name_with_tools(self) -> None:
        assert compute_show_name(True) is True

    def test_show_name_without_tools(self) -> None:
        assert compute_show_name(False) is False

    def test_show_emails_with_tools(self) -> None:
        assert compute_show_emails(True) is True

    def test_show_request_limit_with_tools(self) -> None:
        assert compute_show_request_limit(True) is True

    def test_show_flag_always(self) -> None:
        assert compute_show_flag() is True

    def test_show_departments_with_items(self) -> None:
        assert compute_show_departments(3) is True

    def test_show_departments_empty(self) -> None:
        assert compute_show_departments(0) is False

    def test_show_cohorts_with_items(self) -> None:
        assert compute_show_cohorts(2) is True

    def test_show_cohorts_empty(self) -> None:
        assert compute_show_cohorts(0) is False
