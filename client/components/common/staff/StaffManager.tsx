"use client";

import { useRouter } from "next/navigation";
import React, { useCallback, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { DepartmentSelector } from "@/components/common/forms/DepartmentSelector";
import { useDepartments } from "@/contexts/departments-context";
import { useProfile } from "@/contexts/profile-context";
import {
  useCohortsByDepartmentIdBatch,
  useUpdateCohorts,
} from "@/lib/api/hooks/cohorts";
import { useDepartments as useDepartmentsHook } from "@/lib/api/hooks/departments";
import { useCreateProfiles, useProfiles } from "@/lib/api/hooks/profiles";
import { Profile } from "@/types";
import { getProfileByAlias } from "@/utils/auth/get-profile-by-alias";
import { profileRole } from "@/utils/drizzle/schema";
import { log } from "@/utils/logger";
import {
  Check,
  Download,
  Search,
  Shield,
  Upload,
  User,
  UserPlus,
  X,
} from "lucide-react";

// Helper function to extract alias from email
const extractAliasFromEmail = (email: string): string => {
  if (!email || !email.includes("@")) return email;
  const parts = email.split("@");
  return parts[0]?.trim() || email;
};

// Simple CSV helpers
const parseCSV = (csvText: string): Record<string, string>[] => {
  const lines = csvText.split("\n");
  if (lines.length < 2) return [];
  const headers = lines[0]?.split(",").map((h) => h.trim()) || [];
  const data: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    if (lines[i]?.trim()) {
      const values = lines[i]?.split(",").map((v) => v.trim()) || [];
      const row: Record<string, string> = {};
      headers.forEach((header, index) => {
        let value = values[index] || "";
        // If the header is "alias" and the value looks like an email, extract the alias
        if (header.toLowerCase() === "alias" && value.includes("@")) {
          value = extractAliasFromEmail(value);
        }
        row[header] = value;
      });
      data.push(row);
    }
  }
  return data;
};

const unparseCSV = (data: Record<string, string>[]): string => {
  if (data.length === 0) return "";
  const headers = Object.keys(data[0] || {});
  const csvContent = [
    headers.join(","),
    ...data.map((row) => headers.map((header) => row[header]).join(",")),
  ];
  return csvContent.join("\n");
};

// Shared types for selected/preview profiles
type RoleValue = (typeof profileRole.enumValues)[number];

export interface StaffManagerProfile {
  id: string;
  firstName: string;
  lastName: string;
  alias: string;
  role: RoleValue;
  departmentId?: string;
  isNew: true;
  cohortName?: string | undefined; // used only in non-cohort mode for CSV with cohort assignment
}

export interface StaffManagerProps {
  cohortId?: string;
  onDone?: (() => void) | undefined;
  onAddProfiles?: ((profiles: StaffManagerProfile[]) => void) | undefined; // used in cohort mode
  existingProfileIds?: string[]; // optional override; if not provided, derived from cohort when cohortId is present
}

const getRoleIcon = (role: string) => {
  switch (role) {
    case "superadmin":
    case "admin":
    case "instructional":
      return Shield;
    case "instructor":
    case "ta":
    case "guest":
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
    case "ta":
    case "guest":
    default:
      return "outline" as const;
  }
};

