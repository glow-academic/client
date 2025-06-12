/**
 * StaffEdit.tsx
 * Used to display the edit for the staff page.
 * @AshokSaravanan222 & @siladiea
 * 06/07/2025
 */
"use client";
import React from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  Save,
  Trash2,
  Shield,
  GraduationCap,
  User as UserIcon,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
import { Profile } from "@/types";
import { getAllProfiles } from "@/utils/queries/profiles/get-all-profiles";

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

const getRoleIcon = (role: string) => {
  switch (role) {
    case "instructional":
      return Shield;
    case "instructor":
      return GraduationCap;
    case "ta":
      return UserIcon;
    default:
      return UserIcon;
  }
};

const getRoleDisplayName = (role: string) => {
  switch (role) {
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

const getRolePermissions = (role: string) => {
  switch (role) {
    case "instructional":
      return "Can manage instructors and teaching assistants";
    case "instructor":
      return "Can manage assigned classes and teaching assistants";
    case "ta":
      return "Can assist with assigned classes";
    default:
      return "Standard user permissions";
  }
};

export default function StaffEdit({ profileId }: { profileId: string }) {
  const router = useRouter();
  const [formData, setFormData] = React.useState({
    name: "",
    username: "",
    password: "",
    classIds: [] as string[],
  });
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [hasChanges, setHasChanges] = React.useState(false);

  // Fetch all users to find the target user
  const { data: allProfiles = [], isLoading } = useQuery({
    queryKey: ["profiles"],
    queryFn: () => getAllProfiles(),
  });

  const targetUser = allProfiles.find((profile: Profile) => profile.id === profileId);

  // Initialize form data when user is loaded
  React.useEffect(() => {
    if (targetUser) {
      setFormData({
        name: targetUser.firstName + " " + targetUser.lastName,
        username: targetUser.email,
        password: "",
        classIds: targetUser.classIds || [],
      });
    }
  }, [targetUser]);

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setHasChanges(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetUser) return;

    setIsSubmitting(true);
    try {
      // TODO: Implement API call to update user
      console.log("Updating user:", { profileId, ...formData });

      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 1000));

      setHasChanges(false);
      router.push("/management/staff");
    } catch (error) {
      console.error("Error updating user:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!targetUser) return;

    setIsSubmitting(true);
    try {
      // TODO: Implement API call to delete user
      console.log("Deleting user:", profileId);

      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 1000));

      router.push("/management/staff");
    } catch (error) {
      console.error("Error deleting user:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="text-center">Loading...</div>
      </div>
    );
  }

  if (!targetUser) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">User Not Found</h1>
          <p className="text-muted-foreground">
            The requested user could not be found.
          </p>
        </div>
        <Button
          onClick={() => router.push("/management/staff")}
          variant="outline"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Staff Management
        </Button>
      </div>
    );
  }

  // Check if user is actually staff
  if (!["instructional", "instructor", "ta"].includes(targetUser.role)) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Invalid User Type
          </h1>
          <p className="text-muted-foreground">
            This user is not a staff member and cannot be edited here.
          </p>
        </div>
        <Button
          onClick={() => router.push("/management/staff")}
          variant="outline"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Staff Management
        </Button>
      </div>
    );
  }

  const RoleIcon = getRoleIcon(targetUser.role);

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
                  <Label htmlFor="name">Full Name</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => handleInputChange("name", e.target.value)}
                    placeholder={
                      targetUser.role === "instructional"
                        ? "Dr. Sarah Johnson"
                        : targetUser.role === "instructor"
                          ? "Dr. Jane Smith"
                          : "John Doe"
                    }
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="username">Username</Label>
                  <Input
                    id="username"
                    value={formData.username}
                    onChange={(e) =>
                      handleInputChange("username", e.target.value)
                    }
                    placeholder={
                      targetUser.role === "instructional"
                        ? "sjohnson"
                        : targetUser.role === "instructor"
                          ? "jsmith"
                          : "jdoe"
                    }
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">New Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={formData.password}
                  onChange={(e) =>
                    handleInputChange("password", e.target.value)
                  }
                  placeholder="Leave blank to keep current password"
                />
                <p className="text-sm text-muted-foreground">
                  Leave blank to keep the current password.
                </p>
              </div>

              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.push("/management/staff")}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting || !hasChanges}>
                  <Save className="h-4 w-4 mr-2" />
                  {isSubmitting ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Role & Permissions</CardTitle>
            <CardDescription>
              Current role and access level information.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-2">
              <Label>Role:</Label>
              <div className="flex items-center gap-2">
                <RoleIcon className="h-4 w-4" />
                <Badge variant={getRoleBadgeVariant(targetUser.role)}>
                  {getRoleDisplayName(targetUser.role)}
                </Badge>
              </div>
            </div>
            <div>
              <Label>Class Assignments:</Label>
              <p className="text-sm text-muted-foreground mt-1">
                {targetUser.classIds?.length || 0} classes assigned
              </p>
            </div>
            <div>
              <Label>Permissions:</Label>
              <p className="text-sm text-muted-foreground mt-1">
                {getRolePermissions(targetUser.role)}
              </p>
            </div>
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
                    {targetUser.firstName + " " + targetUser.lastName} ({targetUser.email}). This action
                    cannot be undone and will remove all associated data.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDelete}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Delete User
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
