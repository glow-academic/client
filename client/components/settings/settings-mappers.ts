/**
 * Settings mapper functions - build mappings from API responses
 */

import type {
  DepartmentsListOut,
  KeysListOut,
  StaffListOut,
} from "@/app/(main)/settings/page";

export interface ProfileMappingItem {
  profile_id: string;
  name: string;
  role: string;
  first_name: string;
  last_name: string;
}

/**
 * Build key mapping from keys list
 */
export function buildKeyMapping(keysList: KeysListOut): Record<
  string,
  {
    name: string;
    description: string;
    key_masked: string;
    active: boolean;
    department_ids: string[] | null;
  }
> {
  const mapping: Record<
    string,
    {
      name: string;
      description: string;
      key_masked: string;
      active: boolean;
      department_ids: string[] | null;
    }
  > = {};
  (keysList.keys || []).forEach((key) => {
    if (!key.key_id) return;
    mapping[key.key_id] = {
      name: key.name || "",
      description: key.description || "",
      key_masked: key.key_masked || "",
      active: key.active ?? false,
      department_ids: key.department_ids || null,
    };
  });
  return mapping;
}

/**
 * Build profile mapping from staff list
 */
export function buildProfileMapping(
  staffList: StaffListOut
): Record<string, ProfileMappingItem> {
  const mapping: Record<string, ProfileMappingItem> = {};
  (staffList.staff || []).forEach((staff) => {
    if (!staff.profile_id) return;
    mapping[staff.profile_id] = {
      profile_id: staff.profile_id,
      name: staff.name || "",
      role: staff.role || "",
      first_name: staff.first_name || "",
      last_name: staff.last_name || "",
    };
  });
  return mapping;
}

/**
 * Build department mapping from departments list
 */
export function buildDepartmentMapping(
  departmentsList: DepartmentsListOut
): Record<string, { name: string; description: string }> {
  const mapping: Record<string, { name: string; description: string }> = {};
  (departmentsList.departments || []).forEach((dept) => {
    if (!dept.department_id) return;
    mapping[dept.department_id] = {
      name: dept.title || "",
      description: dept.description || "",
    };
  });
  return mapping;
}

/**
 * Get valid profile IDs from staff list
 */
export function getValidProfileIds(staffList: StaffListOut): string[] {
  return (staffList.staff || [])
    .map((staff) => staff.profile_id)
    .filter((id): id is string => id !== null && id !== undefined);
}

/**
 * Get valid department IDs from departments list
 */
export function getValidDepartmentIds(
  departmentsList: DepartmentsListOut
): string[] {
  return (departmentsList.departments || [])
    .map((dept) => dept.department_id)
    .filter((id): id is string => id !== null && id !== undefined);
}

/**
 * Get valid key IDs from keys list
 */
export function getValidKeyIds(keysList: KeysListOut): string[] {
  return (keysList.keys || [])
    .map((key) => key.key_id)
    .filter((id): id is string => id !== null && id !== undefined);
}

/**
 * Filter profiles by role
 */
export function filterProfilesByRole(
  profileMapping: Record<string, ProfileMappingItem>,
  role: string
): string[] {
  return Object.values(profileMapping)
    .filter((profile) => profile.role === role)
    .map((profile) => profile.profile_id);
}

