"use client";
import React, { use } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Save, Trash2 } from "lucide-react";

import { getUser } from "@/utils/queries/get-user";
import { getUsers } from "@/utils/queries/get-users";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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

export default function EditInstructionalPage({ params }: { params: Promise<{ userId: string }> }) {
  const { userId } = use(params);

  const router = useRouter();
  const [formData, setFormData] = React.useState({
    name: "",
    username: "",
    password: "",
    classIds: [] as string[]
  });
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [hasChanges, setHasChanges] = React.useState(false);

  // Fetch current user to check permissions
  const { data: currentUser } = useQuery({
    queryKey: ["user"],
    queryFn: () => getUser(),
  });

  // Fetch all users to find the target user
  const { data: allUsers = [], isLoading } = useQuery({
    queryKey: ["users"],
    queryFn: () => getUsers(),
  });

  const targetUser = allUsers.find(user => user.id === userId);

  // Check permissions - only admin can edit instructional staff
  const canEdit = currentUser?.role === 'admin';
  const canChangePassword = currentUser?.role === 'admin';
  const canDelete = currentUser?.role === 'admin';

  // Initialize form data when user is loaded
  React.useEffect(() => {
    if (targetUser) {
      setFormData({
        name: targetUser.name,
        username: targetUser.username,
        password: "",
        classIds: targetUser.classIds || []
      });
    }
  }, [targetUser]);

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setHasChanges(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit || !targetUser) return;

    setIsSubmitting(true);
    try {
      // TODO: Implement API call to update user
      console.log("Updating user:", { userId, ...formData });
      
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      setHasChanges(false);
      router.push('/management/instructional');
    } catch (error) {
      console.error("Error updating user:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!canDelete || !targetUser) return;

    setIsSubmitting(true);
    try {
      // TODO: Implement API call to delete user
      console.log("Deleting user:", userId);
      
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      router.push('/management/instructional');
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
        <Button onClick={() => router.push('/management/instructional')} variant="outline">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Instructional Staff
        </Button>
      </div>
    );
  }

  if (!canEdit) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Access Denied</h1>
          <p className="text-muted-foreground">
            You don't have permission to edit instructional staff. Only administrators can perform this action.
          </p>
        </div>
        <Button onClick={() => router.push('/management/instructional')} variant="outline">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Instructional Staff
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Edit Instructional Staff</h1>
          <p className="text-muted-foreground">
            Modify the details for {targetUser.name}.
          </p>
        </div>
        <Button onClick={() => router.push('/management/instructional')} variant="outline">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
      </div>

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
                    onChange={(e) => handleInputChange('name', e.target.value)}
                    placeholder="Dr. Sarah Johnson"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="username">Username</Label>
                  <Input
                    id="username"
                    value={formData.username}
                    onChange={(e) => handleInputChange('username', e.target.value)}
                    placeholder="sjohnson"
                    required
                  />
                </div>
              </div>
              
              {canChangePassword && (
                <div className="space-y-2">
                  <Label htmlFor="password">New Password</Label>
                  <Input
                    id="password"
                    type="password"
                    value={formData.password}
                    onChange={(e) => handleInputChange('password', e.target.value)}
                    placeholder="Leave blank to keep current password"
                  />
                  <p className="text-sm text-muted-foreground">
                    Leave blank to keep the current password.
                  </p>
                </div>
              )}

              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.push('/management/instructional')}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting || !hasChanges}>
                  <Save className="h-4 w-4 mr-2" />
                  {isSubmitting ? 'Saving...' : 'Save Changes'}
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
              <Badge variant="default">
                {targetUser.role.charAt(0).toUpperCase() + targetUser.role.slice(1)}
              </Badge>
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
                Can manage instructors and teaching assistants
              </p>
            </div>
          </CardContent>
        </Card>

        {canDelete && (
          <Card className="border-destructive">
            <CardHeader>
              <CardTitle className="text-destructive">Danger Zone</CardTitle>
              <CardDescription>
                Permanently delete this user account. This action cannot be undone.
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
                      This will permanently delete the user account for {targetUser.name} ({targetUser.username}).
                      This action cannot be undone and will remove all associated data.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                      Delete User
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
