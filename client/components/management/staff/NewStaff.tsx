/**
 * NewStaff.tsx
 * Used to display the new staff page.
 * @AshokSaravanan222 & @siladiea
 * 06/07/2025
 */

"use client";
import { useQuery } from "@tanstack/react-query";
import { Download, GraduationCap, Shield, User } from "lucide-react";
import { useRouter } from "next/navigation";
import React from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Class as ClassData } from "@/types";
import { logError } from "@/utils/logger";
import { createProfile } from "@/utils/mutations/profiles/create-profile";
import { getAllClasses } from "@/utils/queries/classes/get-all-classes";
import { getProfilesByUser } from "@/utils/queries/profiles/get-profiles-by-user";
import { useSession } from "next-auth/react";

type ProfileRole = "admin" | "instructional" | "instructor" | "ta";

interface CSVUser {
  firstName: string;
  lastName: string;
  alias: string;
  role: ProfileRole;
}

const getRoleIcon = (role: string) => {
  switch (role) {
    case "admin":
      return Shield;
    case "instructional":
      return Shield;
    case "instructor":
      return GraduationCap;
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

export default function NewStaff() {
  const router = useRouter();
  const [formData, setFormData] = React.useState({
    firstName: "",
    lastName: "",
    alias: "",
    role: "" as ProfileRole | "",
    classIds: [] as string[],
  });
  const [csvPreview, setCsvPreview] = React.useState<CSVUser[]>([]);
  const [selectedClassIds, setSelectedClassIds] = React.useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  // Get current user's profile to check if they're admin
  const userId = useSession().data?.user?.id;

  const { data: currentUserProfile } = useQuery({
    queryKey: ["profile", userId],
    queryFn: () => getProfilesByUser(parseInt(userId!)),
    select: (data) => data[0],
    enabled: !!userId,
  });

  // Fetch all classes for multi-select
  const { data: allClasses = [] } = useQuery({
    queryKey: ["classes"],
    queryFn: () => getAllClasses(),
  });

  // Check if current user is admin
  const isCurrentUserAdmin = currentUserProfile?.role === "admin";

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
        icon: GraduationCap,
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

    return baseRoles;
  }, [isCurrentUserAdmin]);

  const handleInputChange = (field: string, value: string | string[]) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleClassToggle = (classId: string) => {
    const currentClassIds = formData.classIds;
    const newClassIds = currentClassIds.includes(classId)
      ? currentClassIds.filter((id) => id !== classId)
      : [...currentClassIds, classId];

    handleInputChange("classIds", newClassIds);
  };

  const handleBulkClassToggle = (classId: string) => {
    const newClassIds = selectedClassIds.includes(classId)
      ? selectedClassIds.filter((id) => id !== classId)
      : [...selectedClassIds, classId];

    setSelectedClassIds(newClassIds);
  };

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
        classIds: formData.classIds,
      });
      router.push("/management/staff");
    } catch (error) {
      logError("Error creating staff member:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type === "text/csv") {
      parseCSV(file);
    }
  };

  const parseCSV = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const lines = text.split("\n").filter((line) => line.trim());

      const users: CSVUser[] = lines
        .slice(1)
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
          (user): user is CSVUser =>
            Boolean(user.firstName) && Boolean(user.lastName)
        );

      setCsvPreview(users);
    };
    reader.readAsText(file);
  };

  const downloadTemplate = () => {
    const headers = ["firstName", "lastName", "alias", "role"];
    const examples = [
      ["Sarah", "Johnson", "sjohnson", "instructional"],
      ["Jane", "Smith", "jsmith", "instructor"],
      ["John", "Doe", "jdoe", "ta"],
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
    a.download = "staff_template.csv";
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const handleCSVSubmit = async () => {
    if (csvPreview.length === 0) return;

    setIsSubmitting(true);
    try {
      await Promise.all(
        csvPreview.map((user) =>
          createProfile({
            firstName: user.firstName,
            lastName: user.lastName,
            alias: user.alias,
            role: user.role,
            classIds: selectedClassIds,
          })
        )
      );
      router.push("/management/staff");
    } catch (error) {
      logError("Error creating staff members from CSV:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 py-4 px-4">
      <Tabs defaultValue="single" className="space-y-4">
        <div className="flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="single">Single User</TabsTrigger>
            <TabsTrigger value="csv">CSV Import</TabsTrigger>
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
                  Will be used as {formData.alias}@{process.env["NEXT_PUBLIC_CAMPUS_EMAIL"]}
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

            {/* Class Assignment Section */}
            <div className="space-y-2">
              <Label>Class Assignments</Label>
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
                          checked={formData.classIds.includes(classItem.id)}
                          onCheckedChange={() =>
                            handleClassToggle(classItem.id)
                          }
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
                              {classItem.term.charAt(0).toUpperCase() +
                                classItem.term.slice(1)}{" "}
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
                {formData.classIds.length} class
                {formData.classIds.length !== 1 ? "es" : ""} selected
              </p>
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
                  {formData.role === "instructor" &&
                    "Will have permissions to manage assigned classes and teaching assistants."}
                  {formData.role === "ta" &&
                    "Will have permissions to assist with assigned classes."}
                </p>
              </div>
            )}

            <div className="flex justify-end">
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
                lastName, alias, role.
              </div>
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
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {csvPreview.map((user, index) => {
                        const RoleIcon = getRoleIcon(user.role);
                        return (
                          <TableRow key={index}>
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
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>

                {/* Role Information Section */}
                <div className="space-y-2">
                  <Label>Role Information</Label>
                  <div className="space-y-2">
                    {Array.from(
                      new Set(csvPreview.map((user) => user.role))
                    ).map((role) => {
                      const RoleIcon = getRoleIcon(role);
                      const userCount = csvPreview.filter(
                        (user) => user.role === role
                      ).length;
                      return (
                        <div key={role} className="p-3 bg-muted rounded-md">
                          <div className="flex items-center gap-2 mb-2">
                            <RoleIcon className="h-4 w-4" />
                            <Badge variant={getRoleBadgeVariant(role)}>
                              {getRoleDisplayName(role)}
                            </Badge>
                            <span className="text-sm text-muted-foreground">
                              ({userCount} user{userCount !== 1 ? "s" : ""})
                            </span>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {role === "admin" &&
                              "Will have full system access and user management permissions."}
                            {role === "instructional" &&
                              "Will have permissions to manage instructors and teaching assistants."}
                            {role === "instructor" &&
                              "Will have permissions to manage assigned classes and teaching assistants."}
                            {role === "ta" &&
                              "Will have permissions to assist with assigned classes."}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Bulk Class Assignment Section */}
                <div className="space-y-2">
                  <Label>Bulk Class Assignment</Label>

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
                              id={`bulk-class-${classItem.id}`}
                              checked={selectedClassIds.includes(classItem.id)}
                              onCheckedChange={() =>
                                handleBulkClassToggle(classItem.id)
                              }
                            />
                            <Label
                              htmlFor={`bulk-class-${classItem.id}`}
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
                                  {classItem.term.charAt(0).toUpperCase() +
                                    classItem.term.slice(1)}{" "}
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
                    {selectedClassIds.length} class
                    {selectedClassIds.length !== 1 ? "es" : ""} selected for all
                    users
                  </p>
                </div>

                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setCsvPreview([]);
                      setSelectedClassIds([]);
                    }}
                  >
                    Cancel
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
      </Tabs>
    </div>
  );
}
