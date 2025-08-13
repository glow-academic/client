/**
 * NewStaff.tsx
 * Used to display the new staff page with enhanced CSV upload and manual creation capabilities.
 * @AshokSaravanan222 & @siladiea
 * 06/07/2025
 */

"use client";
import { useQuery } from "@tanstack/react-query";
import { Download, Shield, Upload, User, UserPlus, X } from "lucide-react";
import { useRouter } from "next/navigation";
import React, { useCallback, useRef, useState } from "react";
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
import { useProfile } from "@/contexts/profile-context";
import { Profile } from "@/types";
import { getProfileByAlias } from "@/utils/auth/get-profile-by-alias";
import { profileRole } from "@/utils/drizzle/schema";
import { log } from "@/utils/logger";
import { updateCohort } from "@/utils/mutations/cohorts/update-cohort";
import { createProfiles } from "@/utils/mutations/profiles/create-profiles";
import { getAllCohorts } from "@/utils/queries/cohorts/get-all-cohorts";
import { getAllProfiles } from "@/utils/queries/profiles/get-all-profiles";

type ProfileRole = (typeof profileRole.enumValues)[number];

// CSV Template interface
interface CSVRow {
  firstName: string;
  lastName: string;
  alias: string;
  role: ProfileRole;
  cohortName?: string;
}

// New profile interface
interface NewProfile {
  id: string;
  firstName: string;
  lastName: string;
  alias: string;
  role: ProfileRole;
  isNew: true;
  cohortName?: string | undefined;
}

// Manual profile interface
interface ManualProfile {
  firstName: string;
  lastName: string;
  alias: string;
  role: ProfileRole | "";
}

// Simple CSV parser functions
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
        row[header] = values[index] || "";
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

const getRoleIcon = (role: string) => {
  switch (role) {
    case "superadmin":
      return Shield;
    case "admin":
      return Shield;
    case "instructional":
      return Shield;
    case "instructor":
      return User;
    case "ta":
      return User;
    case "guest":
      return User;
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
      return "destructive";
    case "admin":
      return "destructive";
    case "instructional":
      return "default";
    case "instructor":
      return "secondary";
    case "ta":
      return "outline";
    case "guest":
      return "outline";
    default:
      return "outline";
  }
};