export default function StaffManager({
  cohortId,
  onDone,
  onAddProfiles,
  existingProfileIds,
}: StaffManagerProps) {
  const router = useRouter();
  const isCohortMode = Boolean(cohortId);

  const { effectiveProfile } = useProfile();
  const { effectiveDepartmentIds } = useDepartments();
  const { data: departments = [] } = useDepartmentsHook();

  const { data: allProfiles = [], isLoading: isLoadingProfiles } =
    useProfiles();
  const { data: allCohorts = [] } = useCohortsByDepartmentIdBatch(
    effectiveDepartmentIds
  );

  // Mutation hooks
  const createProfilesMutation = useCreateProfiles();
  const updateCohortsMutation = useUpdateCohorts();

  // Compute cohort existing ids if in cohort mode
  const cohortExistingIds = useMemo(() => {
    if (!isCohortMode) return [] as string[];
    if (existingProfileIds && existingProfileIds.length > 0)
      return existingProfileIds;
    const cohort = allCohorts.find((c) => c.id === cohortId);
    return cohort ? (cohort.profileIds as string[]) : [];
  }, [isCohortMode, existingProfileIds, allCohorts, cohortId]);

  // Role availability (used in non-cohort mode manual add + CSV role validation)
  const isCurrentUserSuperAdmin = effectiveProfile?.role === "superadmin";

  const availableRoles = useMemo(() => {
    const base: Array<{ value: RoleValue; label: string; icon: typeof User }> =
      [
        { value: "instructional", label: "Instructional", icon: Shield },
        { value: "ta", label: "Teaching Assistant", icon: User },
        { value: "guest", label: "Guest", icon: User },
      ];
    // Only superadmin can assign admin and superadmin roles
    if (isCurrentUserSuperAdmin) {
      base.unshift({ value: "admin", label: "Administrator", icon: Shield });
      base.unshift({
        value: "superadmin",
        label: "Super Administrator",
        icon: Shield,
      });
    }
    return base;
  }, [isCurrentUserSuperAdmin]);

  // Alias validation
  const [isValidatingAlias, setIsValidatingAlias] = useState(false);
  const validateAlias = useCallback(async (alias: string): Promise<boolean> => {
    if (!alias.trim()) return false;
    setIsValidatingAlias(true);
    try {
      const existing = await getProfileByAlias(alias.trim());
      return !existing;
    } catch (error) {
      log.error("staff.alias.validate.failed", {
        message: "Error validating alias",
        error,
        context: { component: "StaffManager", function: "validateAlias" },
      });
      return false;
    } finally {
      setIsValidatingAlias(false);
    }
  }, []);

  // File input ref for CSV
  const csvInputRef = useRef<HTMLInputElement>(null);
  const handleCsvClick = useCallback(() => csvInputRef.current?.click(), []);

  // Non-cohort mode state (global staff creation)
  const [csvPreview, setCsvPreview] = useState<StaffManagerProfile[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [manualProfileGlobal, setManualProfileGlobal] = useState<{
    firstName: string;
    lastName: string;
    alias: string;
    role: RoleValue | "";
    departmentId: string;
  }>({ firstName: "", lastName: "", alias: "", role: "", departmentId: "" });

  // Cohort mode state (select and confirm)
  const [selectedProfiles, setSelectedProfiles] = useState<
    StaffManagerProfile[]
  >([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("csv");
  const [manualProfileCohort, setManualProfileCohort] = useState<{
    firstName: string;
    lastName: string;
    alias: string;
  }>({ firstName: "", lastName: "", alias: "" });

  // Form validation state
  const [cohortFormErrors, setCohortFormErrors] = useState<{
    firstName?: string;
    lastName?: string;
    alias?: string;
  }>({});
  const [globalFormErrors, setGlobalFormErrors] = useState<{
    firstName?: string;
    lastName?: string;
    alias?: string;
    role?: string;
    departmentId?: string;
  }>({});

  // Download templates
  const downloadTemplate = useCallback(() => {
    if (isCohortMode) {
      const template = [
        { alias: "jdoe", firstName: "John", lastName: "Doe" },
        { alias: "jsmith", firstName: "Jane", lastName: "Smith" },
      ];
      const csv = unparseCSV(template);
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");
      const url = URL.createObjectURL(blob);
      link.setAttribute("href", url);
      link.setAttribute("download", "cohort_staff_template.csv");
      link.style.visibility = "hidden";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else {
      const template = [
        {
          firstName: "Sarah",
          lastName: "Johnson",
          alias: "sjohnson",
          role: "instructional",
          cohortName: "Fall 2025 Training",
        },
        {
          firstName: "Jane",
          lastName: "Smith",
          alias: "jsmith",
          role: "instructional",
          cohortName: "Fall 2025 Training",
        },
        {
          firstName: "John",
          lastName: "Doe",
          alias: "jdoe",
          role: "ta",
          cohortName: "Fall 2025 Training",
        },
      ];
      const csv = unparseCSV(template);
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");
      const url = URL.createObjectURL(blob);
      link.setAttribute("href", url);
      link.setAttribute("download", "staff_template.csv");
      link.style.visibility = "hidden";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  }, [isCohortMode]);

  // CSV upload handlers
  const handleCsvUpload = useCallback(
    (file: File) => {
      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const csvText = (event.target?.result as string) || "";
          const rows = parseCSV(csvText);

          if (isCohortMode) {
            // Cohort mode behavior mirrors CohortAddStaff
            const newSel: StaffManagerProfile[] = [];
            const profilesToCreate: {
              firstName: string;
              lastName: string;
              alias: string;
              role: RoleValue;
            }[] = [];

            for (let index = 0; index < rows.length; index++) {
              const row = rows[index];
              if (!row) continue;
              const alias = (
                (row as Record<string, string>)["alias"] || ""
              ).trim();
              const firstName = (
                (row as Record<string, string>)["firstName"] || ""
              ).trim();
              const lastName = (
                (row as Record<string, string>)["lastName"] || ""
              ).trim();
              if (!alias) {
                toast.error(
                  `Row ${index + 1}: Missing required field 'alias'. Please ensure all rows have an alias value.`
                );
                continue;
              }

              // Default role in cohort mode
              const role: RoleValue = "ta";

              const existing = allProfiles.find(
                (p: Profile) => p.alias.toLowerCase() === alias.toLowerCase()
              );

              if (existing) {
                if (
                  !cohortExistingIds.includes(existing.id) &&
                  !selectedProfiles.find((sp) => sp.id === existing.id)
                ) {
                  newSel.push({
                    id: existing.id,
                    firstName: existing.firstName,
                    lastName: existing.lastName,
                    alias: existing.alias,
                    role: existing.role as RoleValue,
                    isNew: true,
                  });
                } else {
                  toast.error(
                    `Row ${index + 1}: Profile with alias "${alias}" already exists in this cohort.`
                  );
                }
              } else {
                if (firstName && lastName) {
                  const ok = await validateAlias(alias);
                  if (!ok) {
                    toast.error(
                      `Row ${index + 1}: Alias "${alias}" already exists in the system. Please use a unique alias.`
                    );
                    continue;
                  }
                  profilesToCreate.push({ firstName, lastName, alias, role });
                  newSel.push({
                    id: `new-${Date.now()}-${index}`,
                    firstName,
                    lastName,
                    alias,
                    role,
                    isNew: true,
                  });
                } else {
                  toast.warning(
                    `Row ${index + 1}: Skipping "${alias}" - firstName and lastName are required for creating new profiles. Please provide both fields.`
                  );
                }
              }
            }

            if (profilesToCreate.length > 0) {
              try {
                const created =
                  await createProfilesMutation.mutateAsync(profilesToCreate);
                // update temp ids to real ids in insertion order for newly created ones
                let createdIdx = 0;
                for (let i = 0; i < newSel.length; i++) {
                  const item = newSel[i];
                  if (!item) continue;
                  if (item.id.startsWith("new-")) {
                    const c = created?.[createdIdx++];
                    if (c) {
                      newSel[i] = { ...item, id: c.id };
                    }
                  }
                }
              } catch (error) {
                toast.error(
                  "Failed to create some profiles in the database. Please check your data and try again."
                );
                log.error("staff.bulk_create.failed", {
                  message: "Error creating profiles",
                  error,
                  context: {
                    component: "StaffManager",
                    function: "handleCsvUpload(cohort)",
                  },
                });
              }
            }

            if (newSel.length > 0) {
              setSelectedProfiles(newSel);
              toast.success(
                `Successfully processed ${newSel.length} profile(s) from CSV file.`
              );
            } else {
              toast.error(
                "No valid profiles found in CSV. Please check that your file contains the required columns and data."
              );
            }
          } else {
            // Global mode behavior mirrors NewStaff
            const newProfiles: StaffManagerProfile[] = [];
            for (let index = 0; index < rows.length; index++) {
              const r = rows[index];
              if (!r) continue;
              const firstName = (
                (r as Record<string, string>)["firstName"] || ""
              ).trim();
              const lastName = (
                (r as Record<string, string>)["lastName"] || ""
              ).trim();
              const alias = (
                (r as Record<string, string>)["alias"] || ""
              ).trim();
              const role = (
                (r as Record<string, string>)["role"] || ""
              ).trim() as RoleValue;
              const cohortName = (
                (r as Record<string, string>)["cohortName"] || ""
              ).trim();

              if (!firstName || !lastName || !alias) {
                toast.error(
                  `Row ${index + 1}: Missing required fields. Please ensure all rows have firstName, lastName, and alias values.`
                );
                continue;
              }
              if (!role) {
                toast.error(
                  `Row ${index + 1}: Missing required field 'role'. Please ensure all rows have a role value.`
                );
                continue;
              }
              if (!availableRoles.find((ar) => ar.value === role)) {
                toast.error(
                  `Row ${index + 1}: Invalid role "${role}". Valid roles are: ${availableRoles.map((r) => r.value).join(", ")}`
                );
                continue;
              }

              const existsLocal = allProfiles.find(
                (p: Profile) => p.alias.toLowerCase() === alias.toLowerCase()
              );
              if (existsLocal) {
                toast.error(
                  `Row ${index + 1}: Profile with alias "${alias}" already exists in the system. Please use a unique alias.`
                );
                continue;
              }
              const ok = await validateAlias(alias);
              if (!ok) {
                toast.error(
                  `Row ${index + 1}: Alias "${alias}" already exists in the system. Please use a unique alias.`
                );
                continue;
              }
              newProfiles.push({
                id: `new-${Date.now()}-${index}`,
                firstName,
                lastName,
                alias,
                role,
                isNew: true,
                ...(cohortName ? { cohortName } : {}),
              } as StaffManagerProfile);
            }

            if (newProfiles.length > 0) {
              setCsvPreview(newProfiles);
              toast.success(
                `Successfully processed ${newProfiles.length} profile(s) from CSV file.`
              );
            } else {
              toast.error(
                "No valid profiles found in CSV. Please check that your file contains the required columns and data."
              );
            }
          }
        } catch (error) {
          toast.error(
            `Error parsing CSV file: ${error instanceof Error ? error.message : "Unknown error occurred. Please check your file format."}`
          );
        }
      };
      reader.readAsText(file);
    },
    [
      isCohortMode,
      allProfiles,
      cohortExistingIds,
      selectedProfiles,
      availableRoles,
      validateAlias,
      createProfilesMutation,
    ]
  );

  const handleCsvInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
        const file = e.target.files[0];
        if (file) handleCsvUpload(file);
      }
    },
    [handleCsvUpload]
  );

  // Validation functions
  const validateCohortForm = useCallback(() => {
    const errors: { firstName?: string; lastName?: string; alias?: string } =
      {};

    if (!manualProfileCohort.firstName.trim()) {
      errors.firstName = "First name is required";
    } else if (manualProfileCohort.firstName.trim().length < 2) {
      errors.firstName = "First name must be at least 2 characters";
    }

    if (!manualProfileCohort.lastName.trim()) {
      errors.lastName = "Last name is required";
    } else if (manualProfileCohort.lastName.trim().length < 2) {
      errors.lastName = "Last name must be at least 2 characters";
    }

    if (!manualProfileCohort.alias.trim()) {
      errors.alias = "Alias is required";
    } else if (manualProfileCohort.alias.trim().length < 2) {
      errors.alias = "Alias must be at least 2 characters";
    } else if (!/^[a-zA-Z0-9._-]+$/.test(manualProfileCohort.alias.trim())) {
      errors.alias =
        "Alias can only contain letters, numbers, dots, underscores, and hyphens. For example, if the email is redacted@purdue.edu, enter pete";
    }

    setCohortFormErrors(errors);
    return Object.keys(errors).length === 0;
  }, [manualProfileCohort]);

  const validateGlobalForm = useCallback(() => {
    const errors: {
      firstName?: string;
      lastName?: string;
      alias?: string;
      role?: string;
      departmentId?: string;
    } = {};

    if (!manualProfileGlobal.firstName.trim()) {
      errors.firstName = "First name is required";
    } else if (manualProfileGlobal.firstName.trim().length < 2) {
      errors.firstName = "First name must be at least 2 characters";
    }

    if (!manualProfileGlobal.lastName.trim()) {
      errors.lastName = "Last name is required";
    } else if (manualProfileGlobal.lastName.trim().length < 2) {
      errors.lastName = "Last name must be at least 2 characters";
    }

    if (!manualProfileGlobal.alias.trim()) {
      errors.alias = "Alias is required";
    } else if (manualProfileGlobal.alias.trim().length < 2) {
      errors.alias = "Alias must be at least 2 characters";
    } else if (!/^[a-zA-Z0-9._-]+$/.test(manualProfileGlobal.alias.trim())) {
      errors.alias =
        "Alias can only contain letters, numbers, dots, underscores, and hyphens. For example, if the email is redacted@purdue.edu, enter pete";
    }

    if (!manualProfileGlobal.role) {
      errors.role = "Role is required";
    }

    // Department validation for superadmin
    if (
      effectiveProfile?.role === "superadmin" &&
      !manualProfileGlobal.departmentId
    ) {
      errors.departmentId =
        "Department selection is required for superadmin users";
    }

    setGlobalFormErrors(errors);
    return Object.keys(errors).length === 0;
  }, [manualProfileGlobal, effectiveProfile?.role]);

  // Global/manual add
  const addManualProfileGlobal = useCallback(async () => {
    if (!validateGlobalForm()) {
      toast.error("Please fix the form errors before submitting.");
      return;
    }
    const existsLocal = allProfiles.find(
      (p: Profile) =>
        p.alias.toLowerCase() === manualProfileGlobal.alias.toLowerCase()
    );
    if (existsLocal) {
      toast.error(
        "This alias already exists in the system. Please choose a different alias."
      );
      return;
    }
    const dupInPreview = csvPreview.find(
      (p) => p.alias.toLowerCase() === manualProfileGlobal.alias.toLowerCase()
    );
    if (dupInPreview) {
      toast.error(
        "This alias is already in your preview list. Please choose a different alias."
      );
      return;
    }
    const ok = await validateAlias(manualProfileGlobal.alias.trim());
    if (!ok) {
      toast.error(
        "This alias already exists in the system. Please choose a different alias."
      );
      return;
    }
    const tempId = `new-${Date.now()}`;
    const roleValue = manualProfileGlobal.role as RoleValue;
    setCsvPreview((prev) => [
      ...prev,
      {
        id: tempId,
        firstName: manualProfileGlobal.firstName.trim(),
        lastName: manualProfileGlobal.lastName.trim(),
        alias: manualProfileGlobal.alias.trim(),
        role: roleValue,
        ...(manualProfileGlobal.departmentId && {
          departmentId: manualProfileGlobal.departmentId,
        }),
        isNew: true,
      },
    ]);
    toast.success(
      `Added to preview: ${manualProfileGlobal.firstName} ${manualProfileGlobal.lastName} (${manualProfileGlobal.alias})`
    );
    setManualProfileGlobal({
      firstName: "",
      lastName: "",
      alias: "",
      role: "",
      departmentId: "",
    });
  }, [
    manualProfileGlobal,
    allProfiles,
    csvPreview,
    validateAlias,
    validateGlobalForm,
  ]);

  // Cohort/manual add (create immediately with TA role)
  const addManualProfileCohort = useCallback(async () => {
    if (!validateCohortForm()) {
      toast.error("Please fix the form errors before submitting.");
      return;
    }
    const existing = allProfiles.find(
      (p: Profile) =>
        p.alias.toLowerCase() === manualProfileCohort.alias.toLowerCase()
    );
    if (existing) {
      if (
        !cohortExistingIds.includes(existing.id) &&
        !selectedProfiles.find((sp) => sp.id === existing.id)
      ) {
        const newProfile: StaffManagerProfile = {
          id: existing.id,
          firstName: existing.firstName,
          lastName: existing.lastName,
          alias: existing.alias,
          role: existing.role as RoleValue,
          isNew: true,
        };
        setSelectedProfiles((prev) => [...prev, newProfile]);
        toast.success(
          `Added existing profile: ${existing.firstName} ${existing.lastName} (${existing.alias})`
        );
      } else {
        toast.error(
          "This profile already exists in the current cohort. Please select a different profile."
        );
      }
    } else {
      const ok = await validateAlias(manualProfileCohort.alias.trim());
      if (!ok) {
        toast.error(
          "This alias already exists in the system. Please choose a different alias."
        );
        return;
      }
      try {
        const created = await createProfilesMutation.mutateAsync([
          {
            firstName: manualProfileCohort.firstName.trim(),
            lastName: manualProfileCohort.lastName.trim(),
            alias: manualProfileCohort.alias.trim(),
            role: "ta" as RoleValue,
          },
        ]);
        if (created && created.length > 0) {
          const c = created[0];
          if (c) {
            const np: StaffManagerProfile = {
              id: c.id,
              firstName: c.firstName,
              lastName: c.lastName,
              alias: c.alias,
              role: c.role as RoleValue,
              isNew: true,
            };
            setSelectedProfiles((prev) => [...prev, np]);
            toast.success(
              `Successfully created and added new profile: ${c.firstName} ${c.lastName} (${c.alias})`
            );
          }
        }
      } catch (error) {
        toast.error(
          "Failed to create profile in the database. Please check your information and try again."
        );
        log.error("staff.create_profile.failed", {
          message: "Error creating profile",
          error,
          context: {
            component: "StaffManager",
            function: "addManualProfileCohort",
          },
        });
        return;
      }
    }
    setManualProfileCohort({ firstName: "", lastName: "", alias: "" });
  }, [
    manualProfileCohort,
    allProfiles,
    cohortExistingIds,
    selectedProfiles,
    validateAlias,
    validateCohortForm,
    createProfilesMutation,
  ]);

  // Non-cohort submit
  const handleCreateSubmit = useCallback(async () => {
    if (csvPreview.length === 0) return;
    setIsSubmitting(true);
    try {
      const created = await createProfilesMutation.mutateAsync(
        csvPreview.map((p) => ({
          firstName: p.firstName,
          lastName: p.lastName,
          alias: p.alias,
          role: p.role,
          departmentId: p.departmentId || "",
        }))
      );
      const idMap = new Map<string, string>();
      csvPreview.forEach((p, idx) => {
        const c = created[idx];
        if (p.id.startsWith("new-") && c) idMap.set(p.id, c.id);
      });
      const byCohort = new Map<string, StaffManagerProfile[]>();
      csvPreview.forEach((p) => {
        const cohortName = p.cohortName || "No Cohort";
        if (!byCohort.has(cohortName)) byCohort.set(cohortName, []);
        const realId = idMap.get(p.id) || p.id;
        byCohort.get(cohortName)!.push({ ...p, id: realId });
      });
      // Collect cohort updates for bulk operation
      const cohortUpdates: Array<{
        id: string;
        profileIds: string[];
        updatedAt: string;
      }> = [];
      const cohortUpdateMessages: string[] = [];
      const warningMessages: string[] = [];

      for (const [cohortName, profiles] of byCohort) {
        if (cohortName !== "No Cohort") {
          const cohort = allCohorts.find((c) => c.title === cohortName);
          if (cohort) {
            const updatedProfileIds = [
              ...cohort.profileIds,
              ...profiles.map((p) => p.id),
            ];
            cohortUpdates.push({
              id: cohort.id,
              profileIds: updatedProfileIds,
              updatedAt: new Date().toISOString(),
            });
            cohortUpdateMessages.push(
              `Added ${profiles.length} profile(s) to cohort "${cohortName}"`
            );
          } else {
            warningMessages.push(
              `Cohort "${cohortName}" not found. Profiles were created but not assigned to a cohort.`
            );
          }
        }
      }

      // Execute bulk cohort updates
      if (cohortUpdates.length > 0) {
        await updateCohortsMutation.mutateAsync({ updates: cohortUpdates });

        // Show success messages for each cohort
        cohortUpdateMessages.forEach((message) => {
          toast.success(message);
        });
      }

      // Show warning messages
      warningMessages.forEach((message) => {
        toast.warning(message);
      });
      toast.success(
        `Successfully created ${csvPreview.length} staff member(s)!`
      );
      // Always close the dialog after creating staff members
      if (onDone) onDone();
      else router.push("/management/staff");
    } catch (error) {
      log.error("staff.bulk_create.failed", {
        message: "Error creating staff members from CSV",
        error,
        context: { component: "StaffManager", function: "handleCreateSubmit" },
      });
      toast.error("Failed to create some staff members. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }, [
    csvPreview,
    allCohorts,
    onDone,
    router,
    createProfilesMutation,
    updateCohortsMutation,
  ]);

  const removeFromPreview = useCallback(
    (id: string) => setCsvPreview((prev) => prev.filter((p) => p.id !== id)),
    []
  );
  const removeSelectedProfile = useCallback(
    (id: string) =>
      setSelectedProfiles((prev) => prev.filter((p) => p.id !== id)),
    []
  );

  // Derived lists for cohort search
  const availableProfiles = useMemo(() => {
    if (!isCohortMode) return [] as Profile[];
    return (allProfiles as Profile[]).filter(
      (p) =>
        !cohortExistingIds.includes(p.id) &&
        !selectedProfiles.find((sp) => sp.id === p.id) &&
        (p.role === "instructional" || p.role === "ta") &&
        !p.defaultProfile
    );
  }, [isCohortMode, allProfiles, cohortExistingIds, selectedProfiles]);

  const filteredProfiles = useMemo(() => {
    if (!isCohortMode) return [] as Profile[];
    return availableProfiles.filter(
      (p) =>
        p.firstName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.lastName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.alias.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [isCohortMode, availableProfiles, searchQuery]);

  const addProfileFromSearch = useCallback((profile: Profile) => {
    const np: StaffManagerProfile = {
      id: profile.id,
      firstName: profile.firstName,
      lastName: profile.lastName,
      alias: profile.alias,
      role: profile.role as RoleValue,
      isNew: true,
    };
    setSelectedProfiles((prev) => {
      const exists = prev.find((p) => p.id === profile.id);
      if (exists) {
        toast.error(
          "This profile is already selected. Please choose a different profile."
        );
        return prev;
      }
      return [...prev, np];
    });
  }, []);

  const confirmAndAddToCohort = useCallback(() => {
    if (selectedProfiles.length === 0) {
      toast.error(
        "No profiles selected. Please select at least one profile to add to the cohort."
      );
      return;
    }
    if (onAddProfiles) onAddProfiles(selectedProfiles);
    setSelectedProfiles([]);
    setSearchQuery("");
    setActiveTab("csv");
    toast.success(
      `Successfully added ${selectedProfiles.length} profile(s) to the cohort.`
    );
    // Always close the dialog after adding profiles
    if (onDone) onDone();
  }, [selectedProfiles, onAddProfiles, onDone]);

  // Render
  return (
    <div
      className={
        isCohortMode
          ? "space-y-4"
          : "space-y-6 py-4 px-4 max-h-[80vh] overflow-y-auto"
      }
    >
      {isCohortMode ? (
        <>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-3 mb-4">
              <TabsTrigger value="csv" className="flex items-center gap-2">
                <Upload className="h-4 w-4" />
                CSV Import
              </TabsTrigger>
              <TabsTrigger value="search" className="flex items-center gap-2">
                <Search className="h-4 w-4" />
                Search Existing
              </TabsTrigger>
              <TabsTrigger value="manual" className="flex items-center gap-2">
                <UserPlus className="h-4 w-4" />
                Manual Add
              </TabsTrigger>
            </TabsList>

            <TabsContent value="csv" className="space-y-4">
              <div className="border-2 border-dashed rounded-lg p-6 text-center">
                <input
                  ref={csvInputRef}
                  type="file"
                  accept=".csv"
                  onChange={handleCsvInputChange}
                  className="hidden"
                />
                <p className="text-sm text-muted-foreground mt-2">
                  Supports .csv files with columns: alias (required), firstName
                  (required for new profiles), lastName (required for new
                  profiles).
                </p>
              </div>
              <div className="flex items-center justify-between">
                <Button
                  variant="secondary"
                  onClick={downloadTemplate}
                  className="flex items-center gap-2 border border-blue-500 text-blue-700 hover:bg-blue-50 hover:border-blue-600"
                  style={{ boxShadow: "0 0 0 2px #a5b4fc33" }}
                >
                  <Download className="h-4 w-4 text-indigo-500" />
                  <span className="font-semibold text-indigo-700">
                    Download Template
                  </span>
                </Button>
                <div className="flex items-center gap-2">
                  {selectedProfiles.length === 0 && (
                    <Button
                      variant="outline"
                      onClick={() => onDone && onDone()}
                      aria-label="Close"
                    >
                      Close
                    </Button>
                  )}
                  <Button
                    onClick={handleCsvClick}
                    className="flex items-center gap-2"
                  >
                    <Upload className="h-4 w-4" />
                    Choose CSV File
                  </Button>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="search" className="space-y-4">
              <div className="space-y-2">
                <Input
                  id="search"
                  placeholder="Search by name or alias..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <div className="max-h-60 overflow-y-auto space-y-2">
                {isLoadingProfiles ? (
                  <div className="text-center py-4">Loading profiles...</div>
                ) : filteredProfiles.length === 0 ? (
                  <div className="text-center py-4 text-muted-foreground">
                    {searchQuery
                      ? "No profiles found matching your search criteria"
                      : "No available profiles to add to this cohort"}
                  </div>
                ) : (
                  filteredProfiles.map((profile: Profile) => (
                    <Card key={profile.id} className="p-3">
                      <CardContent className="p-0">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-medium">
                                {profile.firstName} {profile.lastName}
                              </p>
                              {profile.role === "instructional" && (
                                <Badge variant="default" className="text-xs">
                                  INSTRUCTIONAL
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground">
                              {profile.alias}
                            </p>
                          </div>
                          <Button
                            size="sm"
                            onClick={() => addProfileFromSearch(profile)}
                          >
                            Add
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
              <div className="flex justify-end gap-2">
                {selectedProfiles.length === 0 && (
                  <Button variant="outline" onClick={() => onDone && onDone()}>
                    Close
                  </Button>
                )}
              </div>
            </TabsContent>

            <TabsContent value="manual" className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="firstName">First Name *</Label>
                  <Input
                    id="firstName"
                    value={manualProfileCohort.firstName}
                    onChange={(e) =>
                      setManualProfileCohort((prev) => ({
                        ...prev,
                        firstName: e.target.value,
                      }))
                    }
                    placeholder="First name"
                    className={
                      cohortFormErrors.firstName ? "border-red-500" : ""
                    }
                  />
                  {cohortFormErrors.firstName && (
                    <p className="text-sm text-red-500">
                      {cohortFormErrors.firstName}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">Last Name *</Label>
                  <Input
                    id="lastName"
                    value={manualProfileCohort.lastName}
                    onChange={(e) =>
                      setManualProfileCohort((prev) => ({
                        ...prev,
                        lastName: e.target.value,
                      }))
                    }
                    placeholder="Last name"
                    className={
                      cohortFormErrors.lastName ? "border-red-500" : ""
                    }
                  />
                  {cohortFormErrors.lastName && (
                    <p className="text-sm text-red-500">
                      {cohortFormErrors.lastName}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="alias">Alias *</Label>
                  <Input
                    id="alias"
                    value={manualProfileCohort.alias}
                    onChange={(e) =>
                      setManualProfileCohort((prev) => ({
                        ...prev,
                        alias: e.target.value,
                      }))
                    }
                    placeholder="Alias"
                    className={cohortFormErrors.alias ? "border-red-500" : ""}
                  />
                  {cohortFormErrors.alias && (
                    <p className="text-sm text-red-500">
                      {cohortFormErrors.alias}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex justify-end gap-2">
                {selectedProfiles.length === 0 && (
                  <Button
                    variant="outline"
                    onClick={() => onDone && onDone()}
                    aria-label="Close"
                  >
                    Close
                  </Button>
                )}
                <Button
                  onClick={addManualProfileCohort}
                  disabled={isValidatingAlias}
                  className="flex items-center gap-2"
                >
                  <UserPlus className="h-4 w-4" />
                  {isValidatingAlias ? "Validating..." : "Create GTA"}
                </Button>
              </div>
            </TabsContent>
          </Tabs>

          {selectedProfiles.length > 0 && (
            <div className="space-y-4 mt-6">
              <Separator className="my-6" />
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium">
                    Selected Profiles ({selectedProfiles.length})
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    These profiles will be added to the cohort
                  </p>
                </div>
                <Button
                  variant="destructive"
                  onClick={() => setSelectedProfiles([])}
                >
                  Clear All
                </Button>
              </div>
              <div className="max-h-60 overflow-y-auto space-y-2">
                {selectedProfiles.map((profile) => (
                  <Card key={profile.id} className="p-3">
                    <CardContent className="p-0">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <p className="font-medium">
                            {profile.firstName} {profile.lastName}
                          </p>
                          <Badge variant="secondary" className="text-xs">
                            NEW
                          </Badge>
                          {profile.role === "instructional" && (
                            <Badge variant="default" className="text-xs">
                              INSTRUCTIONAL
                            </Badge>
                          )}
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => removeSelectedProfile(profile.id)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {profile.alias}
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => onDone && onDone()}
                  aria-label="Close"
                >
                  Close
                </Button>
                <Button
                  onClick={confirmAndAddToCohort}
                  className="flex items-center gap-2"
                >
                  <Check className="h-4 w-4" />
                  Add to Cohort
                </Button>
              </div>
            </div>
          )}
        </>
      ) : (
        <>
          <Tabs defaultValue="csv" className="space-y-4 w-full">
            <TabsList className="grid grid-cols-2 w-full mb-4">
              <TabsTrigger
                value="csv"
                className="w-full flex items-center justify-center gap-2"
              >
                <Upload className="h-4 w-4" />
                CSV Import
              </TabsTrigger>
              <TabsTrigger
                value="manual"
                className="w-full flex items-center justify-center gap-2"
              >
                <UserPlus className="h-4 w-4" />
                Manual Add
              </TabsTrigger>
            </TabsList>

            <TabsContent value="csv">
              <div className="space-y-4">
                <div className="border-2 border-dashed rounded-lg p-6 text-center">
                  <input
                    ref={csvInputRef}
                    type="file"
                    accept=".csv"
                    onChange={handleCsvInputChange}
                    className="hidden"
                  />
                  <p className="text-sm text-muted-foreground mt-2">
                    Supports .csv files with columns: firstName (required),
                    lastName (required), alias (required), role (required),
                    cohortName (optional).
                  </p>
                </div>
                <div className="flex items-center justify-between">
                  <Button
                    variant="secondary"
                    onClick={downloadTemplate}
                    className="flex items-center gap-2 border border-blue-500 text-blue-700 hover:bg-blue-50 hover:border-blue-600"
                    style={{ boxShadow: "0 0 0 2px #a5b4fc33" }}
                  >
                    <Download className="h-4 w-4 text-indigo-500" />
                    <span className="font-semibold text-indigo-700">
                      Download Template
                    </span>
                  </Button>
                  <div className="flex items-center gap-2">
                    {!(csvPreview.length > 0) && (
                      <Button
                        variant="outline"
                        onClick={() => onDone && onDone()}
                        aria-label="Close"
                      >
                        Close
                      </Button>
                    )}
                    <Button
                      onClick={handleCsvClick}
                      className="flex items-center gap-2"
                    >
                      <Upload className="h-4 w-4" />
                      Choose CSV File
                    </Button>
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="manual">
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="manualFirstName">First Name *</Label>
                    <Input
                      id="manualFirstName"
                      value={manualProfileGlobal.firstName}
                      onChange={(e) =>
                        setManualProfileGlobal((p) => ({
                          ...p,
                          firstName: e.target.value,
                        }))
                      }
                      placeholder="First name"
                      className={
                        globalFormErrors.firstName ? "border-red-500" : ""
                      }
                    />
                    {globalFormErrors.firstName && (
                      <p className="text-sm text-red-500">
                        {globalFormErrors.firstName}
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="manualLastName">Last Name *</Label>
                    <Input
                      id="manualLastName"
                      value={manualProfileGlobal.lastName}
                      onChange={(e) =>
                        setManualProfileGlobal((p) => ({
                          ...p,
                          lastName: e.target.value,
                        }))
                      }
                      placeholder="Last name"
                      className={
                        globalFormErrors.lastName ? "border-red-500" : ""
                      }
                    />
                    {globalFormErrors.lastName && (
                      <p className="text-sm text-red-500">
                        {globalFormErrors.lastName}
                      </p>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="manualAlias">Alias *</Label>
                    <Input
                      id="manualAlias"
                      value={manualProfileGlobal.alias}
                      onChange={(e) =>
                        setManualProfileGlobal((p) => ({
                          ...p,
                          alias: e.target.value,
                        }))
                      }
                      placeholder="Alias"
                      className={globalFormErrors.alias ? "border-red-500" : ""}
                    />
                    {globalFormErrors.alias && (
                      <p className="text-sm text-red-500">
                        {globalFormErrors.alias}
                      </p>
                    )}
                  </div>
                  <div className="space-y-2 w-full">
                    <Label htmlFor="manualRole">Role *</Label>
                    <Select
                      value={manualProfileGlobal.role}
                      onValueChange={(value: RoleValue) =>
                        setManualProfileGlobal((p) => ({ ...p, role: value }))
                      }
                    >
                      <SelectTrigger
                        className={`w-full ${globalFormErrors.role ? "border-red-500" : ""}`}
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
                    {globalFormErrors.role && (
                      <p className="text-sm text-red-500">
                        {globalFormErrors.role}
                      </p>
                    )}
                  </div>
                </div>

                {/* Department Selection - Only for superadmin */}
                {effectiveProfile?.role === "superadmin" && (
                  <div className="space-y-2">
                    <Label htmlFor="department">Department</Label>
                    <DepartmentSelector
                      departments={departments.map((dept) => ({
                        id: dept.id,
                        title: dept.title as string,
                        ...(dept.description && {
                          description: dept.description,
                        }),
                      }))}
                      selectedDepartment={
                        manualProfileGlobal.departmentId
                          ? (() => {
                              const dept = departments.find(
                                (d) => d.id === manualProfileGlobal.departmentId
                              );
                              return dept
                                ? {
                                    id: dept.id,
                                    title: dept.title as string,
                                    ...(dept.description && {
                                      description: dept.description,
                                    }),
                                  }
                                : null;
                            })()
                          : null
                      }
                      onSelect={(department) =>
                        setManualProfileGlobal((p) => ({
                          ...p,
                          departmentId: department?.id || "",
                        }))
                      }
                      placeholder="Select department"
                    />
                    {globalFormErrors.departmentId && (
                      <p className="text-sm text-red-500">
                        {globalFormErrors.departmentId}
                      </p>
                    )}
                    <p className="text-sm text-muted-foreground">
                      Choose which department this staff member belongs to.
                      Leave blank for global access.
                    </p>
                  </div>
                )}

                {manualProfileGlobal.role && (
                  <div className="p-4 bg-muted rounded-md">
                    <div className="flex items-center gap-2 mb-2">
                      {(() => {
                        const RoleIcon = getRoleIcon(manualProfileGlobal.role);
                        return <RoleIcon className="h-4 w-4" />;
                      })()}
                      <Badge
                        variant={getRoleBadgeVariant(manualProfileGlobal.role)}
                      >
                        {getRoleDisplayName(manualProfileGlobal.role)}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {manualProfileGlobal.role === "superadmin" &&
                        "Will have full access and user management permissions, plus system-wide settings."}
                      {manualProfileGlobal.role === "admin" &&
                        "Will have full access and user management permissions."}
                      {manualProfileGlobal.role === "instructional" &&
                        "Will have permissions to manage teaching assistants."}
                      {manualProfileGlobal.role === "ta" &&
                        "Will have permissions to take simulations and see their history."}
                      {manualProfileGlobal.role === "guest" &&
                        "Will only have access to practice simulations."}
                    </p>
                  </div>
                )}

                <div className="flex items-center justify-end gap-2">
                  {csvPreview.length === 0 && (
                    <Button
                      variant="outline"
                      onClick={() => onDone && onDone()}
                      aria-label="Close"
                    >
                      Close
                    </Button>
                  )}
                  <Button
                    onClick={addManualProfileGlobal}
                    disabled={isValidatingAlias}
                    className="flex items-center gap-2"
                  >
                    <UserPlus className="h-4 w-4" />
                    {isValidatingAlias ? "Validating..." : "Add Staff"}
                  </Button>
                </div>
              </div>
            </TabsContent>
          </Tabs>

          {csvPreview.length > 0 && <Separator className="my-6" />}
          {csvPreview.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium">
                  Preview ({csvPreview.length} users)
                </h3>
                <Button variant="destructive" onClick={() => setCsvPreview([])}>
                  Clear All
                </Button>
              </div>
              <div className="rounded-md border max-h-96 overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>First Name</TableHead>
                      <TableHead>Last Name</TableHead>
                      <TableHead>Username</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Cohort</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {csvPreview.map((user) => {
                      const RoleIcon = getRoleIcon(user.role);
                      return (
                        <TableRow key={user.id}>
                          <TableCell>{user.firstName}</TableCell>
                          <TableCell>{user.lastName}</TableCell>
                          <TableCell>{user.alias}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <RoleIcon className="h-4 w-4" />
                              <Badge variant={getRoleBadgeVariant(user.role)}>
                                {getRoleDisplayName(user.role)}
                              </Badge>
                            </div>
                          </TableCell>
                          <TableCell>
                            {user.cohortName ? (
                              <Badge variant="secondary">
                                {user.cohortName}
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground">
                                No cohort
                              </span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => removeFromPreview(user.id)}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              {csvPreview.some((p) => p.cohortName) && (
                <div className="space-y-2">
                  <Label>Cohort Assignment Summary</Label>
                  <div className="space-y-2">
                    {Array.from(
                      new Set(
                        csvPreview
                          .map((u) => u.cohortName)
                          .filter(Boolean) as string[]
                      )
                    ).map((cohortName) => {
                      const userCount = csvPreview.filter(
                        (u) => u.cohortName === cohortName
                      ).length;
                      const cohort = allCohorts.find(
                        (c) => c.title === cohortName
                      );
                      return (
                        <div
                          key={cohortName}
                          className={
                            cohort
                              ? "p-3 bg-muted rounded-md"
                              : "p-3 rounded-md border border-red-200 bg-red-50"
                          }
                        >
                          <div className="flex items-center gap-2 mb-2">
                            <Badge variant={cohort ? "default" : "destructive"}>
                              {cohortName}
                            </Badge>
                            <span
                              className={
                                cohort
                                  ? "text-sm text-muted-foreground"
                                  : "text-sm text-red-700"
                              }
                            >
                              ({userCount} user{userCount !== 1 ? "s" : ""})
                            </span>
                          </div>
                          <p
                            className={
                              cohort
                                ? "text-sm text-muted-foreground"
                                : "text-sm text-red-700"
                            }
                          >
                            {cohort
                              ? `Will add ${userCount} profile(s) to existing cohort "${cohortName}"`
                              : `Cohort "${cohortName}" not found. Profiles will be created but not assigned to a cohort.`}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="flex justify-end items-center gap-2">
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    onClick={() => onDone && onDone()}
                    aria-label="Close"
                  >
                    Close
                  </Button>
                  <Button onClick={handleCreateSubmit} disabled={isSubmitting}>
                    {isSubmitting
                      ? "Creating..."
                      : `Create ${csvPreview.length} Staff Members`}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
