/**
 * Department Picker Helper Utilities
 * Centralized logic for department picker defaults and transformations
 */

/**
 * Get default department IDs based on user role
 * @param isSuperadmin - Whether the user is a superadmin
 * @param primaryDepartmentId - The user's primary department ID (can be null)
 * @returns Default department IDs array (empty for superadmin, [primaryDepartmentId] for others)
 */
export function getDefaultDepartmentIds(
  isSuperadmin: boolean,
  primaryDepartmentId: string | null,
): string[] {
  if (isSuperadmin) return []; // Empty = all departments (default object)
  return primaryDepartmentId ? [primaryDepartmentId] : [];
}

/**
 * Transform department IDs for submission based on user role
 * - Superadmins can use empty array to create default objects (returns null)
 * - Non-superadmins: empty array transforms to all valid departments
 * @param departmentIds - Selected department IDs from form
 * @param isSuperadmin - Whether the user is a superadmin
 * @param validDepartmentIds - All valid department IDs for the user
 * @returns Transformed department IDs (null for default objects, array otherwise)
 */
export function transformDepartmentIdsForSubmit(
  departmentIds: string[],
  isSuperadmin: boolean,
  validDepartmentIds: string[],
): string[] | null {
  if (isSuperadmin) {
    // Superadmin can use empty array for default objects
    return departmentIds.length === 0 ? null : departmentIds;
  }
  // Non-superadmin: transform empty to all valid departments
  if (departmentIds.length === 0) {
    return validDepartmentIds.length > 0 ? validDepartmentIds : null;
  }
  return departmentIds;
}