// Internal business logic functions for better testability
const useNewStaffBusinessLogic = (onDone?: () => void) => {
  const router = useRouter();
  const { effectiveProfile } = useProfile();

  // State for CSV upload
  const [csvPreview, setCsvPreview] = useState<NewProfile[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isValidatingAlias, setIsValidatingAlias] = useState(false);

  // State for manual profile creation
  const [manualProfile, setManualProfile] = useState<ManualProfile>({
    firstName: "",
    lastName: "",
    alias: "",
    role: "",
  });

  // Fetch all profiles and cohorts
  const { data: allProfiles = [] } = useQuery({
    queryKey: ["profiles"],
    queryFn: () => getAllProfiles(),
  });

  const { data: allCohorts = [] } = useQuery({
    queryKey: ["cohorts"],
    queryFn: () => getAllCohorts(),
  });

  // Check if current user is admin
  const isCurrentUserAdmin = effectiveProfile?.role === "admin";
  const isCurrentUserSuperAdmin = effectiveProfile?.role === "superadmin";

  // Available roles based on current user permissions
  const availableRoles = React.useMemo(() => {
    const baseRoles = [
      {
        value: "instructional" as ProfileRole,
        label: "Instructional Staff",
        icon: Shield,
      },
      {
        value: "instructor" as ProfileRole,
        label: "Instructor",
        icon: User,
      },
      { value: "ta" as ProfileRole, label: "Teaching Assistant", icon: User },
      { value: "guest" as ProfileRole, label: "Guest", icon: User },
    ];

    if (isCurrentUserAdmin) {
      baseRoles.unshift({
        value: "admin" as ProfileRole,
        label: "Administrator",
        icon: Shield,
      });
    }

    if (isCurrentUserSuperAdmin) {
      baseRoles.unshift({
        value: "superadmin" as ProfileRole,
        label: "Super Administrator",
        icon: Shield,
      });
    }

    return baseRoles;
  }, [isCurrentUserAdmin, isCurrentUserSuperAdmin]);

  // Validate alias uniqueness
  const validateAlias = useCallback(async (alias: string): Promise<boolean> => {
    if (!alias.trim()) return false;

    setIsValidatingAlias(true);
    try {
      const existingProfile = await getProfileByAlias(alias.trim());
      return !existingProfile; // Return true if alias is available (no existing profile)
    } catch (error) {
      log.error("staff.alias.validate.failed", {
        message: "Error validating alias",
        error,
        context: { component: "NewStaff", function: "validateAlias" },
      });
      return false;
    } finally {
      setIsValidatingAlias(false);
    }
  }, []);

  // Generate and download CSV template
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

  // Handle CSV upload
  const handleCsvUpload = useCallback(
    (file: File) => {
      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const csvText = event.target?.result as string;
          const csvData = parseCSV(csvText) as unknown as CSVRow[];
          const newProfiles: NewProfile[] = [];

          for (let index = 0; index < csvData.length; index++) {
            const row = csvData[index];
            if (!row) continue;

            // Validate required fields
            if (!row.firstName || !row.lastName || !row.alias) {
              toast.error(
                `Row ${index + 1}: Missing required fields. Please ensure all rows have firstName, lastName, and alias values.`
              );
              continue;
            }

            if (!row.role) {
              toast.error(
                `Row ${index + 1}: Missing required field 'role'. Please ensure all rows have a role value.`
              );
              continue;
            }

            // Validate role is valid
            if (!availableRoles.find((r) => r.value === row.role)) {
              toast.error(
                `Row ${index + 1}: Invalid role "${row.role}". Valid roles are: ${availableRoles.map((r) => r.value).join(", ")}`
              );
              continue;
            }

            // Check if alias already exists
            const existingProfile = allProfiles.find(
              (profile: Profile) =>
                profile.alias.toLowerCase() === row.alias.toLowerCase()
            );

            if (existingProfile) {
              toast.error(
                `Row ${index + 1}: Profile with alias "${row.alias}" already exists in the system. Please use a unique alias.`
              );
              continue;
            }

            // Validate alias uniqueness before creating
            const isAliasAvailable = await validateAlias(row.alias.trim());
            if (!isAliasAvailable) {
              toast.error(
                `Row ${index + 1}: Alias "${row.alias}" already exists in the system. Please use a unique alias.`
              );
              continue;
            }

            // Add to new profiles list (preview only; don't create yet)
            newProfiles.push({
              id: `new-${Date.now()}-${index}`,
              firstName: row.firstName.trim(),
              lastName: row.lastName.trim(),
              alias: row.alias.trim(),
              role: row.role,
              isNew: true,
              cohortName: row.cohortName?.trim(),
            });
          }

          // Do not create yet; wait for submit

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
        } catch (error) {
          toast.error(
            `Error parsing CSV file: ${error instanceof Error ? error.message : "Unknown error occurred. Please check your file format."}`
          );
        }
      };
      reader.readAsText(file);
    },
    [allProfiles, validateAlias, availableRoles]
  );

  // Add manual profile
  const addManualProfile = useCallback(async () => {
    if (
      !manualProfile.firstName ||
      !manualProfile.lastName ||
      !manualProfile.alias ||
      !manualProfile.role
    ) {
      toast.error(
        "Please fill in all required fields: First Name, Last Name, Alias, and Role are all required."
      );
      return;
    }

    // Check if alias already exists in existing profiles
    const existingProfile = allProfiles.find(
      (profile: Profile) =>
        profile.alias.toLowerCase() === manualProfile.alias.toLowerCase()
    );

    if (existingProfile) {
      toast.error(
        "This alias already exists in the system. Please choose a different alias."
      );
      return;
    }

    // Check if alias already exists in current preview list
    const duplicateInPreview = csvPreview.find(
      (p) => p.alias.toLowerCase() === manualProfile.alias.toLowerCase()
    );
    if (duplicateInPreview) {
      toast.error(
        "This alias is already in your preview list. Please choose a different alias."
      );
      return;
    }

    // Validate alias uniqueness via API
    const isAliasAvailable = await validateAlias(manualProfile.alias.trim());
    if (!isAliasAvailable) {
      toast.error(
        "This alias already exists in the system. Please choose a different alias."
      );
      return;
    }

    // Add to preview instead of creating immediately
    const tempId = `new-${Date.now()}`;
    const roleValue = manualProfile.role as ProfileRole;
    setCsvPreview((prev) => [
      ...prev,
      {
        id: tempId,
        firstName: manualProfile.firstName.trim(),
        lastName: manualProfile.lastName.trim(),
        alias: manualProfile.alias.trim(),
        role: roleValue,
        isNew: true,
        cohortName: undefined,
      },
    ]);

    toast.success(
      `Added to preview: ${manualProfile.firstName} ${manualProfile.lastName} (${manualProfile.alias})`
    );

    // Reset form fields
    setManualProfile({ firstName: "", lastName: "", alias: "", role: "" });
  }, [manualProfile, allProfiles, validateAlias, csvPreview]);

  // Remove selected profile from CSV preview
  const removeSelectedProfile = useCallback((profileId: string) => {
    setCsvPreview((prev) => prev.filter((p) => p.id !== profileId));
  }, []);

  // Handle CSV submission
  const handleCSVSubmit = useCallback(async () => {
    if (csvPreview.length === 0) return;

    setIsSubmitting(true);
    try {
      // Create in DB
      const createdProfiles = await createProfiles(
        csvPreview.map((p) => ({
          firstName: p.firstName,
          lastName: p.lastName,
          alias: p.alias,
          role: p.role,
        }))
      );

      // Replace preview ids with real ids
      const idMap = new Map<string, string>();
      csvPreview.forEach((p, idx) => {
        const created = createdProfiles[idx];
        if (p.id.startsWith("new-") && created) idMap.set(p.id, created.id);
      });

      // Group profiles by cohort name
      const profilesByCohort = new Map<string, NewProfile[]>();

      csvPreview.forEach((profile) => {
        const cohortName = profile.cohortName || "No Cohort";
        if (!profilesByCohort.has(cohortName)) {
          profilesByCohort.set(cohortName, []);
        }
        // Replace temp id with real id for cohort linking
        const realId = idMap.get(profile.id) || profile.id;
        profilesByCohort.get(cohortName)!.push({ ...profile, id: realId });
      });

      // Add profiles to cohorts if specified
      for (const [cohortName, profiles] of profilesByCohort) {
        if (cohortName !== "No Cohort") {
          const cohort = allCohorts.find((c) => c.title === cohortName);
          if (cohort) {
            const updatedProfileIds = [
              ...cohort.profileIds,
              ...profiles.map((p) => p.id),
            ];
            await updateCohort(cohort.id, {
              profileIds: updatedProfileIds,
              updatedAt: new Date().toISOString(),
            });
            toast.success(
              `Added ${profiles.length} profile(s) to cohort "${cohortName}"`
            );
          } else {
            toast.warning(
              `Cohort "${cohortName}" not found. Profiles were created but not assigned to a cohort.`
            );
          }
        }
      }

      toast.success(
        `Successfully created ${csvPreview.length} staff member(s)!`
      );
      if (onDone) {
        onDone();
      } else {
        router.push("/management/staff");
      }
    } catch (error) {
      log.error("staff.bulk_create.failed", {
        message: "Error creating staff members from CSV",
        error,
        context: { component: "NewStaff", function: "handleCSVSubmit" },
      });
      toast.error("Failed to create some staff members. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }, [csvPreview, allCohorts, router, onDone]);

  // Clear CSV preview
  const clearCsvPreview = useCallback(() => {
    setCsvPreview([]);
  }, []);

  // Update manual profile field
  const updateManualProfile = useCallback(
    (field: keyof ManualProfile, value: string) => {
      setManualProfile((prev) => ({
        ...prev,
        [field]: value,
      }));
    },
    []
  );

  return {
    // State
    csvPreview,
    isSubmitting,
    isValidatingAlias,
    manualProfile,
    allProfiles,
    allCohorts,
    isCurrentUserAdmin,
    isCurrentUserSuperAdmin,
    availableRoles,

    // Functions
    validateAlias,
    downloadTemplate,
    handleCsvUpload,
    addManualProfile,
    removeSelectedProfile,
    handleCSVSubmit,
    clearCsvPreview,
    updateManualProfile,
  };
};

export interface NewStaffProps {
  onDone?: () => void;
}

export default function NewStaff({ onDone }: NewStaffProps) {
  const csvInputRef = useRef<HTMLInputElement>(null);

  const resetFileInput = React.useCallback(() => {
    if (csvInputRef.current) {
      csvInputRef.current.value = "";
    }
  }, []);

  const {
    // State
    csvPreview,
    isSubmitting,
    isValidatingAlias,
    manualProfile,
    allCohorts,
    availableRoles,

    // Functions
    downloadTemplate,
    handleCsvUpload,
    addManualProfile,
    removeSelectedProfile,
    handleCSVSubmit,
    clearCsvPreview,
    updateManualProfile,
  } = useNewStaffBusinessLogic(onDone);

  // Handle CSV file input change
  const handleCsvInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
        const file = e.target.files[0];
        if (file) {
          handleCsvUpload(file);
        }
      }
    },
    [handleCsvUpload]
  );

  // Handle CSV click
  const handleCsvClick = useCallback(() => {
    csvInputRef.current?.click();
  }, []);

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
                className="flex items-center gap-2 border border-blue-500 text-blue-700 hover:bg-blue-50 hover:border-blue-600"
                style={{
                  boxShadow: "0 0 0 2px #a5b4fc33", // subtle blue/purple glow
                }}
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
                    onClick={() => {
                      resetFileInput();
                      if (onDone) onDone();
                    }}
                    aria-label="Back"
                  >
                    Back
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
                  value={manualProfile.firstName}
                  onChange={(e) =>
                    updateManualProfile("firstName", e.target.value)
                  }
                  placeholder="First name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="manualLastName">Last Name *</Label>
                <Input
                  id="manualLastName"
                  value={manualProfile.lastName}
                  onChange={(e) =>
                    updateManualProfile("lastName", e.target.value)
                  }
                  placeholder="Last name"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="manualAlias">Alias *</Label>
                <Input
                  id="manualAlias"
                  value={manualProfile.alias}
                  onChange={(e) => updateManualProfile("alias", e.target.value)}
                  placeholder="Alias"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="manualRole">Role *</Label>
                <Select
                  value={manualProfile.role}
                  onValueChange={(value: ProfileRole) =>
                    updateManualProfile("role", value)
                  }
                >
                  <SelectTrigger>
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
              </div>
            </div>

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
                  {manualProfile.role === "admin" &&
                    "Will have full system access and user management permissions."}
                  {manualProfile.role === "instructional" &&
                    "Will have permissions to manage instructors and teaching assistants."}
                  {manualProfile.role === "ta" &&
                    "Will have permissions to assist with assigned cohorts."}
                </p>
              </div>
            )}

            <div className="flex items-center justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => onDone && onDone()}
                aria-label="Cancel"
              >
                Back
              </Button>
              <Button
                onClick={addManualProfile}
                disabled={
                  isValidatingAlias ||
                  !manualProfile.firstName ||
                  !manualProfile.lastName ||
                  !manualProfile.alias ||
                  !manualProfile.role
                }
                className="flex items-center gap-2"
              >
                <UserPlus className="h-4 w-4" />
                {isValidatingAlias ? "Validating..." : "Add to Preview"}
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
            <Button
              variant="destructive"
              onClick={() => {
                clearCsvPreview();
                resetFileInput();
              }}
            >
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
                          onClick={() => removeSelectedProfile(user.id)}
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
                    csvPreview.map((user) => user.cohortName).filter(Boolean)
                  )
                ).map((cohortName) => {
                  const userCount = csvPreview.filter(
                    (user) => user.cohortName === cohortName
                  ).length;
                  const cohort = allCohorts.find((c) => c.title === cohortName);
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
                onClick={() => {
                  clearCsvPreview();
                  resetFileInput();
                  if (onDone) onDone();
                }}
                aria-label="Back"
              >
                Back
              </Button>
              <Button onClick={handleCSVSubmit} disabled={isSubmitting}>
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
