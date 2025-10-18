/**
 * Parameters.tsx
 * Parameters component showing overview of parameter items
 * @AshokSaravanan222 & @siladiea
 * 07/21/2025
 */
"use client";
import {
  Book,
  Calendar,
  Clock,
  Edit,
  Hash,
  List,
  MapPin,
  Plus,
  Sparkles,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

import { useProfile } from "@/contexts/profile-context";
import { useParametersList } from "@/lib/api/v2/hooks/parameters";
import type { ParameterItem } from "@/lib/api/v2/schemas/parameters";
import { ParametersDataTable } from "./ParametersDataTable";

export default function Parameters() {
  const router = useRouter();
  const { effectiveProfile, departmentIds } = useProfile();

  // V2 API: Single fetch with pre-calculated counts and permissions
  const filters = useMemo(
    () => ({
      departmentIds: departmentIds,
      profileId: effectiveProfile?.id || "",
    }),
    [departmentIds, effectiveProfile?.id]
  );

  const { data: parametersData, isLoading } = useParametersList(filters);
  const parameters = useMemo(
    () => parametersData?.parameters || [],
    [parametersData]
  );

  const getParameterIcon = (parameter: ParameterItem) => {
    // Return different icons based on parameter name or type
    const name = parameter.name.toLowerCase();
    if (name.includes("class") || name.includes("course"))
      return <Book className="h-5 w-5" />;
    if (name.includes("location") || name.includes("place"))
      return <MapPin className="h-5 w-5" />;
    if (name.includes("deadline") || name.includes("due"))
      return <Calendar className="h-5 w-5" />;
    if (name.includes("time") || name.includes("hour"))
      return <Clock className="h-5 w-5" />;
    if (parameter.numerical) return <Hash className="h-5 w-5" />;
    return <List className="h-5 w-5" />;
  };

  const renderParameterCard = (parameter: ParameterItem) => {
    const count = parameter.num_items; // Pre-calculated from server

    return (
      <Card
        key={parameter.parameter_id}
        className="relative flex flex-col h-full"
      >
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <CardTitle className="text-lg flex items-center gap-2">
                {getParameterIcon(parameter)}
                {parameter.name}
              </CardTitle>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="outline">
                  {count} {count === 1 ? "item" : "items"}
                </Badge>
                {parameter.default_parameter && (
                  <Badge variant="secondary" className="text-xs">
                    Default
                  </Badge>
                )}
                {parameter.numerical && (
                  <Badge variant="default" className="text-xs">
                    Numerical
                  </Badge>
                )}
                {!parameter.active && (
                  <Badge variant="secondary" className="text-xs">
                    Inactive
                  </Badge>
                )}
              </div>
            </div>
            {parameter.can_edit && (
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  router.push(
                    `/management/parameters/p/${parameter.parameter_id}`
                  )
                }
                aria-label={`Edit ${parameter.name}`}
              >
                <Edit className="h-4 w-4" />
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="pt-0 flex-grow flex flex-col">
          {/* Simplified - no item preview since items not in list response */}
          <p className="text-sm text-muted-foreground">
            {parameter.description}
          </p>
        </CardContent>
      </Card>
    );
  };

  const renderEmptyState = () => (
    <div className="col-span-full">
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Sparkles className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">No parameters yet</h3>
          <p className="text-muted-foreground text-center mb-4">
            Create your first parameter to organize configuration options
          </p>
          <Button onClick={() => router.push("/management/parameters/new")}>
            <Plus className="h-4 w-4 mr-2" />
            Create Your First Parameter
          </Button>
        </CardContent>
      </Card>
    </div>
  );

  if (isLoading) {
    return (
      <div className="space-y-6">
        {/* Header skeleton */}
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-32" />
        </div>

        {/* Parameters grid skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <Card key={i} className="overflow-hidden">
              <CardHeader className="pb-4">
                <div className="flex items-start justify-between">
                  <div className="space-y-2">
                    <Skeleton className="h-5 w-32" />
                    <Skeleton className="h-4 w-24" />
                  </div>
                  <Skeleton className="h-8 w-8 rounded" />
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <Skeleton className="h-4 w-full mb-2" />
                <Skeleton className="h-4 w-3/4 mb-3" />
                <div className="flex items-center gap-2">
                  <Skeleton className="h-3 w-3" />
                  <Skeleton className="h-3 w-16" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {parameters.length === 0 ? (
        renderEmptyState()
      ) : (
        <ParametersDataTable
          parameters={parameters}
          renderParameterCard={renderParameterCard}
        />
      )}
    </div>
  );
}
