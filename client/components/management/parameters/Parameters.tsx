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

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

import { useDepartments } from "@/contexts/departments-context";
import { useParameterColumns } from "@/hooks/use-parameter-columns";
import { useParameterItems } from "@/lib/api/hooks/parameter_items";
import { useParametersByDepartmentIdBatch } from "@/lib/api/hooks/parameters";
import { Parameter, ParameterItem } from "@/types";
import { ParametersDataTable } from "./ParametersDataTable";

export default function Parameters() {
  const router = useRouter();
  const { selectedDepartmentIds } = useDepartments();

  const { data: parameters = [] } = useParametersByDepartmentIdBatch(
    selectedDepartmentIds
  );
  const { data: parameterItems = [], isLoading: parameterItemsLoading } =
    useParameterItems();

  // Get table columns and filter options
  const {
    columns,
    typeOptions,
    itemCountOptions,
    statusOptions,
    scenarioOptions,
  } = useParameterColumns();

  // Group parameter items by parameter
  const parameterItemsByParameter = parameterItems.reduce(
    (acc, item) => {
      if (!acc[item.parameterId]) {
        acc[item.parameterId] = [];
      }
      acc[item.parameterId]!.push(item);
      return acc;
    },
    {} as Record<string, ParameterItem[]>
  );

  const getParameterIcon = (parameter: Parameter) => {
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

  const renderParameterCard = (parameter: Parameter) => {
    const items = parameterItemsByParameter[parameter.id] || [];
    const count = items.length;
    const isLoading = parameterItemsLoading;

    const renderPreview = (items: ParameterItem[]) => {
      if (parameter.numerical) {
        // For numerical parameters, show sorted values
        const sortedItems = [...items].sort((a, b) => {
          const aVal = parseFloat(a.value) || 0;
          const bVal = parseFloat(b.value) || 0;
          return aVal - bVal;
        });

        return (
          <div className="space-y-2">
            {sortedItems.slice(0, 3).map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between p-2 bg-muted/50 rounded-md"
              >
                <div>
                  <p className="text-sm font-medium">{item.name}</p>
                  <p className="text-xs text-muted-foreground">
                    Value: {item.value}
                  </p>
                </div>
                {item.defaultItem && (
                  <Badge variant="secondary" className="text-xs">
                    Default
                  </Badge>
                )}
              </div>
            ))}
            {items.length > 3 && (
              <p className="text-xs text-muted-foreground">
                +{items.length - 3} more
              </p>
            )}
          </div>
        );
      } else {
        // For non-numerical parameters, show items with descriptions
        return (
          <div className="space-y-2">
            {items.slice(0, 3).map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between p-2 bg-muted/50 rounded-md"
              >
                <div>
                  <p className="text-sm font-medium">{item.name}</p>
                  <p className="text-xs text-muted-foreground line-clamp-1">
                    {item.description}
                  </p>
                </div>
                {item.defaultItem && (
                  <Badge variant="secondary" className="text-xs">
                    Default
                  </Badge>
                )}
              </div>
            ))}
            {items.length > 3 && (
              <p className="text-xs text-muted-foreground">
                +{items.length - 3} more
              </p>
            )}
          </div>
        );
      }
    };

    return (
      <Card key={parameter.id} className="relative flex flex-col h-full">
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
                {parameter.numerical && (
                  <Badge variant="secondary" className="text-xs">
                    Numerical
                  </Badge>
                )}
                {parameter.active && (
                  <Badge variant="default" className="text-xs">
                    Active
                  </Badge>
                )}
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                router.push(`/management/parameters/p/${parameter.id}`)
              }
              aria-label={`Edit ${parameter.name}`}
            >
              <Edit className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pt-0 flex-grow flex flex-col">
          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          ) : count === 0 ? (
            <p className="text-sm text-muted-foreground">No items yet</p>
          ) : (
            renderPreview(items)
          )}
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

  const isLoading = parameterItemsLoading;

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
          columns={columns}
          data={parameters}
          typeOptions={typeOptions}
          itemCountOptions={itemCountOptions}
          statusOptions={statusOptions}
          scenarioOptions={scenarioOptions}
          renderParameterCard={renderParameterCard}
        />
      )}
    </div>
  );
}
