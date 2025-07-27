/**
 * CohortAddStaff.tsx
 * Used to add staff to a cohort.
 * @AshokSaravanan222 & @siladiea
 * 07-23-2025
 */

"use client";
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
import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { Profile, ProfileRole } from "@/types";
import { getProfileByAlias } from "@/utils/auth/get-profile-by-alias";
import { createProfiles } from "@/utils/mutations/profiles/create-profiles";
import { getAllProfiles } from "@/utils/queries/profiles/get-all-profiles";
import { useQuery } from "@tanstack/react-query";
import {
  Check,
  Download,
  Plus,
  Search,
  Upload,
  UserPlus,
  X,
} from "lucide-react";
import { logError } from "@/utils/logger";

// CSV Template interface
interface CSVRow {
  alias: string;
  firstName?: string;
  lastName?: string;
  cohort?: string;
}

// New profile interface
interface NewProfile {
  id: string;
  firstName: string;
  lastName: string;
  alias: string;
  role: ProfileRole;
  isNew: true;
}

export interface CohortAddStaffProps {
  onAddProfiles: (profiles: NewProfile[]) => void;
  currentCohortName?: string;
  existingProfileIds: string[];
}

export default function CohortAddStaff({
  onAddProfiles,
  currentCohortName,
  existingProfileIds,
}: CohortAddStaffProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("csv");
  const [selectedProfiles, setSelectedProfiles] = useState<NewProfile[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [manualProfile, setManualProfile] = useState({
    firstName: "",
    lastName: "",
    alias: "",
  });
  const [isValidatingAlias, setIsValidatingAlias] = useState(false);

  const csvInputRef = useRef<HTMLInputElement>(null);

  // Fetch all profiles for search functionality
  const { data: allProfiles = [], isLoading: isLoadingProfiles } = useQuery({
    queryKey: ["profiles"],
    queryFn: () => getAllProfiles(),
  });

  // Filter out profiles that are already in the cohort or selected, only show instructional/ta roles, and exclude default profiles
  const availableProfiles = allProfiles.filter(
    (profile: Profile) =>
      !existingProfileIds.includes(profile.id) &&
      !selectedProfiles.find((p) => p.id === profile.id) &&
      (profile.role === "instructional" || profile.role === "ta") &&
      !profile.defaultProfile,
  );

  // Filter profiles based on search query
  const filteredProfiles = availableProfiles.filter(
    (profile: Profile) =>
      profile.firstName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      profile.lastName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      profile.alias.toLowerCase().includes(searchQuery.toLowerCase()),
  );

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
        alias: "jdoe",
        firstName: "John",
        lastName: "Doe",
        cohort: currentCohortName || "Cohort Name",
      },
      {
        alias: "jsmith",
        firstName: "Jane",
        lastName: "Smith",
        cohort: currentCohortName || "Cohort Name",
      },
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
  }, [currentCohortName]);

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

            if (!row.alias) {
              toast.error(`Row ${index + 1}: Missing required field (alias)`);
              continue;
            }

            // Check if cohort column exists and matches current cohort
            if (row.cohort && currentCohortName) {
              const normalizedCsvCohort = row.cohort
                .toLowerCase()
                .replace(/\s+/g, " ")
                .trim();
              const normalizedCurrentCohort = currentCohortName
                .toLowerCase()
                .replace(/\s+/g, " ")
                .trim();

              if (normalizedCsvCohort !== normalizedCurrentCohort) {
                continue; // Skip this row if cohort doesn't match
              }
            }

            // Always default to "ta" role
            const role = "ta" as ProfileRole;

            // Check if alias already exists
            const existingProfile = allProfiles.find(
              (profile: Profile) =>
                profile.alias.toLowerCase() === row.alias.toLowerCase(),
            );

            if (existingProfile) {
              if (!existingProfileIds.includes(existingProfile.id)) {
                // Add existing profile as new to this cohort
                newProfiles.push({
                  id: existingProfile.id,
                  firstName: existingProfile.firstName,
                  lastName: existingProfile.lastName,
                  alias: existingProfile.alias,
                  role: existingProfile.role,
                  isNew: true,
                });
              }
            } else {
              // For CSV, if firstName and lastName are provided, try to create new profile
              if (row.firstName && row.lastName) {
                // Validate alias uniqueness before creating
                const isAliasAvailable = await validateAlias(row.alias.trim());
                if (!isAliasAvailable) {
                  toast.error(
                    `Row ${index + 1}: Alias "${row.alias}" already exists`,
                  );
                  continue;
                }

                // Prepare profile for creation
                const profileToCreate = {
                  firstName: row.firstName.trim(),
                  lastName: row.lastName.trim(),
                  alias: row.alias.trim(),
                  role: role,
                };
                profilesToCreate.push(profileToCreate);

                // Add to new profiles list with temporary ID
                newProfiles.push({
                  id: `new-${Date.now()}-${index}`,
                  firstName: row.firstName.trim(),
                  lastName: row.lastName.trim(),
                  alias: row.alias.trim(),
                  role: role,
                  isNew: true,
                });
              } else {
                // If no firstName/lastName provided, skip creating new profile
                toast.warning(
                  `Row ${index + 1}: Skipping "${row.alias}" - firstName and lastName required for new profiles`,
                );
              }
            }
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
              toast.error("Failed to create some profiles in database");
              logError("Error creating profiles:", error);
            }
          }

          if (newProfiles.length > 0) {
            setSelectedProfiles(newProfiles);
            toast.success(
              `Successfully processed ${newProfiles.length} profiles`,
            );
          } else {
            toast.error("No valid profiles found in CSV");
          }
        } catch (error) {
          toast.error(
            `Error parsing CSV: ${error instanceof Error ? error.message : "Unknown error"}`,
          );
        }
      };
      reader.readAsText(file);
    },
    [allProfiles, existingProfileIds, currentCohortName, validateAlias],
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
    [handleCsvUpload],
  );

  // Handle CSV click
  const handleCsvClick = useCallback(() => {
    csvInputRef.current?.click();
  }, []);

  // Add profile from search
  const addProfileFromSearch = useCallback((profile: Profile) => {
    const newProfile: NewProfile = {
      id: profile.id,
      firstName: profile.firstName,
      lastName: profile.lastName,
      alias: profile.alias,
      role: profile.role,
      isNew: true,
    };

    setSelectedProfiles((prev) => {
      const exists = prev.find((p) => p.id === profile.id);
      if (exists) {
        toast.error("Profile already selected");
        return prev;
      }
      return [...prev, newProfile];
    });
  }, []);

  // Add manual profile
  const addManualProfile = useCallback(async () => {
    if (
      !manualProfile.firstName ||
      !manualProfile.lastName ||
      !manualProfile.alias
    ) {
      toast.error(
        "Please fill in all required fields (firstName, lastName, alias)",
      );
      return;
    }

    // Check if alias already exists
    const existingProfile = allProfiles.find(
      (profile: Profile) =>
        profile.alias.toLowerCase() === manualProfile.alias.toLowerCase(),
    );

    if (existingProfile) {
      if (!existingProfileIds.includes(existingProfile.id)) {
        const newProfile: NewProfile = {
          id: existingProfile.id,
          firstName: existingProfile.firstName,
          lastName: existingProfile.lastName,
          alias: existingProfile.alias,
          role: existingProfile.role,
          isNew: true,
        };
        setSelectedProfiles((prev) => [...prev, newProfile]);
        toast.success(
          `Added existing profile: ${existingProfile.firstName} ${existingProfile.lastName}`,
        );
      } else {
        toast.error("Profile already exists in this cohort");
      }
    } else {
      // Validate alias uniqueness for new profile
      const isAliasAvailable = await validateAlias(manualProfile.alias.trim());
      if (!isAliasAvailable) {
        toast.error(
          "This alias already exists. Please choose a different one.",
        );
        return;
      }

      try {
        // Create new profile in database with default "ta" role
        const createdProfiles = await createProfiles([
          {
            firstName: manualProfile.firstName.trim(),
            lastName: manualProfile.lastName.trim(),
            alias: manualProfile.alias.trim(),
            role: "ta",
          },
        ]);

        if (createdProfiles && createdProfiles.length > 0) {
          const createdProfile = createdProfiles[0];
          if (createdProfile) {
            const newProfile: NewProfile = {
              id: createdProfile.id,
              firstName: createdProfile.firstName,
              lastName: createdProfile.lastName,
              alias: createdProfile.alias,
              role: createdProfile.role,
              isNew: true,
            };
            setSelectedProfiles((prev) => [...prev, newProfile]);
            toast.success(
              `Created and added new profile: ${createdProfile.firstName} ${createdProfile.lastName}`,
            );
          }
        }
      } catch (error) {
        toast.error("Failed to create profile in database");
        logError("Error creating profile:", error);
        return;
      }
    }

    // Reset manual form
    setManualProfile({ firstName: "", lastName: "", alias: "" });
  }, [manualProfile, allProfiles, existingProfileIds, validateAlias]);

  // Remove selected profile
  const removeSelectedProfile = useCallback((profileId: string) => {
    setSelectedProfiles((prev) => prev.filter((p) => p.id !== profileId));
  }, []);

  // Confirm and add profiles
  const confirmAndAdd = useCallback(() => {
    if (selectedProfiles.length === 0) {
      toast.error("No profiles selected");
      return;
    }

    onAddProfiles(selectedProfiles);
    setSelectedProfiles([]);
    setIsOpen(false);
    setActiveTab("csv");
    toast.success(`Added ${selectedProfiles.length} profile(s) to cohort`);
  }, [selectedProfiles, onAddProfiles]);

  // Reset state when dialog closes
  const handleOpenChange = useCallback((open: boolean) => {
    setIsOpen(open);
    if (!open) {
      setSelectedProfiles([]);
      setSearchQuery("");
      setManualProfile({ firstName: "", lastName: "", alias: "" });
      setActiveTab("csv");
    }
  }, []);

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="default" className="flex items-center gap-2">
          <Plus className="h-4 w-4" />
          Add Staff
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Staff to Cohort</DialogTitle>
          <DialogDescription>
            Choose how you want to add staff members to this cohort.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="csv" className="flex items-center gap-2">
                <Upload className="h-4 w-4" />
                Upload CSV
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
                  (optional), lastName (optional), cohort (optional).
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
                      ? "No profiles found"
                      : "No available profiles"}
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
                  />
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
                  />
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
                  />
                </div>
              </div>

              <Button
                onClick={addManualProfile}
                disabled={isValidatingAlias}
                className="flex items-center gap-2"
              >
                <UserPlus className="h-4 w-4" />
                {isValidatingAlias ? "Validating..." : "Add Profile"}
              </Button>
            </TabsContent>
          </Tabs>

          {/* Selected Profiles */}
          {selectedProfiles.length > 0 && (
            <div className="space-y-4">
              <Separator />
              <div>
                <h3 className="font-medium">
                  Selected Profiles ({selectedProfiles.length})
                </h3>
                <p className="text-sm text-muted-foreground">
                  These profiles will be added to the cohort
                </p>
              </div>

              <div className="max-h-40 overflow-y-auto space-y-2">
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
                  onClick={() => setSelectedProfiles([])}
                >
                  Clear All
                </Button>
                <Button
                  onClick={confirmAndAdd}
                  className="flex items-center gap-2"
                >
                  <Check className="h-4 w-4" />
                  Add to Cohort
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
