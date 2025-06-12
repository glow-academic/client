/**
 * NewStaff.tsx
 * Used to display the new staff page.
 * @AshokSaravanan222 & @siladiea
 * 06/07/2025
 */

"use client";
import React from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Download, X, Shield, GraduationCap, User } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
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
import { getAllClasses } from "@/utils/queries/classes/get-all-classes";
import { useSession } from "next-auth/react";
import { getProfilesByUser } from "@/utils/queries/profiles/get-profiles-by-user";
import { getUserByEmail } from "@/utils/user/get-user-by-email";

type ProfileRole = "admin" | "instructional" | "instructor" | "ta";

interface CSVUser {
  firstName: string;
  lastName: string;
  alias: string;
  role: ProfileRole;
  classIds: string[];
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
  const [csvFile, setCsvFile] = React.useState<File | null>(null);
  const [csvPreview, setCsvPreview] = React.useState<CSVUser[]>([]);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  // Get current user's profile to check if they're admin
  const session = useSession();
  const userEmail = session.data?.user?.email;

  const { data: user } = useQuery({
    queryKey: ["user", userEmail],
    queryFn: () => getUserByEmail(userEmail!),
  });

  const { data: currentUserProfile } = useQuery({
    queryKey: ["profile", userEmail],
    queryFn: () => getProfilesByUser(user!.id!),
    select: (data) => data[0],
    enabled: !!user,
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
      ? currentClassIds.filter(id => id !== classId)
      : [...currentClassIds, classId];
    
    handleInputChange("classIds", newClassIds);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.role) return;

    setIsSubmitting(true);
    try {
      // TODO: Implement API call to create staff member
      console.log("Creating staff member:", formData);

      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 1000));

      router.push("/management/staff");
    } catch (error) {
      console.error("Error creating staff member:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type === "text/csv") {
      setCsvFile(file);
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
            classIds: values[4]
              ? values[4].split(";").map((id) => id.trim())
              : [],
          };
        })
        .filter(
          (user): user is CSVUser =>
            Boolean(user.firstName) && Boolean(user.lastName),
        );

      setCsvPreview(users);
    };
    reader.readAsText(file);
  };

  const downloadTemplate = () => {
    const headers = ["firstName", "lastName", "alias", "role", "classIds"];
    const examples = [
      [
        "Sarah",
        "Johnson", 
        "sjohnson",
        "instructional",
        "class1;class2",
      ],
      [
        "Jane",
        "Smith",
        "jsmith",
        "instructor",
        "class1;class2",
      ],
      ["John", "Doe", "jdoe", "ta", "class1;class2"],
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
      // TODO: Implement API call to bulk create staff members
      console.log("Creating staff members from CSV:", csvPreview);

      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 2000));

      router.push("/management/staff");
    } catch (error) {
      console.error("Error creating staff members from CSV:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 py-4 px-4">
      <Tabs defaultValue="single" className="space-y-4">
        <TabsList>
          <TabsTrigger value="single">Single User</TabsTrigger>
          <TabsTrigger value="csv">CSV Import</TabsTrigger>
        </TabsList>

        <TabsContent value="single">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">First Name</Label>
                <Input
                  id="firstName"
                  value={formData.firstName}
                  onChange={(e) => handleInputChange("firstName", e.target.value)}
                  placeholder="Enter first name"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Last Name</Label>
                <Input
                  id="lastName"
                  value={formData.lastName}
                  onChange={(e) => handleInputChange("lastName", e.target.value)}
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
                  Will be used as {formData.alias}@purdue.edu
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="role">Role</Label>
                <Select
                  value={formData.role}
                  onValueChange={(value: ProfileRole) => handleInputChange("role", value)}
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
              <p className="text-sm text-muted-foreground">
                Select which classes this user should have access to.
              </p>
              <div className="border rounded-md p-4 max-h-60 overflow-y-auto">
                {allClasses.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No classes available
                  </p>
                ) : (
                  <div className="space-y-3">
                    {allClasses.map((classItem: any) => (
                      <div key={classItem.id} className="flex items-center space-x-2">
                        <Checkbox
                          id={`class-${classItem.id}`}
                          checked={formData.classIds.includes(classItem.id)}
                          onCheckedChange={() => handleClassToggle(classItem.id)}
                        />
                        <Label 
                          htmlFor={`class-${classItem.id}`}
                          className="text-sm font-normal cursor-pointer flex-1"
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <span className="font-medium">{classItem.classCode}</span>
                              <span className="text-muted-foreground ml-2">{classItem.name}</span>
                            </div>
                            <Badge variant="outline" className="text-xs">
                              {classItem.term} {classItem.year}
                            </Badge>
                          </div>
                        </Label>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                {formData.classIds.length} class{formData.classIds.length !== 1 ? 'es' : ''} selected
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
              <div className="flex items-center gap-2">
                <Button variant="outline" onClick={downloadTemplate}>
                  <Download className="h-4 w-4 mr-2" />
                  Download Template
                </Button>
              </div>
              <div className="text-sm text-muted-foreground">
                Include the following columns in the CSV file: firstName, lastName,
                alias, role, classIds.
              </div>
            </div>

            <div className="p-3 bg-muted rounded-md">
              <p className="text-sm font-medium mb-1">Available Roles:</p>
              <div className="flex gap-2 flex-wrap">
                {availableRoles.map((role) => {
                  const RoleIcon = role.icon;
                  return (
                    <Badge
                      key={role.value}
                      variant={getRoleBadgeVariant(role.value)}
                    >
                      <RoleIcon className="h-3 w-3 mr-1" />
                      {role.value}
                    </Badge>
                  );
                })}
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

            {csvFile && (
              <div className="p-3 bg-muted rounded-md">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Selected file:</p>
                    <p className="text-sm text-muted-foreground">
                      {csvFile.name}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setCsvFile(null);
                      setCsvPreview([]);
                    }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}

            {csvPreview.length > 0 && (
              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-medium">
                    Preview ({csvPreview.length} users)
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Review the staff members that will be created from your CSV
                    file.
                  </p>
                </div>

                <div className="rounded-md border max-h-96 overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>First Name</TableHead>
                        <TableHead>Last Name</TableHead>
                        <TableHead>Username</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Classes</TableHead>
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
                            <TableCell>
                              <div className="flex gap-1 flex-wrap">
                                {user.classIds.map((classId, i) => (
                                  <Badge
                                    key={i}
                                    variant="outline"
                                    className="text-xs"
                                  >
                                    {classId}
                                  </Badge>
                                ))}
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
                      setCsvFile(null);
                      setCsvPreview([]);
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
