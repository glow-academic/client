/**
 * NewStaff.tsx
 * Used to display the new staff page.
 * @AshokSaravanan222 & @siladiea
 * 06/07/2025
 */

"use client";
import { Download, Shield, User } from "lucide-react";
import { useRouter } from "next/navigation";
import React from "react";

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
import { useProfile } from "@/contexts/profile-context";
import { profileRole } from "@/utils/drizzle/schema";
import { logError } from "@/utils/logger";
import { createProfile } from "@/utils/mutations/profiles/create-profile";
type ProfileRole = (typeof profileRole.enumValues)[number];

interface CSVUser {
  firstName: string;
  lastName: string;
  alias: string;
  role: ProfileRole;
}

const getRoleIcon = (role: string) => {
  switch (role) {
    case "superadmin":
      return Shield;
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
    case "superadmin":
      return "Super Administrator";
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
    case "superadmin":
      return "destructive";
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
  });
  const [csvPreview, setCsvPreview] = React.useState<CSVUser[]>([]);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const { effectiveProfile } = useProfile();

  // Check if current user is admin
  const isCurrentUserAdmin = effectiveProfile?.role === "admin";

  // Available roles based on current user permissions
  const availableRoles = React.useMemo(() => {
    const baseRoles = [
      {
        value: "superadmin" as ProfileRole,
        label: "Super Administrator",
        icon: Shield,
      },
      {
        value: "instructional" as ProfileRole,
        label: "Instructional Staff",
        icon: Shield,
      },
      {
        value: "instructor" as ProfileRole,
        label: "Instructor",
        icon: User,
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

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
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
            Boolean(user.firstName) && Boolean(user.lastName),
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
          }),
        ),
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
                  Will be used as {formData.alias}@
                  {process.env["NEXT_PUBLIC_CAMPUS_EMAIL"]}
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
                  {formData.role === "ta" &&
                    "Will have permissions to assist with assigned classes."}
                </p>
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.back()}
                disabled={isSubmitting}
              >
                Back
              </Button>
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
                      new Set(csvPreview.map((user) => user.role)),
                    ).map((role) => {
                      const RoleIcon = getRoleIcon(role);
                      const userCount = csvPreview.filter(
                        (user) => user.role === role,
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
                            {role === "ta" &&
                              "Will have permissions to assist with assigned classes."}
                          </p>
                        </div>
                      );
                    })}
                  </div>
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
