"use client";

import React, { useCallback, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useProfile } from "@/contexts/profile-context";
import { api } from "@/lib/api/client";
import { keys } from "@/lib/query/keys";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Download, Search, Upload, UserPlus, X } from "lucide-react";

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

export interface SelectedProfile {
  id: string;
  firstName: string;
  lastName: string;
  alias: string;
  role: string;
  isNew: true;
}

export interface AddStaffToCohortProps {
  cohortId: string;
  onDone?: () => void;
}

export default function AddStaffToCohort({
  cohortId,
  onDone,
}: AddStaffToCohortProps) {
  const { effectiveProfile, departmentIds } = useProfile();
  const queryClient = useQueryClient();

  // V3 API: Fetch cohort detail with profiles
  const { data, isLoading: isLoadingProfiles } = useQuery({
    queryKey: keys.cohorts.with({
      cohortId,
      departmentIds,
      currentProfileId: effectiveProfile?.id || "",
    }),
    queryFn: () =>
      api.post("/cohorts/detail-with-profiles", {
        body: {
          cohortId,
          departmentIds: departmentIds,
          currentProfileId: effectiveProfile?.id || "",
        },
      }),
    enabled: !!cohortId && !!effectiveProfile?.id && departmentIds.length > 0,
  });

  // Extract data from V3 response
  const allProfiles = useMemo(
    () => data?.available_profiles || [],
    [data?.available_profiles]
  );

  const cohortProfileIds = useMemo(
    () => data?.current_profile_ids || [],
    [data?.current_profile_ids]
  );

  // Mutation hook - V3 API
  // Note: V3 endpoint only accepts profileIds, so we need to create new profiles first
  const addProfilesToCohortMutation = useMutation({
    mutationFn: async (request: {
      cohortId: string;
      departmentIds: string[];
      existingProfileIds?: string[];
      newProfiles?: Array<{
        firstName: string;
        lastName: string;
        alias: string;
        role: "ta" | "instructional";
      }>;
    }) => {
      const profileIdsToAdd: string[] = [...(request.existingProfileIds || [])];

      // Create new profiles if needed
      if (request.newProfiles && request.newProfiles.length > 0) {
        // Use bulk-create-or-update to create new profiles
        const createResponse = await api.post(
          "/profile/staff/bulk-create-or-update-staff",
          {
            body: {
              profiles: request.newProfiles.map((p) => ({
                firstName: p.firstName,
                lastName: p.lastName,
                alias: p.alias,
                role: p.role,
                department_ids: request.departmentIds,
                cohort_ids: [], // Will be added below
              })),
              currentProfileId: effectiveProfile?.id || "",
            },
          }
        );
        profileIdsToAdd.push(...createResponse.profileIds);
      }

      // Add all profiles to cohort
      if (profileIdsToAdd.length > 0) {
        await api.post("/cohorts/add-profiles", {
          body: {
            cohortId: request.cohortId,
            profileIds: profileIdsToAdd,
          },
        });
      }

      return { success: true, message: "Profiles added successfully" };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: keys.cohorts.all });
      queryClient.invalidateQueries({ queryKey: keys.profile.all });
    },
  });

  // State
  const [selectedProfiles, setSelectedProfiles] = useState<SelectedProfile[]>(
    []
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("csv");
  const [manualProfile, setManualProfile] = useState({
    firstName: "",
    lastName: "",
    alias: "",
  });
  const [formErrors, setFormErrors] = useState<{
    firstName?: string;
    lastName?: string;
    alias?: string;
  }>({});

  const csvInputRef = useRef<HTMLInputElement>(null);

  // Download template
  const downloadTemplate = useCallback(() => {
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
  }, []);

  // CSV upload handler
  const handleCsvUpload = useCallback(
    (file: File) => {
      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const csvText = (event.target?.result as string) || "";
          const rows = parseCSV(csvText);

          const existingIds: string[] = [];
          const newProfiles: {
            firstName: string;
            lastName: string;
            alias: string;
            role: "ta" | "instructional";
          }[] = [];

          for (let index = 0; index < rows.length; index++) {
            const row = rows[index];
            if (!row) continue;

            const alias = (row["alias"] || "").trim();
            const firstName = (row["firstName"] || "").trim();
            const lastName = (row["lastName"] || "").trim();

            if (!alias) {
              toast.error(`Row ${index + 1}: Missing required field 'alias'.`);
              continue;
            }

            // Check if profile exists (using profile_id from v3 response)
            const existing = allProfiles.find(
              (p) => p.alias.toLowerCase() === alias.toLowerCase()
            );

            if (existing) {
              // Profile exists, add to existing IDs
              if (!cohortProfileIds.includes(existing.profile_id)) {
                existingIds.push(existing.profile_id);
              } else {
                toast.error(
                  `Row ${index + 1}: Profile with alias "${alias}" already exists in this cohort.`
                );
              }
            } else {
              // New profile needed
              if (firstName && lastName) {
                newProfiles.push({ firstName, lastName, alias, role: "ta" });
              } else {
                toast.warning(
                  `Row ${index + 1}: Skipping "${alias}" - firstName and lastName are required.`
                );
              }
            }
          }

          // Add all profiles to cohort in one operation
          if (existingIds.length > 0 || newProfiles.length > 0) {
            try {
              const request: {
                cohortId: string;
                departmentIds: string[];
                existingProfileIds?: string[];
                newProfiles?: Array<{
                  firstName: string;
                  lastName: string;
                  alias: string;
                  role: "ta" | "instructional";
                }>;
              } = {
                cohortId,
                departmentIds: departmentIds,
              };
              if (existingIds.length > 0) {
                request.existingProfileIds = existingIds;
              }
              if (newProfiles.length > 0) {
                request.newProfiles = newProfiles;
              }
              await addProfilesToCohortMutation.mutateAsync(request);

              const total = existingIds.length + newProfiles.length;
              toast.success(
                `Successfully added ${total} profile(s) to cohort.`
              );
            } catch (error) {
              const errorMessage =
                error instanceof Error
                  ? error.message
                  : "Failed to add profiles to cohort.";
              toast.error(errorMessage);
            }
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
    [
      allProfiles,
      cohortProfileIds,
      addProfilesToCohortMutation,
      cohortId,
      departmentIds,
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

  // Form validation
  const validateForm = useCallback(() => {
    const errors: { firstName?: string; lastName?: string; alias?: string } =
      {};

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

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }, [manualProfile]);

  // Manual add profile - add to selection (not immediate add to cohort)
  const addManualProfile = useCallback(async () => {
    if (!validateForm()) {
      toast.error("Please fix the form errors.");
      return;
    }

    const existing = allProfiles.find(
      (p) => p.alias.toLowerCase() === manualProfile.alias.toLowerCase()
    );

    if (existing) {
      if (
        !cohortProfileIds.includes(existing.profile_id) &&
        !selectedProfiles.find((sp) => sp.id === existing.profile_id)
      ) {
        const newProfile: SelectedProfile = {
          id: existing.profile_id,
          firstName: existing.first_name,
          lastName: existing.last_name,
          alias: existing.alias,
          role: existing.role,
          isNew: true,
        };
        setSelectedProfiles((prev) => [...prev, newProfile]);
        toast.success(
          `Added to selection: ${existing.first_name} ${existing.last_name}`
        );
      } else {
        toast.error("This profile already exists in the current cohort.");
      }
    } else {
      // Add to selection (will be created when confirmed)
      const tempId = `new-${Date.now()}`;
      const np: SelectedProfile = {
        id: tempId,
        firstName: manualProfile.firstName.trim(),
        lastName: manualProfile.lastName.trim(),
        alias: manualProfile.alias.trim(),
        role: "ta",
        isNew: true,
      };
      setSelectedProfiles((prev) => [...prev, np]);
      toast.success(
        `Added to selection: ${manualProfile.firstName} ${manualProfile.lastName} (will be created)`
      );
    }

    setManualProfile({ firstName: "", lastName: "", alias: "" });
  }, [
    manualProfile,
    allProfiles,
    cohortProfileIds,
    selectedProfiles,
    validateForm,
  ]);

  // Search profiles
  const availableProfiles = useMemo(() => {
    return allProfiles.filter(
      (p) =>
        !cohortProfileIds.includes(p.profile_id) &&
        !selectedProfiles.find((sp) => sp.id === p.profile_id) &&
        (p.role === "instructional" || p.role === "ta") &&
        !p.default_profile
    );
  }, [allProfiles, cohortProfileIds, selectedProfiles]);

  const filteredProfiles = useMemo(() => {
    return availableProfiles.filter(
      (p) =>
        p.first_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.last_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.alias.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [availableProfiles, searchQuery]);

  const addProfileFromSearch = useCallback(
    (profile: (typeof allProfiles)[0]) => {
      const np: SelectedProfile = {
        id: profile.profile_id,
        firstName: profile.first_name,
        lastName: profile.last_name,
        alias: profile.alias,
        role: profile.role,
        isNew: true,
      };
      setSelectedProfiles((prev) => {
        const exists = prev.find((p) => p.id === profile.profile_id);
        if (exists) {
          toast.error("This profile is already selected.");
          return prev;
        }
        return [...prev, np];
      });
    },
    []
  );

  const removeSelectedProfile = useCallback(
    (id: string) =>
      setSelectedProfiles((prev) => prev.filter((p) => p.id !== id)),
    []
  );

  // Confirm and add to cohort
  const confirmAndAddToCohort = useCallback(async () => {
    if (selectedProfiles.length === 0) {
      toast.error("No profiles selected.");
      return;
    }

    // Separate existing profiles from new ones
    const existingIds = selectedProfiles
      .filter((p) => !p.id.startsWith("new-"))
      .map((p) => p.id);

    const newProfiles = selectedProfiles
      .filter((p) => p.id.startsWith("new-"))
      .map((p) => ({
        firstName: p.firstName,
        lastName: p.lastName,
        alias: p.alias,
        role: "ta" as const,
      }));

    try {
      const request: {
        cohortId: string;
        departmentIds: string[];
        existingProfileIds?: string[];
        newProfiles?: Array<{
          firstName: string;
          lastName: string;
          alias: string;
          role: "ta" | "instructional";
        }>;
      } = {
        cohortId: cohortId,
        departmentIds: departmentIds,
      };
      if (existingIds.length > 0) {
        request.existingProfileIds = existingIds;
      }
      if (newProfiles.length > 0) {
        request.newProfiles = newProfiles;
      }
      await addProfilesToCohortMutation.mutateAsync(request);

      toast.success(
        `Successfully added ${selectedProfiles.length} profile(s) to the cohort.`
      );
      setSelectedProfiles([]);
      setSearchQuery("");
      setActiveTab("csv");
      if (onDone) onDone();
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Failed to add profiles to cohort.";
      toast.error(errorMessage);
    }
  }, [
    selectedProfiles,
    cohortId,
    departmentIds,
    addProfilesToCohortMutation,
    onDone,
  ]);

  return (
    <div className="space-y-4">
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
              (required for new profiles), lastName (required for new profiles).
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
              {selectedProfiles.length === 0 && (
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
                  ? "No profiles found matching your search"
                  : "No available profiles to add"}
              </div>
            ) : (
              filteredProfiles.map((profile) => (
                <Card key={profile.profile_id} className="p-3">
                  <CardContent className="p-0">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium">
                            {profile.first_name} {profile.last_name}
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
                value={manualProfile.firstName}
                onChange={(e) =>
                  setManualProfile((prev) => ({
                    ...prev,
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
              <Label htmlFor="lastName">Last Name *</Label>
              <Input
                id="lastName"
                value={manualProfile.lastName}
                onChange={(e) =>
                  setManualProfile((prev) => ({
                    ...prev,
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
            <div className="space-y-2">
              <Label htmlFor="alias">Alias *</Label>
              <Input
                id="alias"
                value={manualProfile.alias}
                onChange={(e) =>
                  setManualProfile((prev) => ({
                    ...prev,
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
          </div>
          <div className="flex justify-end gap-2">
            {selectedProfiles.length === 0 && (
              <Button variant="outline" onClick={() => onDone && onDone()}>
                Close
              </Button>
            )}
            <Button
              onClick={addManualProfile}
              className="flex items-center gap-2"
            >
              <UserPlus className="h-4 w-4" />
              Create GTA
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
            <Button variant="outline" onClick={() => onDone && onDone()}>
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
    </div>
  );
}
