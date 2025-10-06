/**
 * ProfileSelector.tsx
 * Reusable component for selecting profiles with CSV upload and string matching
 * @AshokSaravanan222 & @siladiea
 * 06/07/2025
 */

"use client";
import { useProfiles } from "@/lib/api/hooks/profiles";
import React, { useCallback, useMemo, useState } from "react";
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
import { Profile, ProfileRole } from "@/types";
import { log } from "@/utils/logger";
import { Download, Search, Shield, Trash2, User } from "lucide-react";

// A new type to represent a profile that is either saved or new
type EditableProfile =
  | Profile
  | {
      isNew: true;
      id: string; // A temporary client-side ID
      firstName: string;
      lastName: string;
      alias: string;
      role: ProfileRole;
    };

interface CSVProfile {
  firstName: string;
  lastName: string;
  alias: string;
  role: ProfileRole;
}

interface ProfileSelectorProps {
  selectedProfiles: EditableProfile[];
  onProfilesChange: (profiles: EditableProfile[]) => void;
  allowedRoles: ProfileRole[];
  title?: string;
  description?: string;
}

const getRoleIcon = (role: string) => {
  switch (role) {
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

// Simple fuzzy search function
const fuzzySearch = (query: string, profiles: Profile[]): Profile[] => {
  if (!query.trim()) return [];

  const searchTerm = query.toLowerCase().trim();
  const results: Array<{ profile: Profile; score: number }> = [];

  profiles.forEach((profile) => {
    const firstName = profile.firstName?.toLowerCase() || "";
    const lastName = profile.lastName?.toLowerCase() || "";
    const alias = profile.alias?.toLowerCase() || "";
    const fullName = `${firstName} ${lastName}`.trim();

    let score = 0;

    // Exact matches get highest score
    if (firstName === searchTerm) score += 100;
    if (lastName === searchTerm) score += 100;
    if (alias === searchTerm) score += 100;
    if (fullName === searchTerm) score += 150;

    // Starts with gets high score
    if (firstName.startsWith(searchTerm)) score += 50;
    if (lastName.startsWith(searchTerm)) score += 50;
    if (alias.startsWith(searchTerm)) score += 40;
    if (fullName.startsWith(searchTerm)) score += 60;

    // Contains gets lower score
    if (firstName.includes(searchTerm)) score += 20;
    if (lastName.includes(searchTerm)) score += 20;
    if (alias.includes(searchTerm)) score += 15;
    if (fullName.includes(searchTerm)) score += 25;

    // Partial word matches
    const searchWords = searchTerm.split(" ").filter(Boolean);
    searchWords.forEach((word) => {
      if (firstName.includes(word)) score += 10;
      if (lastName.includes(word)) score += 10;
      if (alias.includes(word)) score += 5;
    });

    if (score > 0) {
      results.push({ profile, score });
    }
  });

  // Sort by score (highest first) and return top 10
  return results
    .sort((a, b) => b.score - a.score)
    .slice(0, 10)
    .map((result) => result.profile);
};

export default function ProfileSelector({
  selectedProfiles,
  onProfilesChange,
  allowedRoles,
  title = "Profiles",
  description = "Add profiles to this item",
}: ProfileSelectorProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Profile[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [csvPreview, setCsvPreview] = useState<CSVProfile[]>([]);

  const { data: allProfiles = [] } = useProfiles();

  // Filter profiles by allowed roles
  const availableProfiles = useMemo(() => {
    return allProfiles.filter((profile) => allowedRoles.includes(profile.role));
  }, [allProfiles, allowedRoles]);

  // Search profiles function
  const handleSearch = useCallback(
    async (query: string) => {
      if (!query.trim()) {
        setSearchResults([]);
        return;
      }

      setIsSearching(true);
      try {
        // Use simple fuzzy search instead of MCP
        const results = fuzzySearch(query, availableProfiles);
        setSearchResults(results);
      } catch (error) {
        log.error("profiles.search.failed", {
          message: "Error searching profiles",
          error,
          context: { component: "ProfileSelector" },
        });
        toast.error("Failed to search profiles");
      } finally {
        setIsSearching(false);
      }
    },
    [availableProfiles],
  );

  // Debounced search
  const debouncedSearch = useMemo(() => {
    let timeoutId: NodeJS.Timeout;
    return (query: string) => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => handleSearch(query), 300);
    };
  }, [handleSearch]);

  const handleSearchInputChange = (value: string) => {
    setSearchQuery(value);
    debouncedSearch(value);
  };

  // Add profile from search results
  const addProfileFromSearch = (profile: Profile) => {
    // Check if profile is already selected
    if (!selectedProfiles.find((p) => p.id === profile.id)) {
      onProfilesChange([...selectedProfiles, profile]);
      toast.success(`Added ${profile.firstName} ${profile.lastName}`);
    } else {
      toast.info(`${profile.firstName} ${profile.lastName} is already added`);
    }
    setSearchQuery("");
    setSearchResults([]);
  };

  // Add profiles from comma-separated string
  const handleStringInput = (input: string) => {
    if (!input.trim()) return;

    const names = input
      .split(",")
      .map((name) => name.trim())
      .filter(Boolean);

    names.forEach((name) => {
      const nameParts = name.split(" ").filter(Boolean);
      if (nameParts.length >= 2) {
        const firstName = nameParts[0];
        const lastName = nameParts[nameParts.length - 1];
        const alias = `${firstName?.toLowerCase()}${lastName?.toLowerCase()}`;

        const newProfile: EditableProfile = {
          isNew: true,
          id: `temp-${Date.now()}-${Math.random()}`,
          firstName: firstName ?? "",
          lastName: lastName ?? "",
          alias: alias ?? "",
          role: allowedRoles[0] ?? "guest",
        };

        onProfilesChange([...selectedProfiles, newProfile]);
      }
    });

    toast.success(`Added ${names.length} profile(s)`);
  };

  // CSV handling functions
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type === "text/csv") {
      parseCSV(file);
    } else if (file) {
      toast.error("Please select a CSV file");
    }
  };

  const parseCSV = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const lines = text.split("\n").filter((line) => line.trim());

      if (lines.length < 2) {
        toast.error(
          "CSV file must have at least a header row and one data row",
        );
        return;
      }

      const profiles: CSVProfile[] = lines
        .slice(1) // Skip header row
        .map((line) => {
          const values = line.split(",").map((v) => v.trim());
          const role = values[3] as ProfileRole;

          return {
            firstName: values[0] || "",
            lastName: values[1] || "",
            alias: values[2] || "",
            role: role,
          };
        })
        .filter(
          (profile): profile is CSVProfile =>
            Boolean(profile.firstName) &&
            Boolean(profile.lastName) &&
            allowedRoles.includes(profile.role),
        );

      if (profiles.length === 0) {
        toast.error(
          "No valid profiles found in CSV. Please check the format and ensure roles are valid.",
        );
        return;
      }

      setCsvPreview(profiles);
      toast.success(`Found ${profiles.length} valid profiles in CSV`);
    };
    reader.readAsText(file);
  };

  const downloadTemplate = () => {
    const headers = ["firstName", "lastName", "alias", "role"];
    const examples = [
      ["Sarah", "Johnson", "sjohnson", allowedRoles[0]],
      ["Jane", "Smith", "jsmith", allowedRoles[0]],
      ["John", "Doe", "jdoe", allowedRoles[0]],
    ];

    const csvContent =
      headers.join(",") +
      "\n" +
      examples.map((ex) => ex.join(",")).join("\n") +
      "\n";

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "profiles_template.csv";
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const addCsvProfiles = () => {
    if (csvPreview.length === 0) return;

    const newProfiles: EditableProfile[] = csvPreview.map((profile) => ({
      isNew: true,
      id: `temp-${Date.now()}-${Math.random()}`,
      firstName: profile.firstName,
      lastName: profile.lastName,
      alias: profile.alias,
      role: profile.role,
    }));

    onProfilesChange([...selectedProfiles, ...newProfiles]);
    setCsvPreview([]);
    toast.success(`Added ${csvPreview.length} profile(s) from CSV`);
  };

  // Remove profile
  const removeProfile = (profileId: string) => {
    onProfilesChange(selectedProfiles.filter((p) => p.id !== profileId));
  };

  // Update profile role
  const updateProfileRole = (profileId: string, newRole: ProfileRole) => {
    onProfilesChange(
      selectedProfiles.map((profile) =>
        profile.id === profileId ? { ...profile, role: newRole } : profile,
      ),
    );
  };

  return (
    <div className="space-y-4">
      <div>
        <Label>{title}</Label>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>

      <Tabs defaultValue="search" className="space-y-4">
        <div className="flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="search">Search</TabsTrigger>
            <TabsTrigger value="csv">CSV Import</TabsTrigger>
            <TabsTrigger value="string">Quick Add</TabsTrigger>
          </TabsList>
          <Button variant="outline" onClick={downloadTemplate}>
            <Download className="h-4 w-4 mr-2" />
            Download Template
          </Button>
        </div>

        <TabsContent value="search">
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder="Search profiles by name or alias..."
                value={searchQuery}
                onChange={(e) => handleSearchInputChange(e.target.value)}
                className="pl-10"
              />
            </div>

            {isSearching && (
              <div className="text-sm text-muted-foreground">Searching...</div>
            )}

            {searchResults.length > 0 && (
              <div className="space-y-2">
                <Label>Search Results</Label>
                <div className="border rounded-md max-h-48 overflow-auto">
                  {searchResults.map((profile) => (
                    <div
                      key={profile.id}
                      className="flex items-center justify-between p-2 hover:bg-muted cursor-pointer"
                      onClick={() => addProfileFromSearch(profile)}
                    >
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4" />
                        <span>
                          {profile.firstName} {profile.lastName}
                        </span>
                        <Badge variant={getRoleBadgeVariant(profile.role)}>
                          {getRoleDisplayName(profile.role)}
                        </Badge>
                      </div>
                      <Button variant="ghost" size="sm">
                        Add
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="csv">
          <div className="space-y-4">
            <div className="text-sm text-muted-foreground">
              Upload a CSV file with profiles. Include the following columns:
              firstName, lastName, alias, role. Valid roles:{" "}
              {allowedRoles.join(", ")}
            </div>

            <div>
              <Input
                type="file"
                accept=".csv"
                onChange={handleFileSelect}
                className="cursor-pointer"
              />
            </div>

            {csvPreview.length > 0 && (
              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-medium">
                    Preview ({csvPreview.length} profiles)
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
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {csvPreview.map((profile, index) => {
                        const RoleIcon = getRoleIcon(profile.role);
                        return (
                          <TableRow key={index}>
                            <TableCell>{profile.firstName}</TableCell>
                            <TableCell>{profile.lastName}</TableCell>
                            <TableCell>{profile.alias}</TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <RoleIcon className="h-4 w-4" />
                                <Badge
                                  variant={getRoleBadgeVariant(profile.role)}
                                >
                                  {getRoleDisplayName(profile.role)}
                                </Badge>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>

                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setCsvPreview([]);
                    }}
                  >
                    Cancel
                  </Button>
                  <Button onClick={addCsvProfiles}>
                    Add {csvPreview.length} Profile(s)
                  </Button>
                </div>
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="string">
          <div className="space-y-4">
            <div className="text-sm text-muted-foreground">
              Enter names separated by commas. Each name should be in "First
              Last" format.
            </div>

            <div className="flex gap-2">
              <Input
                placeholder="e.g., John Doe, Jane Smith, Bob Johnson"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleStringInput(e.currentTarget.value);
                    e.currentTarget.value = "";
                  }
                }}
              />
              <Button
                onClick={(e) => {
                  const input = e.currentTarget
                    .previousElementSibling as HTMLInputElement;
                  handleStringInput(input.value);
                  input.value = "";
                }}
              >
                Add
              </Button>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Selected Profiles Table */}
      {selectedProfiles.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label>Selected Profiles ({selectedProfiles.length})</Label>
          </div>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Username</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {selectedProfiles.map((profile) => {
                  const isNew = "isNew" in profile && profile.isNew;
                  const RoleIcon = getRoleIcon(profile.role);
                  return (
                    <TableRow key={profile.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <RoleIcon className="h-4 w-4" />
                          <span>
                            {profile.firstName} {profile.lastName}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>{profile.alias}</TableCell>
                      <TableCell>
                        <Select
                          value={profile.role}
                          onValueChange={(value: ProfileRole) =>
                            updateProfileRole(profile.id, value)
                          }
                        >
                          <SelectTrigger className="w-32">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {allowedRoles.map((role) => (
                              <SelectItem key={role} value={role}>
                                {getRoleDisplayName(role)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        {isNew ? (
                          <Badge variant="secondary">New</Badge>
                        ) : (
                          <Badge variant="outline">Existing</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeProfile(profile.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </div>
  );
}
