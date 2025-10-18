"use client";

import { useRouter } from "next/navigation";
import React, { useCallback, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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

import { DepartmentPicker } from "@/components/common/forms/DepartmentPicker";
import { useProfile } from "@/contexts/profile-context";
import { useLogger } from "@/lib/api/v2/hooks/logs";
import {
  useBulkCreateProfile,
  useProfileList,
} from "@/lib/api/v2/hooks/profile";
import { getProfileByAlias } from "@/utils/auth/get-profile-by-alias";
import { Download, Shield, Upload, User, UserPlus, X } from "lucide-react";

// Helper to extract alias from email
const extractAliasFromEmail = (email: string): string => {
  if (!email || !email.includes("@")) return email;
  const parts = email.split("@");
  return parts[0]?.trim() || email;
};

// CSV helpers
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

// Role helpers
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

type RoleValue = "superadmin" | "admin" | "instructional" | "ta" | "guest";

export interface PreviewProfile {
  id: string;
  firstName: string;
  lastName: string;
  alias: string;
  role: RoleValue;
  departmentId?: string;
  cohortName?: string;
}

export interface CreateStaffProps {
  onDone?: () => void;
}

export default function CreateStaff({ onDone }: CreateStaffProps) {
  const router = useRouter();
  const { effectiveProfile, departmentIds } = useProfile();
  const log = useLogger();
  // Fetch all data with single v2 call
  const { data: profileListResponse } = useProfileList({
    departmentIds: departmentIds,
    profileId: effectiveProfile?.id || "",
  });

  const allProfiles = useMemo(
    () => profileListResponse?.staff || [],
    [profileListResponse?.staff]
  );

  const departmentMapping = useMemo(
    () => profileListResponse?.department_mapping || {},
    [profileListResponse?.department_mapping]
  );

  // Transform department mapping for DepartmentPicker
  const departmentPickerMapping = useMemo(() => {
    const mapping: Record<string, { name: string; description: string }> = {};
    Object.entries(departmentMapping).forEach(([id, dept]) => {
      mapping[id] = {
        name: dept.name,
        description: dept.description || "",
      };
    });
    return mapping;
  }, [departmentMapping]);

  const validDepartmentIds = useMemo(() => {
    return Object.keys(departmentMapping);
  }, [departmentMapping]);

  // Mutation
  const bulkCreateProfileMutation = useBulkCreateProfile();

  // State
  const [csvPreview, setCsvPreview] = useState<PreviewProfile[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [manualProfile, setManualProfile] = useState({
    firstName: "",
    lastName: "",
    alias: "",
    role: "" as RoleValue | "",
    departmentId: "",
  });
  const [formErrors, setFormErrors] = useState<{
    firstName?: string;
    lastName?: string;
    alias?: string;
    role?: string;
    departmentId?: string;
  }>({});
  const [isValidatingAlias, setIsValidatingAlias] = useState(false);

  const csvInputRef = useRef<HTMLInputElement>(null);

  // Role availability
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
    return base;
  }, [isCurrentUserSuperAdmin]);

  // Alias validation
  const validateAlias = useCallback(
    async (alias: string): Promise<boolean> => {
      if (!alias.trim()) return false;
      setIsValidatingAlias(true);
      try {
        const existing = await getProfileByAlias(alias.trim());
        return !existing;
      } catch (error) {
        log.error("staff.alias.validate.failed", {
          message: "Error validating alias",
          error,
          context: { component: "CreateStaff", function: "validateAlias" },
        });
        return false;
      } finally {
        setIsValidatingAlias(false);
      }
    },
    [log]
  );

  // Download template
  const downloadTemplate = useCallback(() => {
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
  }, []);

  // CSV upload handler
  const handleCsvUpload = useCallback(
    (file: File) => {
      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const csvText = (event.target?.result as string) || "";
          const rows = parseCSV(csvText);

          const newProfiles: PreviewProfile[] = [];
          for (let index = 0; index < rows.length; index++) {
            const r = rows[index];
            if (!r) continue;

            const firstName = (r["firstName"] || "").trim();
            const lastName = (r["lastName"] || "").trim();
            const alias = (r["alias"] || "").trim();
            const role = (r["role"] || "").trim() as RoleValue;
            const cohortName = (r["cohortName"] || "").trim();

            if (!firstName || !lastName || !alias) {
              toast.error(
                `Row ${index + 1}: Missing required fields (firstName, lastName, alias).`
              );
              continue;
            }
            if (!role) {
              toast.error(`Row ${index + 1}: Missing required field 'role'.`);
              continue;
            }
            if (!availableRoles.find((ar) => ar.value === role)) {
              toast.error(
                `Row ${index + 1}: Invalid role "${role}". Valid roles are: ${availableRoles.map((r) => r.value).join(", ")}`
              );
              continue;
            }

            const existsLocal = allProfiles.find(
              (p) => p.alias.toLowerCase() === alias.toLowerCase()
            );
            if (existsLocal) {
              toast.error(
                `Row ${index + 1}: Profile with alias "${alias}" already exists.`
              );
              continue;
            }
            const ok = await validateAlias(alias);
            if (!ok) {
              toast.error(`Row ${index + 1}: Alias "${alias}" already exists.`);
              continue;
            }

            newProfiles.push({
              id: `new-${Date.now()}-${index}`,
              firstName,
              lastName,
              alias,
              role,
              ...(cohortName ? { cohortName } : {}),
            } as PreviewProfile);
          }

          if (newProfiles.length > 0) {
            setCsvPreview(newProfiles);
            toast.success(
              `Successfully processed ${newProfiles.length} profile(s).`
            );
          } else {
            toast.error("No valid profiles found in CSV.");
          }
        } catch (error) {
          toast.error(
            `Error parsing CSV: ${error instanceof Error ? error.message : "Unknown error"}`
          );
        }
      };
      reader.readAsText(file);
    },
    [allProfiles, availableRoles, validateAlias]
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

  // Form validation
  const validateForm = useCallback(() => {
    const errors: {
      firstName?: string;
      lastName?: string;
      alias?: string;
      role?: string;
      departmentId?: string;
    } = {};

    if (!manualProfile.firstName.trim()) {
      errors.firstName = "First name is required";
    } else if (manualProfile.firstName.trim().length < 2) {
      errors.firstName = "First name must be at least 2 characters";
    }

    if (!manualProfile.lastName.trim()) {
      errors.lastName = "Last name is required";
    } else if (manualProfile.lastName.trim().length < 2) {
      errors.lastName = "Last name must be at least 2 characters";
    }

    if (!manualProfile.alias.trim()) {
      errors.alias = "Alias is required";
    } else if (manualProfile.alias.trim().length < 2) {
      errors.alias = "Alias must be at least 2 characters";
    } else if (!/^[a-zA-Z0-9._-]+$/.test(manualProfile.alias.trim())) {
      errors.alias =
        "Alias can only contain letters, numbers, dots, underscores, and hyphens";
    }

    if (!manualProfile.role) {
      errors.role = "Role is required";
    }

    if (
      effectiveProfile?.role === "superadmin" &&
      !manualProfile.departmentId
    ) {
      errors.departmentId = "Department selection is required for superadmin";
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }, [manualProfile, effectiveProfile?.role]);

  // Manual add
  const addManualProfile = useCallback(async () => {
    if (!validateForm()) {
      toast.error("Please fix the form errors.");
      return;
    }

    const existsLocal = allProfiles.find(
      (p) => p.alias.toLowerCase() === manualProfile.alias.toLowerCase()
    );
    if (existsLocal) {
      toast.error("This alias already exists.");
      return;
    }
    const dupInPreview = csvPreview.find(
      (p) => p.alias.toLowerCase() === manualProfile.alias.toLowerCase()
    );
    if (dupInPreview) {
      toast.error("This alias is already in your preview list.");
      return;
    }
    const ok = await validateAlias(manualProfile.alias.trim());
    if (!ok) {
      toast.error("This alias already exists.");
      return;
    }

    const tempId = `new-${Date.now()}`;
    const roleValue = manualProfile.role as RoleValue;
    setCsvPreview((prev) => [
      ...prev,
      {
        id: tempId,
        firstName: manualProfile.firstName.trim(),
        lastName: manualProfile.lastName.trim(),
        alias: manualProfile.alias.trim(),
        role: roleValue,
        ...(manualProfile.departmentId && {
          departmentId: manualProfile.departmentId,
        }),
      },
    ]);
    toast.success(
      `Added to preview: ${manualProfile.firstName} ${manualProfile.lastName}`
    );
    setManualProfile({
      firstName: "",
      lastName: "",
      alias: "",
      role: "",
      departmentId: "",
    });
  }, [manualProfile, allProfiles, csvPreview, validateAlias, validateForm]);

  // Submit
  const handleCreateSubmit = useCallback(async () => {
    if (csvPreview.length === 0) return;
    setIsSubmitting(true);

    try {
      await bulkCreateProfileMutation.mutateAsync({
        profiles: csvPreview.map((p) => ({
          firstName: p.firstName,
          lastName: p.lastName,
          alias: p.alias,
          role: p.role,
          department_id: p.departmentId || undefined,
        })),
      });

      toast.success(
        `Successfully created ${csvPreview.length} staff member(s)!`
      );
      setCsvPreview([]);
      if (onDone) onDone();
      else router.push("/management/staff");
    } catch (error) {
      log.error("staff.bulk_create.failed", {
        message: "Error creating staff members",
        error,
        context: { component: "CreateStaff", function: "handleCreateSubmit" },
      });
      toast.error("Failed to create some staff members.");
    } finally {
      setIsSubmitting(false);
    }
  }, [csvPreview, bulkCreateProfileMutation, onDone, router, log]);

  const removeFromPreview = useCallback(
    (id: string) => setCsvPreview((prev) => prev.filter((p) => p.id !== id)),
    []
  );

  return (
    <div className="space-y-6 py-4 px-4 max-h-[80vh] overflow-y-auto">
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
                Supports .csv files with columns: firstName (required), lastName
                (required), alias (required), role (required), cohortName
                (optional).
              </p>
            </div>
            <div className="flex items-center justify-between">
              <Button
                variant="secondary"
                onClick={downloadTemplate}
                className="flex items-center gap-2 border border-blue-500 text-blue-700 hover:bg-blue-50"
              >
                <Download className="h-4 w-4 text-indigo-500" />
                <span className="font-semibold text-indigo-700">
                  Download Template
                </span>
              </Button>
              <div className="flex items-center gap-2">
                {csvPreview.length === 0 && (
                  <Button variant="outline" onClick={() => onDone && onDone()}>
                    Close
                  </Button>
                )}
                <Button
                  onClick={() => csvInputRef.current?.click()}
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
                  value={manualProfile.firstName}
                  onChange={(e) =>
                    setManualProfile((p) => ({
                      ...p,
                      firstName: e.target.value,
                    }))
                  }
                  placeholder="First name"
                  className={formErrors.firstName ? "border-red-500" : ""}
                />
                {formErrors.firstName && (
                  <p className="text-sm text-red-500">{formErrors.firstName}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="manualLastName">Last Name *</Label>
                <Input
                  id="manualLastName"
                  value={manualProfile.lastName}
                  onChange={(e) =>
                    setManualProfile((p) => ({
                      ...p,
                      lastName: e.target.value,
                    }))
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
                <Label htmlFor="manualAlias">Alias *</Label>
                <Input
                  id="manualAlias"
                  value={manualProfile.alias}
                  onChange={(e) =>
                    setManualProfile((p) => ({
                      ...p,
                      alias: e.target.value,
                    }))
                  }
                  placeholder="Alias"
                  className={formErrors.alias ? "border-red-500" : ""}
                />
                {formErrors.alias && (
                  <p className="text-sm text-red-500">{formErrors.alias}</p>
                )}
              </div>
              <div className="space-y-2 w-full">
                <Label htmlFor="manualRole">Role *</Label>
                <Select
                  value={manualProfile.role}
                  onValueChange={(value: RoleValue) =>
                    setManualProfile((p) => ({ ...p, role: value }))
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

            {/* Department Selection - Only for superadmin */}
            {effectiveProfile?.role === "superadmin" && (
              <div className="space-y-2">
                <Label htmlFor="department">Department</Label>
                <DepartmentPicker
                  mapping={departmentPickerMapping}
                  validIds={validDepartmentIds}
                  selectedIds={
                    manualProfile.departmentId
                      ? [manualProfile.departmentId]
                      : []
                  }
                  onSelect={(ids) =>
                    setManualProfile((p) => ({
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

            {manualProfile.role && (
              <div className="p-4 bg-muted rounded-md">
                <div className="flex items-center gap-2 mb-2">
                  {(() => {
                    const RoleIcon = getRoleIcon(manualProfile.role);
                    return <RoleIcon className="h-4 w-4" />;
                  })()}
                  <Badge variant={getRoleBadgeVariant(manualProfile.role)}>
                    {getRoleDisplayName(manualProfile.role)}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  {manualProfile.role === "superadmin" &&
                    "Will have full access and user management permissions, plus system-wide settings."}
                  {manualProfile.role === "admin" &&
                    "Will have full access and user management permissions."}
                  {manualProfile.role === "instructional" &&
                    "Will have permissions to manage teaching assistants."}
                  {manualProfile.role === "ta" &&
                    "Will have permissions to take simulations and see their history."}
                  {manualProfile.role === "guest" &&
                    "Will only have access to practice simulations."}
                </p>
              </div>
            )}

            <div className="flex items-center justify-end gap-2">
              {csvPreview.length === 0 && (
                <Button variant="outline" onClick={() => onDone && onDone()}>
                  Close
                </Button>
              )}
              <Button
                onClick={addManualProfile}
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
                          <Badge variant="secondary">{user.cohortName}</Badge>
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

          <div className="flex justify-end items-center gap-2">
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={() => onDone && onDone()}>
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
    </div>
  );
}
