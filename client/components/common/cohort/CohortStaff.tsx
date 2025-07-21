/**
 * CohortStaff.tsx
 * Used to show the cohort staff.
 * @AshokSaravanan222 & @siladiea
 * 07/18/2025
 */

"use client";
import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";

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
import { Skeleton } from "@/components/ui/skeleton";

import { cn } from "@/lib/utils";
import { Profile, ProfileRole } from "@/types";
import { logInfo } from "@/utils/logger";
import {
  Eye,
  Grid3X3,
  List,
  Search,
  Trash2,
  Upload,
  UploadCloud,
} from "lucide-react";

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

interface CohortStaffProps {
  profiles: EditableProfile[];
  setProfiles: (profiles: EditableProfile[]) => void;
  profilesToDelete: string[];
  setProfilesToDelete: (profileIds: string[]) => void;
  isLoading?: boolean;
  isSubmitting?: boolean;
}

export default function CohortStaff({
  profiles,
  setProfiles,
  profilesToDelete,
  setProfilesToDelete,
  isLoading = false,
  isSubmitting = false,
}: CohortStaffProps) {
  // Profile management state
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"grid" | "list">("list");

  // Upload state
  const csvInputRef = useRef<HTMLInputElement>(null);

  const handleCsvClick = useCallback(() => {
    if (!isSubmitting) {
      csvInputRef.current?.click();
    }
  }, [isSubmitting]);

  const handleCsvInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
        const file = e.target.files[0];
        if (file) {
          // For now, just show a toast - CSV processing would be implemented here
          toast.info(
            `CSV file "${file.name}" selected. CSV processing not yet implemented.`
          );
        }
      }
    },
    []
  );

  // Profile management handlers
  const stageProfileForDeletion = (profileId: string) => {
    const profileToRemove = profiles.find((p) => p.id === profileId);
    if (!profileToRemove) return;

    // If it's an existing profile, add its ID to the deletion queue
    if (!("isNew" in profileToRemove)) {
      setProfilesToDelete([...profilesToDelete, profileId]);
    }

    // Remove the profile from the visible UI state
    setProfiles(profiles.filter((p) => p.id !== profileId));
  };

  const handleProfileRoleChange = (profileId: string, newRole: ProfileRole) => {
    setProfiles(
      profiles.map((profile) =>
        profile.id === profileId ? { ...profile, role: newRole } : profile
      )
    );
  };

  const getProfileRoleIcon = (role: ProfileRole) => {
    switch (role) {
      case "instructional":
        return "👨‍🏫";
      case "ta":
        return "👨‍🎓";
      default:
        return "👤";
    }
  };

  const viewProfile = (profile: EditableProfile) => {
    // For now, this function does nothing as requested
    // In the future, this could open a profile details modal
    logInfo("View profile:", profile);
  };

  // Filter profiles from the *edited* state for rendering
  const filteredProfiles = profiles.filter((profile: EditableProfile) => {
    const matchesSearch = searchQuery
      ? profile.firstName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        profile.lastName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        profile.alias.toLowerCase().includes(searchQuery.toLowerCase())
      : true;
    const matchesRole =
      roleFilter === "all" ? true : profile.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  return (
    <div className="space-y-4">
      <Label>Staff</Label>

      {/* Controls Bar */}
      <div className="flex items-center justify-between gap-4">
        {/* Left side - Search and Filters */}
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search staff..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 h-9 w-64"
            />
          </div>

          <Select value={roleFilter} onValueChange={setRoleFilter}>
            <SelectTrigger className="w-40 h-9">
              <SelectValue placeholder="Filter by role" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Roles</SelectItem>
              <SelectItem value="instructional">👨‍🏫 Instructor</SelectItem>
              <SelectItem value="ta">👨‍🎓 TA</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Right side - View Toggle */}
        <div className="flex items-center gap-4">
          <div className="flex border rounded-md">
            <Button
              type="button"
              variant={viewMode === "grid" ? "default" : "ghost"}
              size="sm"
              onClick={() => setViewMode("grid")}
              className="rounded-r-none"
            >
              <Grid3X3 className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant={viewMode === "list" ? "default" : "ghost"}
              size="sm"
              onClick={() => setViewMode("list")}
              className="rounded-l-none border-l"
            >
              <List className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <input
              ref={csvInputRef}
              type="file"
              data-testid="csv-input"
              onChange={handleCsvInputChange}
              disabled={isSubmitting}
              accept=".csv"
              className="hidden"
            />
            <Button
              type="button"
              variant="default"
              onClick={handleCsvClick}
              disabled={isSubmitting}
              className="flex items-center gap-2"
            >
              <Upload className="h-4 w-4" />
              {isSubmitting ? "Uploading..." : "Upload CSV"}
            </Button>
          </div>
        </div>
      </div>

      {/* Profiles Display Area */}
      {isLoading ? (
        <Skeleton className="h-[200px] rounded-lg" />
      ) : (
        <div
          className={cn(
            "min-h-[200px] rounded-lg",
            filteredProfiles.length === 0 ? "border-2 border-dashed" : ""
          )}
        >
          {filteredProfiles.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <UploadCloud className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-lg font-medium text-muted-foreground mb-2">
                {profiles.length === 0
                  ? "No staff yet"
                  : "No staff match your filters"}
              </p>
              <p className="text-sm text-muted-foreground">
                {profiles.length === 0
                  ? "Upload a CSV file or add staff manually to get started"
                  : "Try adjusting your search or filters"}
              </p>
            </div>
          ) : (
            <div className="p-4">
              {viewMode === "grid" ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                  {filteredProfiles.map((profile) => {
                    const isNewProfile = "isNew" in profile && profile.isNew;
                    return (
                      <div
                        key={profile.id}
                        className={cn(
                          "group relative border rounded-lg hover:shadow-md transition-all",
                          isNewProfile && "border-blue-300 bg-blue-50/50"
                        )}
                      >
                        {/* Role selector in top left */}
                        <div className="absolute top-2 left-2 z-10">
                          <Select
                            value={profile.role}
                            onValueChange={(value) =>
                              handleProfileRoleChange(
                                profile.id,
                                value as ProfileRole
                              )
                            }
                          >
                            <SelectTrigger
                              className="text-xs bg-white/90 backdrop-blur-sm border-0 shadow-sm justify-center"
                              size="sm"
                            >
                              <span className="text-sm">
                                {getProfileRoleIcon(profile.role)}
                              </span>
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="instructional">
                                👨‍🏫 Instructor
                              </SelectItem>
                              <SelectItem value="ta">👨‍🎓 TA</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        {/* Action buttons in top right */}
                        <div className="absolute top-2 right-2 z-10 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-7 w-7 p-0 bg-white/90 backdrop-blur-sm"
                            onClick={() => viewProfile(profile)}
                          >
                            <Eye className="h-3 w-3" />
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-7 w-7 p-0 text-destructive hover:text-destructive bg-white/90 backdrop-blur-sm"
                            data-testid={`delete-profile-${profile.id}`}
                            onClick={() => stageProfileForDeletion(profile.id)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>

                        {/* Profile area */}
                        <div className="aspect-square bg-muted rounded-lg flex items-center justify-center relative">
                          <div className="text-center">
                            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-2">
                              <span className="text-2xl">
                                {getProfileRoleIcon(profile.role)}
                              </span>
                            </div>
                            <p className="text-sm font-medium truncate px-2">
                              {profile.firstName} {profile.lastName}
                            </p>
                            <p className="text-xs text-muted-foreground truncate px-2">
                              {profile.alias}
                            </p>
                          </div>
                          {isNewProfile && (
                            <div className="absolute top-1 right-1 bg-blue-500 text-white text-xs px-1 py-0.5 rounded text-[10px]">
                              NEW
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredProfiles.map((profile) => {
                    const isNewProfile = "isNew" in profile && profile.isNew;
                    return (
                      <div
                        key={profile.id}
                        className={cn(
                          "flex items-center gap-4 p-3 border rounded-lg hover:shadow-sm transition-all",
                          isNewProfile && "border-blue-300 bg-blue-50/50"
                        )}
                      >
                        <div className="w-12 h-12 bg-muted rounded-md flex items-center justify-center flex-shrink-0">
                          <span className="text-xl">
                            {getProfileRoleIcon(profile.role)}
                          </span>
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-medium truncate">
                              {profile.firstName} {profile.lastName}
                            </p>
                            {isNewProfile && (
                              <span className="bg-blue-500 text-white text-xs px-1 py-0.5 rounded">
                                NEW
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground truncate">
                            {profile.alias}
                          </p>
                        </div>

                        <div className="flex items-center gap-2">
                          <Select
                            value={profile.role}
                            onValueChange={(value) =>
                              handleProfileRoleChange(
                                profile.id,
                                value as ProfileRole
                              )
                            }
                          >
                            <SelectTrigger className="w-40 h-8">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="instructional">
                                👨‍🏫 Instructor
                              </SelectItem>
                              <SelectItem value="ta">👨‍🎓 TA</SelectItem>
                            </SelectContent>
                          </Select>

                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => viewProfile(profile)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="text-destructive hover:text-destructive"
                            data-testid={`delete-profile-${profile.id}`}
                            onClick={() => stageProfileForDeletion(profile.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
