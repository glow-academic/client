/**
 * StaffEdit.tsx
 * Used to display the edit for the staff page.
 * @AshokSaravanan222 & @siladiea
 * 06/07/2025
 */
"use client";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Class as ClassData, Profile, ProfileRole } from "@/types";
import { deleteProfile } from "@/utils/mutations/profiles/delete-profile";
import { updateProfile } from "@/utils/mutations/profiles/update-profile";
import { getAllClasses } from "@/utils/queries/classes/get-all-classes";
import { getAllProfiles } from "@/utils/queries/profiles/get-all-profiles";
import { getProfilesByUser } from "@/utils/queries/profiles/get-profiles-by-user";
import { getUserByEmail } from "@/utils/user/get-user-by-email";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  GraduationCap,
  Save,
  Shield,
  Trash2,
  User as UserIcon,
} from "lucide-react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { logError } from "@/utils/logger";

export default function StaffEdit({ profileId }: { profileId: string }) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const [formData, setFormData] = useState<Partial<Profile>>({
    firstName: "",
    lastName: "",
    alias: "",
    classIds: [],
    role: "ta",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Get current user's profile to check if they're admin
  const session = useSession();
  const userEmail = session.data?.user?.email;

  const { data: user, isLoading: isUserLoading } = useQuery({
    queryKey: ["user", userEmail],
    queryFn: () => getUserByEmail(userEmail!),
    enabled: !!userEmail,
  });

  const { data: currentUserProfile, isLoading: isCurrentUserProfileLoading } =
    useQuery({
      queryKey: ["profile", userEmail],
      queryFn: () => getProfilesByUser(user!.id!),
      select: (data) => data[0],
      enabled: !!user,
    });

  // Fetch all users to find the target user
  const { data: allProfiles = [], isLoading: isProfilesLoading } = useQuery({
    queryKey: ["profiles"],
    queryFn: () => getAllProfiles(),
  });

  // Fetch all classes for multi-select
  const { data: allClasses = [], isLoading: isClassesLoading } = useQuery({
    queryKey: ["classes"],
    queryFn: () => getAllClasses(),
  });

  const targetUser = allProfiles.find(
    (profile: Profile) => profile.id === profileId
  );
  const isCurrentUserAdmin = currentUserProfile?.role === "admin";

  // Determine overall loading state
  const isLoading =
    isProfilesLoading ||
    isClassesLoading ||
    isUserLoading ||
    isCurrentUserProfileLoading;
  const isDataReady = !isLoading && targetUser;

  const handleInputChange = (field: string, value: string | string[]) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setHasChanges(true);
  };

  const handleClassToggle = (classId: string) => {
    const currentClassIds = formData.classIds;
    const newClassIds = currentClassIds?.includes(classId)
      ? currentClassIds?.filter((id) => id !== classId)
      : [...(currentClassIds || []), classId];

    handleInputChange("classIds", newClassIds);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    setIsSubmitting(true);
    try {
      await updateProfile(profileId, {
        firstName: formData.firstName || "",
        lastName: formData.lastName || "",
        alias: formData.alias || "",
        classIds: formData.classIds || [],
        role: formData.role || "ta",
      });
      setHasChanges(false);
      queryClient.invalidateQueries({ queryKey: ["profiles"] });
      queryClient.invalidateQueries({ queryKey: ["classes"] });
      queryClient.invalidateQueries({ queryKey: ["profile", userEmail] });
      toast.success("User updated successfully");
      router.push("/management/staff");
    } catch (error) {
      logError("Error updating user:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    setIsSubmitting(true);
    try {
      await deleteProfile(profileId);
      queryClient.invalidateQueries({ queryKey: ["profiles"] });
      queryClient.invalidateQueries({ queryKey: ["classes"] });
      queryClient.invalidateQueries({ queryKey: ["profile", userEmail] });
      toast.success("User deleted successfully");
      router.push("/management/staff");
    } catch (error) {
      logError("Error deleting user:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatClassTerm = (term: string) => {
    switch (term) {
      case "fall":
        return "Fall";
      case "spring":
        return "Spring";
      case "summer":
        return "Summer";
      default:
        return term;
    }
  };

  // Initialize form data when user is loaded
  useEffect(() => {
    if (targetUser) {
      setFormData({
        firstName: targetUser.firstName,
        lastName: targetUser.lastName,
        alias: targetUser.alias,
        classIds: targetUser.classIds || [],
        role: targetUser.role,
      });
    }
  }, [targetUser]);

  // Show loading state
  if (isLoading) {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Loading...</CardTitle>
            <CardDescription>
              Please wait while we load the user information.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="h-4 bg-muted rounded animate-pulse" />
                  <div className="h-10 bg-muted rounded animate-pulse" />
                </div>
                <div className="space-y-2">
                  <div className="h-4 bg-muted rounded animate-pulse" />
                  <div className="h-10 bg-muted rounded animate-pulse" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="h-4 bg-muted rounded animate-pulse" />
                  <div className="h-10 bg-muted rounded animate-pulse" />
                </div>
                <div className="space-y-2">
                  <div className="h-4 bg-muted rounded animate-pulse" />
                  <div className="h-10 bg-muted rounded animate-pulse" />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show error state if user not found
  if (!isLoading && !targetUser) {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>User Not Found</CardTitle>
            <CardDescription>
              The requested user could not be found.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8">
              <p className="text-muted-foreground mb-4">
                The user with ID "{profileId}" does not exist or you don't have
                permission to view it.
              </p>
              <Button onClick={() => router.push("/management/staff")}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Staff Management
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Only render the form when data is ready
  if (!isDataReady) {
    return null;
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>User Information</CardTitle>
            <CardDescription>
              Basic user details and account information.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="firstName">First Name</Label>
                  <Input
                    id="firstName"
                    value={formData.firstName || ""}
                    onChange={(e) =>
                      handleInputChange("firstName", e.target.value)
                    }
                    placeholder="Jane"
                    required
                    disabled={isSubmitting}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">Last Name</Label>
                  <Input
                    id="lastName"
                    value={formData.lastName || ""}
                    onChange={(e) =>
                      handleInputChange("lastName", e.target.value)
                    }
                    placeholder="Smith"
                    required
                    disabled={isSubmitting}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="alias">Username/Alias</Label>
                  <Input
                    id="alias"
                    value={formData.alias || ""}
                    onChange={(e) => handleInputChange("alias", e.target.value)}
                    placeholder="jsmith"
                    required
                    disabled={isSubmitting}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="role">Role</Label>
                  <Select
                    value={formData.role || ""}
                    onValueChange={(value: ProfileRole) =>
                      handleInputChange("role", value)
                    }
                    disabled={isSubmitting}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a role" />
                    </SelectTrigger>
                    <SelectContent>
                      {isCurrentUserAdmin && (
                        <SelectItem value="admin">
                          <div className="flex items-center gap-2">
                            <Shield className="h-4 w-4 text-red-600" />
                            Administrator
                          </div>
                        </SelectItem>
                      )}
                      <SelectItem value="instructional">
                        <div className="flex items-center gap-2">
                          <Shield className="h-4 w-4" />
                          Instructional Staff
                        </div>
                      </SelectItem>
                      <SelectItem value="instructor">
                        <div className="flex items-center gap-2">
                          <GraduationCap className="h-4 w-4" />
                          Instructor
                        </div>
                      </SelectItem>
                      <SelectItem value="ta">
                        <div className="flex items-center gap-2">
                          <UserIcon className="h-4 w-4" />
                          Teaching Assistant
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Classes Section */}
              <div className="space-y-2">
                <Label>Classes</Label>
                <div className="border rounded-md p-4 max-h-60 overflow-y-auto">
                  {allClasses.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No classes available
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {allClasses.map((classItem: ClassData) => (
                        <div
                          key={classItem.id}
                          className="flex items-center space-x-2"
                        >
                          <Checkbox
                            id={`class-${classItem.id}`}
                            checked={
                              formData.classIds?.includes(classItem.id) || false
                            }
                            onCheckedChange={() =>
                              handleClassToggle(classItem.id)
                            }
                            disabled={isSubmitting}
                          />
                          <Label
                            htmlFor={`class-${classItem.id}`}
                            className="text-sm font-normal cursor-pointer flex-1"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div>
                                <span className="font-medium">
                                  {classItem.classCode}
                                </span>
                                <span className="text-muted-foreground ml-2">
                                  {classItem.name}
                                </span>
                              </div>
                              <Badge variant="outline" className="text-xs">
                                {formatClassTerm(classItem.term)}{" "}
                                {classItem.year}
                              </Badge>
                            </div>
                          </Label>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">
                  {formData.classIds?.length || 0} class
                  {(formData.classIds?.length || 0) !== 1 ? "es" : ""} selected
                </p>
              </div>

              <div className="flex justify-end gap-2">
                <Button type="submit" disabled={isSubmitting || !hasChanges}>
                  <Save className="h-4 w-4 mr-2" />
                  {isSubmitting ? "Saving..." : "Save"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="text-destructive">Danger Zone</CardTitle>
            <CardDescription>
              Permanently delete this user account. This action cannot be
              undone.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" disabled={isSubmitting}>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete User
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete the user account for{" "}
                    {formData.firstName + " " + formData.lastName} (
                    {formData.alias}@purdue.edu). This action cannot be undone
                    and will remove all associated data.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel disabled={isSubmitting}>
                    Cancel
                  </AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDelete}
                    disabled={isSubmitting}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    {isSubmitting ? "Deleting..." : "Delete User"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
