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
import { logError } from "@/utils/logger";
import { updateCohort } from "@/utils/mutations/cohorts/update-cohort";
import { createProfile } from "@/utils/mutations/profiles/create-profile";
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
    default:
      return "outline";
  }
};

export default function NewStaff() {
  const router = useRouter();
  const { effectiveProfile } = useProfile();
  const csvInputRef = useRef<HTMLInputElement>(null);

  // State for single user form
  const [formData, setFormData] = React.useState({
    firstName: "",
    lastName: "",
    alias: "",
    role: "" as ProfileRole | "",
  });

  // State for CSV upload
  const [csvPreview, setCsvPreview] = useState<NewProfile[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isValidatingAlias, setIsValidatingAlias] = useState(false);

  // State for manual profile creation
  const [manualProfile, setManualProfile] = useState({
    firstName: "",
    lastName: "",
    alias: "",
    role: "" as ProfileRole | "",
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
      logError("Error validating alias:", error);
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
        role: "instructor",
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
          const profilesToCreate: {
            firstName: string;
            lastName: string;
            alias: string;
            role: ProfileRole;
          }[] = [];

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

            // Prepare profile for creation
            const profileToCreate = {
              firstName: row.firstName.trim(),
              lastName: row.lastName.trim(),
              alias: row.alias.trim(),
              role: row.role,
            };
            profilesToCreate.push(profileToCreate);

            // Add to new profiles list with temporary ID
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

          // Create new profiles in database if any
          if (profilesToCreate.length > 0) {
            try {
              const createdProfiles = await createProfiles(profilesToCreate);
              // Update the temporary IDs with real IDs
              newProfiles.forEach((profile, index) => {
                if (profile.id.startsWith("new-") && createdProfiles[index]) {
                  profile.id = createdProfiles[index].id;
                }
              });
            } catch (error) {
              toast.error(
                "Failed to create some profiles in the database. Please check your data and try again."
              );
              logError("Error creating profiles:", error);
            }
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

    // Check if alias already exists
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

    // Validate alias uniqueness for new profile
    const isAliasAvailable = await validateAlias(manualProfile.alias.trim());
    if (!isAliasAvailable) {
      toast.error(
        "This alias already exists in the system. Please choose a different alias."
      );
      return;
    }

    try {
      // Create new profile in database
      const createdProfiles = await createProfiles([
        {
          firstName: manualProfile.firstName.trim(),
          lastName: manualProfile.lastName.trim(),
          alias: manualProfile.alias.trim(),
          role: manualProfile.role,
        },
      ]);

      if (createdProfiles && createdProfiles.length > 0) {
        const createdProfile = createdProfiles[0];
        if (createdProfile) {
          toast.success(
            `Successfully created new profile: ${createdProfile.firstName} ${createdProfile.lastName} (${createdProfile.alias})`
          );
          // Reset form
          setManualProfile({
            firstName: "",
            lastName: "",
            alias: "",
            role: "",
          });
        }
      }
    } catch (error) {
      toast.error(
        "Failed to create profile in the database. Please check your information and try again."
      );
      logError("Error creating profile:", error);
      return;
    }
  }, [manualProfile, allProfiles, validateAlias]);

  // Remove selected profile from CSV preview
  const removeSelectedProfile = useCallback((profileId: string) => {
    setCsvPreview((prev) => prev.filter((p) => p.id !== profileId));
  }, []);

  // Handle single user form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.role) return;

    setIsSubmitting(true);
    try {
      await createProfile({
        firstName: formData.firstName,
        lastName: formData.lastName,
        alias: formData.alias,
        role: formData.role,
      });
      toast.success("Staff member created successfully!");
      router.push("/management/staff");
    } catch (error) {
      logError("Error creating staff member:", error);
      toast.error("Failed to create staff member. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle CSV submission
  const handleCSVSubmit = async () => {
    if (csvPreview.length === 0) return;

    setIsSubmitting(true);
    try {
      // Group profiles by cohort name
      const profilesByCohort = new Map<string, NewProfile[]>();

      csvPreview.forEach((profile) => {
        const cohortName = profile.cohortName || "No Cohort";
        if (!profilesByCohort.has(cohortName)) {
          profilesByCohort.set(cohortName, []);
        }
        profilesByCohort.get(cohortName)!.push(profile);
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
      router.push("/management/staff");
    } catch (error) {
      logError("Error creating staff members from CSV:", error);
      toast.error("Failed to create some staff members. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <div className="space-y-6 py-4 px-4">
      <Tabs defaultValue="single" className="space-y-4">
        <div className="flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="single">Single User</TabsTrigger>
            <TabsTrigger value="csv">CSV Import</TabsTrigger>
            <TabsTrigger value="manual">Manual Add</TabsTrigger>
          </TabsList>
          <Button variant="outline" onClick={downloadTemplate}>
            <Download className="h-4 w-4 mr-2" />
            Download Template
          </Button>
        </div>

        <TabsContent value="single">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">First Name</Label>
                <Input
                  id="firstName"
                  value={formData.firstName}
                  onChange={(e) =>
                    handleInputChange("firstName", e.target.value)
                  }
                  placeholder="Enter first name"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Last Name</Label>
                <Input
                  id="lastName"
                  value={formData.lastName}
                  onChange={(e) =>
                    handleInputChange("lastName", e.target.value)
                  }
                  placeholder="Enter last name"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="alias">Username/Alias</Label>
                <Input
                  id="alias"
                  value={formData.alias}
                  onChange={(e) => handleInputChange("alias", e.target.value)}
                  placeholder="Enter username"
                  required
                />
                <p className="text-sm text-muted-foreground">
                  Will be used as {formData.alias}@
                  {process.env["NEXT_PUBLIC_CAMPUS_EMAIL"]}
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="role">Role</Label>
                <Select
                  value={formData.role}
                  onValueChange={(value: ProfileRole) =>
                    handleInputChange("role", value)
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
                  {formData.role === "admin" &&
                    "Will have full system access and user management permissions."}
                  {formData.role === "instructional" &&
                    "Will have permissions to manage instructors and teaching assistants."}
                  {formData.role === "ta" &&
                    "Will have permissions to assist with assigned cohorts."}
                </p>
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.back()}
                disabled={isSubmitting}
              >
                Back
              </Button>
              <Button type="submit" disabled={isSubmitting || !formData.role}>
                {isSubmitting
                  ? "Creating..."
                  : `Create ${formData.role ? getRoleDisplayName(formData.role) : "Staff Member"}`}
              </Button>
            </div>
          </form>
        </TabsContent>

        <TabsContent value="csv">
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="text-sm text-muted-foreground">
                Include the following columns in the CSV file: firstName,
                lastName, alias, role, cohortName (optional).
              </div>
            </div>

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
                onClick={handleCsvClick}
                className="flex items-center gap-2"
              >
                <Upload className="h-4 w-4" />
                Choose CSV File
              </Button>
              <Button
                variant="outline"
                onClick={downloadTemplate}
                className="flex items-center gap-2"
              >
                <Download className="h-4 w-4" />
                Download Template
              </Button>
            </div>

            {csvPreview.length > 0 && (
              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-medium">
                    Preview ({csvPreview.length} users)
                  </h3>
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

                {/* Cohort Assignment Summary */}
                {csvPreview.some((p) => p.cohortName) && (
                  <div className="space-y-2">
                    <Label>Cohort Assignment Summary</Label>
                    <div className="space-y-2">
                      {Array.from(
                        new Set(
                          csvPreview
                            .map((user) => user.cohortName)
                            .filter(Boolean)
                        )
                      ).map((cohortName) => {
                        const userCount = csvPreview.filter(
                          (user) => user.cohortName === cohortName
                        ).length;
                        const cohort = allCohorts.find(
                          (c) => c.title === cohortName
                        );
                        return (
                          <div
                            key={cohortName}
                            className="p-3 bg-muted rounded-md"
                          >
                            <div className="flex items-center gap-2 mb-2">
                              <Badge variant="default">{cohortName}</Badge>
                              <span className="text-sm text-muted-foreground">
                                ({userCount} user{userCount !== 1 ? "s" : ""})
                              </span>
                            </div>
                            <p className="text-sm text-muted-foreground">
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

                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setCsvPreview([]);
                    }}
                  >
                    Clear All
                  </Button>
                  <Button onClick={handleCSVSubmit} disabled={isSubmitting}>
                    {isSubmitting
                      ? "Creating..."
                      : `Create ${csvPreview.length} Staff Members`}
                  </Button>
                </div>
              </div>
            )}
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
                    setManualProfile((prev) => ({
                      ...prev,
                      firstName: e.target.value,
                    }))
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
                    setManualProfile((prev) => ({
                      ...prev,
                      lastName: e.target.value,
                    }))
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
                  onChange={(e) =>
                    setManualProfile((prev) => ({
                      ...prev,
                      alias: e.target.value,
                    }))
                  }
                  placeholder="Alias"
                />
                <p className="text-sm text-muted-foreground">
                  Will be used as {manualProfile.alias}@
                  {process.env["NEXT_PUBLIC_CAMPUS_EMAIL"]}
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="manualRole">Role *</Label>
                <Select
                  value={manualProfile.role}
                  onValueChange={(value: ProfileRole) =>
                    setManualProfile((prev) => ({
                      ...prev,
                      role: value,
                    }))
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
              {isValidatingAlias ? "Validating..." : "Create Profile"}
            </Button>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
