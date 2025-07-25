/**
 * Providers.tsx
 * Used to display the models page with all created models and management functionality.
 * @AshokSaravanan222 & @siladiea
 * 06/18/2025
 */
"use client";
import { logError } from "@/utils/logger";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Cpu, Edit, Plus, Settings, Sparkles, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { deleteModel } from "@/utils/mutations/models/delete-model";
import { getAllModels } from "@/utils/queries/models/get-all-models";
import { getAllProviders } from "@/utils/queries/providers/get-all-providers";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import { useProviderColumns } from "@/hooks/use-provider-columns";
import { Model, Provider } from "@/types";
import { ProvidersDataTableToolbar } from "./ProvidersDataTableToolbar";

interface ProviderGroup {
  provider: Provider;
  models: Model[];
}

export default function Providers() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteItem, setDeleteItem] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Filter states
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedProviders, setSelectedProviders] = useState<string[]>([]);
  const [selectedModelTypes, setSelectedModelTypes] = useState<string[]>([]);
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);

  // Fetch models and providers data
  const { data: models = [], refetch: refetchModels } = useQuery({
    queryKey: ["models"],
    queryFn: () => getAllModels(),
  });

  const { data: providers = [] } = useQuery({
    queryKey: ["providers"],
    queryFn: () => getAllProviders(),
  });

  // Get filter options
  const { providerOptions, customModelOptions, statusOptions } =
    useProviderColumns();

  // Filter models based on search and filters
  const filteredModels = useMemo(() => {
    return models.filter((model: Model) => {
      const provider = providers.find(
        (p: Provider) => p.id === model.providerId
      );
      const modelName = model.name.toLowerCase();
      const modelDescription = (model.description || "").toLowerCase();
      const providerName = provider?.name.toLowerCase() || "";
      const searchLower = searchTerm.toLowerCase();

      // Search filter
      const matchesSearch =
        !searchTerm ||
        modelName.includes(searchLower) ||
        modelDescription.includes(searchLower) ||
        providerName.includes(searchLower);

      // Provider filter
      const matchesProvider =
        selectedProviders.length === 0 ||
        selectedProviders.includes(model.providerId);

      // Model type filter
      const isCustom = provider?.baseUrl ? "Custom" : "Standard";
      const matchesModelType =
        selectedModelTypes.length === 0 ||
        selectedModelTypes.includes(isCustom);

      // Status filter
      const status = model.active ? "Active" : "Inactive";
      const matchesStatus =
        selectedStatuses.length === 0 || selectedStatuses.includes(status);

      return (
        matchesSearch && matchesProvider && matchesModelType && matchesStatus
      );
    });
  }, [
    models,
    providers,
    searchTerm,
    selectedProviders,
    selectedModelTypes,
    selectedStatuses,
  ]);

  // Pagination logic
  const totalModels = filteredModels.length;
  const totalPages = Math.ceil(totalModels / pageSize);
  const startIndex = currentPage * pageSize;
  const endIndex = startIndex + pageSize;

  // Get models for current page
  const paginatedModels = filteredModels.slice(startIndex, endIndex);
  const paginatedProviderGroups: ProviderGroup[] = useMemo(() => {
    return providers
      .map((provider: Provider) => ({
        provider,
        models: paginatedModels.filter(
          (model: Model) => model.providerId === provider.id
        ),
      }))
      .filter((group: ProviderGroup) => group.models.length > 0);
  }, [providers, paginatedModels]);

  const handleDelete = async () => {
    if (!deleteItem) return;

    setIsDeleting(true);
    try {
      await deleteModel(deleteItem.id);

      toast.success("Model deleted successfully");
      // Invalidate queries to ensure all components refresh
      queryClient.invalidateQueries({ queryKey: ["models"] });
      refetchModels();
    } catch (error) {
      logError("Error deleting model:", error);
      toast.error("Failed to delete model");
    } finally {
      setIsDeleting(false);
      setShowDeleteDialog(false);
      setDeleteItem(null);
    }
  };

  const handleDeleteClick = (id: string, name: string) => {
    setDeleteItem({ id, name });
    setShowDeleteDialog(true);
  };

  const handleEdit = (id: string) => {
    router.push(`/system/providers/p/${id}/m/${id}`);
  };

  const handleSearchChange = (value: string) => {
    setSearchTerm(value);
    setCurrentPage(0); // Reset to first page when searching
  };

  const handleProviderFilterChange = (values: string[]) => {
    setSelectedProviders(values);
    setCurrentPage(0);
  };

  const handleModelTypeFilterChange = (values: string[]) => {
    setSelectedModelTypes(values);
    setCurrentPage(0);
  };

  const handleStatusFilterChange = (values: string[]) => {
    setSelectedStatuses(values);
    setCurrentPage(0);
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handlePageSizeChange = (size: number) => {
    setPageSize(size);
    setCurrentPage(0);
  };

  const resetFilters = () => {
    setSearchTerm("");
    setSelectedProviders([]);
    setSelectedModelTypes([]);
    setSelectedStatuses([]);
    setCurrentPage(0);
  };

  const renderEmptyState = () => (
    <div className="col-span-full">
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Sparkles className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">No models yet</h3>
          <p className="text-muted-foreground text-center mb-4">
            Create your first model to get started
          </p>
        </CardContent>
      </Card>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Filter Section */}
      <div className="space-y-4">
        <ProvidersDataTableToolbar
          searchTerm={searchTerm}
          selectedProviders={selectedProviders}
          selectedModelTypes={selectedModelTypes}
          selectedStatuses={selectedStatuses}
          providerOptions={providerOptions}
          customModelOptions={customModelOptions}
          statusOptions={statusOptions}
          onSearchChange={handleSearchChange}
          onProviderFilterChange={handleProviderFilterChange}
          onModelTypeFilterChange={handleModelTypeFilterChange}
          onStatusFilterChange={handleStatusFilterChange}
          onResetFilters={resetFilters}
        />
      </div>

      {/* Models Content */}
      {models.length === 0 ? (
        renderEmptyState()
      ) : (
        <>
          {paginatedProviderGroups.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No models match the current filters.
            </div>
          ) : (
            <div className="space-y-6">
              {paginatedProviderGroups.map((group: ProviderGroup) => (
                <div key={group.provider.id} className="space-y-4">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-3">
                      <Badge variant="secondary" className="text-sm px-3 py-1">
                        {group.provider.name}
                      </Badge>
                      <span className="text-sm text-muted-foreground">
                        {group.provider.description}
                      </span>
                    </div>
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() =>
                        router.push(`/system/providers/p/${group.provider.id}`)
                      }
                    >
                      <Settings className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {group.models
                      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
                      .map((model: Model) => (
                        <Card
                          key={model.id}
                          className="hover:shadow-md transition-shadow"
                        >
                          <CardHeader>
                            <div className="flex justify-between items-start">
                              <div className="space-y-1">
                                <CardTitle className="text-base flex items-center gap-2">
                                  <Cpu className="h-4 w-4" />
                                  {model.name}
                                </CardTitle>
                                <CardDescription className="text-xs line-clamp-2">
                                  {model.description}
                                </CardDescription>
                              </div>
                              <Badge
                                variant={model.active ? "default" : "secondary"}
                              >
                                {model.active ? "Active" : "Inactive"}
                              </Badge>
                            </div>
                          </CardHeader>
                          <CardFooter className="flex justify-end gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleEdit(model.id)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                handleDeleteClick(model.id, model.name)
                              }
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </CardFooter>
                        </Card>
                      ))}

                    {/* Create New Model Card for this provider */}
                    <Card
                      className="border-dashed border-2 hover:border-dashed hover:border-primary/50 transition-colors cursor-pointer"
                      onClick={() =>
                        router.push(
                          `/system/providers/p/${group.provider.id}/new`
                        )
                      }
                    >
                      <CardContent className="flex flex-col items-center justify-center py-12">
                        <Plus className="h-8 w-8 text-muted-foreground mb-3" />
                        <h3 className="text-sm font-medium text-muted-foreground mb-1">
                          Create New Model
                        </h3>
                        <p className="text-xs text-muted-foreground text-center">
                          Add a new model to {group.provider.name}
                        </p>
                      </CardContent>
                    </Card>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Pagination Section */}
          {totalModels > 0 && (
            <div className="flex items-center justify-between px-2">
              <div className="flex-1 text-sm text-muted-foreground">
                Showing {startIndex + 1} to {Math.min(endIndex, totalModels)} of{" "}
                {totalModels} models.
              </div>
              <div className="flex items-center space-x-6 lg:space-x-8">
                <div className="flex items-center space-x-2">
                  <p className="text-sm font-medium">Models per page</p>
                  <select
                    value={pageSize}
                    onChange={(e) =>
                      handlePageSizeChange(Number(e.target.value))
                    }
                    className="h-8 w-[70px] rounded border border-input bg-background px-3 py-1 text-sm"
                  >
                    {[10, 20, 30, 40, 50].map((size) => (
                      <option key={size} value={size}>
                        {size}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex w-[100px] items-center justify-center text-sm font-medium">
                  Page {currentPage + 1} of {totalPages || 1}
                </div>
                <div className="flex items-center space-x-2">
                  <Button
                    variant="outline"
                    className="hidden h-8 w-8 p-0 lg:flex"
                    onClick={() => handlePageChange(0)}
                    disabled={currentPage === 0}
                  >
                    <span className="sr-only">Go to first page</span>
                    <svg
                      className="h-4 w-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M11 19l-7-7 7-7m8 14l-7-7 7-7"
                      />
                    </svg>
                  </Button>
                  <Button
                    variant="outline"
                    className="h-8 w-8 p-0"
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage === 0}
                  >
                    <span className="sr-only">Go to previous page</span>
                    <svg
                      className="h-4 w-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15 19l-7-7 7-7"
                      />
                    </svg>
                  </Button>
                  <Button
                    variant="outline"
                    className="h-8 w-8 p-0"
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage >= totalPages - 1}
                  >
                    <span className="sr-only">Go to next page</span>
                    <svg
                      className="h-4 w-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 5l7 7-7 7"
                      />
                    </svg>
                  </Button>
                  <Button
                    variant="outline"
                    className="hidden h-8 w-8 p-0 lg:flex"
                    onClick={() => handlePageChange(totalPages - 1)}
                    disabled={currentPage >= totalPages - 1}
                  >
                    <span className="sr-only">Go to last page</span>
                    <svg
                      className="h-4 w-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M13 5l7 7-7 7m-8 0l7-7-7-7"
                      />
                    </svg>
                  </Button>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the model "{deleteItem?.name}". This
              action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
