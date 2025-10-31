"use client";

import { Shield, User, UserPlus } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { CohortPicker } from "@/components/common/forms/CohortPicker";
import { DepartmentPicker } from "@/components/common/forms/DepartmentPicker";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useProfile } from "@/contexts/profile-context";
import { useLogger } from "@/lib/api/v2/hooks/logs";
import { useCreateOrUpdateStaff } from "@/lib/api/v2/hooks/profile";

type RoleValue = "superadmin" | "admin" | "instructional" | "ta" | "guest";

export interface ManualAddStaffModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  departmentId?: string;
  cohortId?: string;
  departmentMapping: Record<string, { name: string; description: string }>;
  validDepartmentIds: string[];
  cohortMapping: Record<string, { name: string; description: string }>;
  validCohortIds: string[];
  roleOptions: string[];
  onDone?: () => void;
}

const getRoleIcon = (role: string) => {
  switch (role) {
    case "superadmin":
    case "admin":
    case "instructional":
      return Shield;
    default:
      return User;
  }
};

const getRoleDisplayName = (role: string) => {
  switch (role) {
    case "superadmin":
      return "Super Administrator";
    case "admin":
      return "Administrator";
    case "instructional":
      return "Instructional Staff";
    case "instructor":
      return "Instructor";
    case "ta":
      return "Teaching Assistant";
    case "guest":
      return "Guest";
    default:
      return role.charAt(0).toUpperCase() + role.slice(1);
  }
};

const getRoleBadgeVariant = (role: string) => {
  switch (role) {
    case "superadmin":
    case "admin":
      return "destructive" as const;
    case "instructional":
      return "default" as const;
    case "instructor":
      return "secondary" as const;
    default:
      return "outline" as const;
  }
};

