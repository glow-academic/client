/**
 * DepartmentAccessDenied.tsx
 * Component for displaying department access denied messages
 * Server component - uses Next.js Link for navigation
 * @AshokSaravanan222
 * 01/20/2025
 */
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ShieldX } from "lucide-react";
import Link from "next/link";

interface DepartmentAccessDeniedProps {
  resourceType:
    | "scenario"
    | "simulation"
    | "cohort"
    | "persona"
    | "department"
    | "agent"
    | "rubric"
    | "parameter";
  redirectPath: string;
}

export function DepartmentAccessDenied({
  resourceType,
  redirectPath,
}: DepartmentAccessDeniedProps) {
  const getResourceName = () => {
    switch (resourceType) {
      case "scenario":
        return "scenario";
      case "simulation":
        return "simulation";
      case "cohort":
        return "cohort";
      case "persona":
        return "persona";
      case "department":
        return "department";
      case "agent":
        return "agent";
      case "rubric":
        return "rubric";
      case "parameter":
        return "parameter";
      default:
        return "resource";
    }
  };

  const getListPath = () => {
    switch (resourceType) {
      case "scenario":
        return "/create/scenarios";
      case "simulation":
        return "/create/simulations";
      case "cohort":
        return "/cohorts";
      case "persona":
        return "/create/personas";
      case "department":
        return "/management/departments";
      case "agent":
        return "/management/agents";
      case "rubric":
        return "/management/rubrics";
      case "parameter":
        return "/management/parameters";
      default:
        return "/";
    }
  };

  const resourceNameCapitalized =
    getResourceName().charAt(0).toUpperCase() + getResourceName().slice(1);

  return (
    <div className="container mx-auto p-4">
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <ShieldX className="h-8 w-8 text-orange-500" />
            </div>
            <CardTitle className="text-xl">Access Restricted</CardTitle>
            <CardDescription>
              This {getResourceName()} is restricted to other departments. You
              don't have permission to access it.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <div className="flex flex-col gap-2">
              <Button asChild className="w-full">
                <Link href={redirectPath}>
                  Go to {resourceNameCapitalized}s List
                </Link>
              </Button>
              <Button asChild variant="outline" className="w-full">
                <Link href={getListPath()}>
                  View All {resourceNameCapitalized}s
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
