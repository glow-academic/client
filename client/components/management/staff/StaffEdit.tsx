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
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { useProfile } from "@/contexts/profile-context";
import { ProfileRole } from "@/types";
import { logError } from "@/utils/logger";
import { deleteProfile } from "@/utils/mutations/profiles/delete-profile";
import { updateProfile } from "@/utils/mutations/profiles/update-profile";
import { getProfile } from "@/utils/queries/profiles/get-profile";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Save, Shield, Trash2, User as UserIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";

type FormData = {
  firstName?: string;
  lastName?: string;
  alias?: string;
  role?: string;
};

export interface StaffEditProps {
  profileId: string;
}

export default function StaffEdit({ profileId }: StaffEditProps) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const [formData, setFormData] = useState<FormData>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const { effectiveProfile } = useProfile();

  // Fetch the specific target user profile directly
  const { data: targetUser, isLoading: isProfileLoading } = useQuery({
    queryKey: ["profile", profileId],
    queryFn: () => getProfile(profileId),
    enabled: !!profileId,
  });

  const isCurrentUserAdmin = effectiveProfile?.role === "admin";

  // Determine overall loading state
  const isLoading = isProfileLoading;

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setHasChanges(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    setIsSubmitting(true);
    try {
      await updateProfile(profileId, {
        firstName: formData.firstName || "",
        lastName: formData.lastName || "",
        alias: formData.alias || "",
        role: formData.role as ProfileRole,
      });
      setHasChanges(false);
      queryClient.invalidateQueries({ queryKey: ["profiles"] });
      queryClient.invalidateQueries({ queryKey: ["profile", profileId] });
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
      queryClient.invalidateQueries({ queryKey: ["profile", profileId] });
      toast.success("User deleted successfully");
      router.push("/management/staff");
    } catch (error) {
      logError("Error deleting user:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Initialize form data when user is loaded
  useEffect(() => {
    if (targetUser) {
      setFormData({
        firstName: targetUser.firstName,
        lastName: targetUser.lastName,
        alias: targetUser.alias,
        role: targetUser.role,
      });
    }
  }, [targetUser]);

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
                  {formData?.firstName !== undefined && !isLoading ? (
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
                  ) : (
                    <Skeleton className="h-10 w-full" />
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">Last Name</Label>
                  {formData?.lastName !== undefined && !isLoading ? (
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
                  ) : (
                    <Skeleton className="h-10 w-full" />
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="alias">Username/Alias</Label>
                  {formData?.alias !== undefined && !isLoading ? (
                    <Input
                      id="alias"
                      value={formData.alias || ""}
                      onChange={(e) =>
                        handleInputChange("alias", e.target.value)
                      }
                      placeholder="jsmith"
                      required
                      disabled={isSubmitting}
                    />
                  ) : (
                    <Skeleton className="h-10 w-full" />
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="role">Role</Label>
                  {formData?.role !== undefined && !isLoading ? (
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
                            <UserIcon className="h-4 w-4" />
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
                  ) : (
                    <Skeleton className="h-10 w-full" />
                  )}
                </div>
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
                    {formData.alias}@{process.env["NEXT_PUBLIC_CAMPUS_EMAIL"]}).
                    This action cannot be undone and will remove all associated
                    data.
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