export default function ManualAddStaffModal({
  open,
  onOpenChange,
  departmentId,
  cohortId,
  departmentMapping,
  validDepartmentIds,
  cohortMapping,
  validCohortIds,
  roleOptions,
  onDone,
}: ManualAddStaffModalProps) {
  const { effectiveProfile } = useProfile();
  const log = useLogger();
  const createOrUpdateMutation = useCreateOrUpdateStaff();

  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    alias: "",
    role: "" as RoleValue | "",
    departmentId: departmentId || "",
    cohortId: cohortId || "",
  });

  const [formErrors, setFormErrors] = useState<{
    firstName?: string;
    lastName?: string;
    alias?: string;
    role?: string;
    departmentId?: string;
  }>({});

  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reset form when modal opens/closes or props change
  useEffect(() => {
    if (open) {
      setFormData({
        firstName: "",
        lastName: "",
        alias: "",
        role: "",
        departmentId: departmentId || "",
        cohortId: cohortId || "",
      });
      setFormErrors({});
    }
  }, [open, departmentId, cohortId]);

  // Role availability based on user role
  const isCurrentUserSuperAdmin = effectiveProfile?.role === "superadmin";

  const availableRoles = useMemo(() => {
    const base: Array<{ value: RoleValue; label: string; icon: typeof User }> =
      [
        { value: "instructional", label: "Instructional", icon: Shield },
        { value: "ta", label: "Teaching Assistant", icon: User },
        { value: "guest", label: "Guest", icon: User },
      ];
    if (isCurrentUserSuperAdmin) {
      base.unshift({ value: "admin", label: "Administrator", icon: Shield });
      base.unshift({
        value: "superadmin",
        label: "Super Administrator",
        icon: Shield,
      });
    }
    return base.filter((role) => roleOptions.includes(role.value));
  }, [isCurrentUserSuperAdmin, roleOptions]);

  // Form validation
  const validateForm = useCallback(() => {
    const errors: {
      firstName?: string;
      lastName?: string;
      alias?: string;
      role?: string;
      departmentId?: string;
    } = {};

    if (!formData.firstName.trim()) {
      errors.firstName = "First name is required";
    } else if (formData.firstName.trim().length < 2) {
      errors.firstName = "First name must be at least 2 characters";
    }

    if (!formData.lastName.trim()) {
      errors.lastName = "Last name is required";
    } else if (formData.lastName.trim().length < 2) {
      errors.lastName = "Last name must be at least 2 characters";
    }

    if (!formData.alias.trim()) {
      errors.alias = "Alias is required";
    } else if (formData.alias.trim().length < 2) {
      errors.alias = "Alias must be at least 2 characters";
    } else if (!/^[a-zA-Z0-9._-]+$/.test(formData.alias.trim())) {
      errors.alias =
        "Alias can only contain letters, numbers, dots, underscores, and hyphens";
    }

    if (!formData.role) {
      errors.role = "Role is required";
    }


    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }, [formData, effectiveProfile?.role]);

  // Submit handler
  const handleSubmit = useCallback(async () => {
    if (!validateForm()) {
      toast.error("Please fix the form errors.");
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await createOrUpdateMutation.mutateAsync({
        firstName: formData.firstName.trim(),
        lastName: formData.lastName.trim(),
        alias: formData.alias.trim(),
        role: formData.role,
        department_id: formData.departmentId || null,
        cohort_id: formData.cohortId || null,
      });

      if (response.created) {
        toast.success(`Staff member created successfully!`);
      } else {
        toast.success(`Staff member updated successfully!`);
      }

      onOpenChange(false);
      if (onDone) {
        onDone();
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Failed to create or update staff member.";
      toast.error(errorMessage);
      log.error("staff.create_or_update.failed", {
        message: "Error creating or updating staff member",
        error,
        context: { component: "ManualAddStaffModal", function: "handleSubmit" },
      });
    } finally {
      setIsSubmitting(false);
    }
  }, [
    formData,
    validateForm,
    createOrUpdateMutation,
    onOpenChange,
    onDone,
    log,
  ]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Staff Member</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="firstName">First Name *</Label>
              <Input
                id="firstName"
                value={formData.firstName}
                onChange={(e) =>
                  setFormData((p) => ({ ...p, firstName: e.target.value }))
                }
                placeholder="First name"
                className={formErrors.firstName ? "border-red-500" : ""}
              />
              {formErrors.firstName && (
                <p className="text-sm text-red-500">{formErrors.firstName}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="lastName">Last Name *</Label>
              <Input
                id="lastName"
                value={formData.lastName}
                onChange={(e) =>
                  setFormData((p) => ({ ...p, lastName: e.target.value }))
                }
                placeholder="Last name"
                className={formErrors.lastName ? "border-red-500" : ""}
              />
              {formErrors.lastName && (
                <p className="text-sm text-red-500">{formErrors.lastName}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="alias">Alias *</Label>
              <Input
                id="alias"
                value={formData.alias}
                onChange={(e) =>
                  setFormData((p) => ({ ...p, alias: e.target.value }))
                }
                placeholder="Alias"
                className={formErrors.alias ? "border-red-500" : ""}
              />
              {formErrors.alias && (
                <p className="text-sm text-red-500">{formErrors.alias}</p>
              )}
            </div>
            <div className="space-y-2 w-full">
              <Label htmlFor="role">Role *</Label>
              <Select
                value={formData.role}
                onValueChange={(value: RoleValue) =>
                  setFormData((p) => ({ ...p, role: value }))
                }
              >
                <SelectTrigger
                  className={`w-full ${formErrors.role ? "border-red-500" : ""}`}
                >
                  <SelectValue placeholder="Select a role" />
                </SelectTrigger>
                <SelectContent>
                  {availableRoles.map((role) => {
                    const Icon = role.icon;
                    return (
                      <SelectItem key={role.value} value={role.value}>
                        <div className="flex items-center gap-2">
                          <Icon className="h-4 w-4" />
                          {role.label}
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
              {formErrors.role && (
                <p className="text-sm text-red-500">{formErrors.role}</p>
              )}
            </div>
          </div>

          {/* Department Selection */}
          {isCurrentUserSuperAdmin && (
            <div className="space-y-2">
              <Label htmlFor="department">Department</Label>
              <DepartmentPicker
                mapping={departmentMapping}
                validIds={validDepartmentIds}
                selectedIds={
                  formData.departmentId ? [formData.departmentId] : []
                }
                onSelect={(ids) =>
                  setFormData((p) => ({
                    ...p,
                    departmentId: ids[0] || "",
                  }))
                }
                placeholder="Select department"
                multiSelect={false}
              />
              {formErrors.departmentId && (
                <p className="text-sm text-red-500">
                  {formErrors.departmentId}
                </p>
              )}
              <p className="text-sm text-muted-foreground">
                Choose which department this staff member belongs to. Leave
                blank for global access.
              </p>
            </div>
          )}

          {/* Cohort Selection */}
          <div className="space-y-2">
            <Label htmlFor="cohort">Cohort (Optional)</Label>
            <CohortPicker
              mapping={cohortMapping}
              validIds={validCohortIds}
              selectedIds={formData.cohortId ? [formData.cohortId] : []}
              onSelect={(ids) =>
                setFormData((p) => ({
                  ...p,
                  cohortId: ids[0] || "",
                }))
              }
              placeholder="Select cohort"
              multiSelect={false}
            />
            <p className="text-sm text-muted-foreground">
              Optionally assign this staff member to a cohort.
            </p>
          </div>

          {/* Role description */}
          {formData.role && (
            <div className="p-4 bg-muted rounded-md">
              <div className="flex items-center gap-2 mb-2">
                {(() => {
                  const RoleIcon = getRoleIcon(formData.role);
                  return <RoleIcon className="h-4 w-4" />;
                })()}
                <Badge variant={getRoleBadgeVariant(formData.role)}>
                  {getRoleDisplayName(formData.role)}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                {formData.role === "superadmin" &&
                  "Will have full access and user management permissions, plus system-wide settings."}
                {formData.role === "admin" &&
                  "Will have full access and user management permissions."}
                {formData.role === "instructional" &&
                  "Will have permissions to manage teaching assistants."}
                {formData.role === "ta" &&
                  "Will have permissions to take simulations and see their history."}
                {formData.role === "guest" &&
                  "Will only have access to practice simulations."}
              </p>
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="flex items-center gap-2"
            >
              <UserPlus className="h-4 w-4" />
              {isSubmitting ? "Saving..." : "Save Staff Member"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
