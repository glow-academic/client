"use client";
import * as React from "react";

import { DepartmentPicker } from "@/components/common/forms/DepartmentPicker";
import { ParameterItemPicker } from "@/components/common/forms/ParameterItemPicker";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useProfile } from "@/contexts/profile-context";
import {
  getDefaultDepartmentIds,
  transformDepartmentIdsForSubmit,
} from "@/utils/department-picker-helpers";
import { Building2, Tag, X } from "lucide-react";
import { useMemo } from "react";
import { toast } from "sonner";

type ParameterItemMappingItem = {
  name: string;
  description: string;
  parameter_id: string;
  parameter_name: string;
};

type ParameterMappingItem = {
  name: string;
  description: string;
  document_parameter: boolean;
};

export type FileClassification = {
  parameterItemIds: string[];
  departmentIds?: string[];
};

export interface UploadClassificationDialogProps {
  open: boolean;
  files: File[];
  onClose: () => void;
  onConfirm: (
    perFile: Record<string, FileClassification>,
    defaultsForZip: FileClassification,
  ) => void;
  onAddFiles?: (files: File[]) => void;
  onRemoveFile?: (fileName: string) => void;
  departmentMapping: Record<
    string,
    { name: string; description: string; parameter_item_ids?: string[] | null }
  >;
  validDepartmentIds: string[];
  parameterItemMapping: Record<string, ParameterItemMappingItem>;
  parameterMapping: Record<string, ParameterMappingItem>;
  validParameterItemIds: string[];
}

export function UploadClassificationDialog({
  open,
  files,
  onClose,
  onConfirm,
  onAddFiles,
  onRemoveFile,
  departmentMapping,
  validDepartmentIds,
  parameterItemMapping,
  parameterMapping,
  validParameterItemIds,
}: UploadClassificationDialogProps) {
  const { effectiveProfile } = useProfile();
  const isSuperadmin = effectiveProfile?.role === "superadmin";
  const defaultDepartmentIds = useMemo(
    () =>
      getDefaultDepartmentIds(
        isSuperadmin,
        effectiveProfile?.primaryDepartmentId ?? null,
      ),
    [isSuperadmin, effectiveProfile?.primaryDepartmentId],
  );

  // Per-file classification state (keyed by file.name)
  const [perFile, setPerFile] = React.useState<
    Record<string, FileClassification>
  >({});
  const [_zipDefaults, _setZipDefaults] = React.useState<FileClassification>({
    parameterItemIds: [],
  });
  // Global defaults state
  const [globalDefaultParameterItemIds, setGlobalDefaultParameterItemIds] =
    React.useState<string[]>([]);
  // Department selection state - default based on role
  const [selectedDepartmentIds, setSelectedDepartmentIds] =
    React.useState<string[]>(defaultDepartmentIds);

  // Per-file "keep default" state - when true, that file uses all defaults
  const [keepDefaultPerFile, setKeepDefaultPerFile] = React.useState<
    Record<string, boolean>
  >({});

  // Staged selections per department (preserved when departments are deselected)
  type StagedSelections = {
    apply_all_parameter_item_ids?: string[];
    per_file_parameter_item_ids?: Record<string, string[]>;
  };
  // State is used indirectly through functional updates (prev parameter)
  const [_stagedSelections, setStagedSelections] = React.useState<
    Record<string, StagedSelections>
  >({});
  const [previousDepartmentIds, setPreviousDepartmentIds] = React.useState<
    string[]
  >([]);

  // Identify document_parameter=true parameters (required for each document)
  const documentParameterIds = React.useMemo(() => {
    return Object.keys(parameterMapping).filter(
      (paramId) => parameterMapping[paramId]?.document_parameter === true,
    );
  }, [parameterMapping]);

  // Filter valid parameter item IDs based on selected departments
  // Uses parameter_item_ids from department mapping (like Scenario.tsx)
  const filteredValidParameterItemIds = React.useMemo(() => {
    const selectedDeptIds = selectedDepartmentIds || [];

    // If no departments selected, return all valid IDs
    if (selectedDeptIds.length === 0) {
      return validParameterItemIds;
    }

    // Get union of parameter_item_ids from selected departments
    const selectedDeptParameterItemIds = new Set<string>();
    selectedDeptIds.forEach((deptId) => {
      const deptData = departmentMapping[deptId];
      if (
        deptData &&
        "parameter_item_ids" in deptData &&
        Array.isArray(deptData.parameter_item_ids)
      ) {
        deptData.parameter_item_ids.forEach((id: string) =>
          selectedDeptParameterItemIds.add(id),
        );
      }
    });

    // Get union of parameter_item_ids from ALL departments (to identify cross-department items)
    const allDeptParameterItemIds = new Set<string>();
    Object.values(departmentMapping).forEach((deptData) => {
      if (
        deptData?.parameter_item_ids &&
        Array.isArray(deptData.parameter_item_ids)
      ) {
        deptData.parameter_item_ids.forEach((id: string) =>
          allDeptParameterItemIds.add(id),
        );
      }
    });

    // Include items that are:
    // 1. In selected departments
    // 2. Cross-department (not in any department's parameter_item_ids)
    // 3. Currently selected (preserved for edit mode)
    return validParameterItemIds.filter((itemId) => {
      const inSelectedDepts = selectedDeptParameterItemIds.has(itemId);
      const isCrossDept = !allDeptParameterItemIds.has(itemId); // Not in any department = cross-department
      return inSelectedDepts || isCrossDept;
    });
  }, [validParameterItemIds, selectedDepartmentIds, departmentMapping]);

  // Track department changes and manage staged selections
  React.useEffect(() => {
    const currentDeptIds = selectedDepartmentIds || [];
    const prevDeptIds = previousDepartmentIds || [];

    // Skip if no change (initial load or same selection)
    if (
      currentDeptIds.length === prevDeptIds.length &&
      currentDeptIds.every((id, idx) => id === prevDeptIds[idx])
    ) {
      // Initialize on first load
      if (prevDeptIds.length === 0 && currentDeptIds.length > 0) {
        setPreviousDepartmentIds(currentDeptIds);
      }
      return;
    }

    // Find departments that were deselected
    const deselectedDepts = prevDeptIds.filter(
      (id) => !currentDeptIds.includes(id),
    );

    // Find departments that were newly selected
    const newlySelectedDepts = currentDeptIds.filter(
      (id) => !prevDeptIds.includes(id),
    );

    // Save selections for deselected departments
    if (deselectedDepts.length > 0) {
      setStagedSelections((prev) => {
        const updated = { ...prev };
        deselectedDepts.forEach((deptId) => {
          // Save per-file parameter item IDs
          const perFileParams: Record<string, string[]> = {};
          Object.keys(perFile).forEach((fileName) => {
            const fileClass = perFile[fileName];
            if (fileClass) {
              perFileParams[fileName] = [...(fileClass.parameterItemIds || [])];
            }
          });

          updated[deptId] = {
            apply_all_parameter_item_ids: [...globalDefaultParameterItemIds],
            per_file_parameter_item_ids: perFileParams,
          };
        });
        return updated;
      });
    }

    // Restore selections for newly selected departments
    if (newlySelectedDepts.length > 0) {
      setStagedSelections((prev) => {
        newlySelectedDepts.forEach((deptId) => {
          const staged = prev[deptId];
          if (staged) {
            // Restore apply-all parameter items if valid
            if (
              staged.apply_all_parameter_item_ids &&
              staged.apply_all_parameter_item_ids.length > 0
            ) {
              const validParamSet = new Set(filteredValidParameterItemIds);
              const validParams = staged.apply_all_parameter_item_ids.filter(
                (id) => validParamSet.has(id),
              );
              if (validParams.length > 0) {
                setGlobalDefaultParameterItemIds((prevParams) => {
                  const combined = new Set([...prevParams, ...validParams]);
                  return Array.from(combined);
                });
              }
            }

            // Restore per-file parameter items if valid
            if (
              staged.per_file_parameter_item_ids &&
              Object.keys(staged.per_file_parameter_item_ids).length > 0
            ) {
              const validParamSet = new Set(filteredValidParameterItemIds);
              setPerFile((prevPerFile) => {
                const updated: Record<string, FileClassification> = {
                  ...prevPerFile,
                };
                Object.keys(staged.per_file_parameter_item_ids!).forEach(
                  (fileName) => {
                    const stagedParams =
                      staged.per_file_parameter_item_ids![fileName] || [];
                    const validParams = stagedParams.filter((id) =>
                      validParamSet.has(id),
                    );
                    if (validParams.length > 0 && updated[fileName]) {
                      const combined = new Set([
                        ...(updated[fileName].parameterItemIds || []),
                        ...validParams,
                      ]);
                      updated[fileName] = {
                        ...updated[fileName],
                        parameterItemIds: Array.from(combined),
                      };
                    }
                  },
                );
                return updated;
              });
            }
          }
        });
        return prev;
      });
    }

    // Update previous department IDs
    setPreviousDepartmentIds(currentDeptIds);
  }, [
    selectedDepartmentIds,
    previousDepartmentIds,
    globalDefaultParameterItemIds,
    perFile,
    filteredValidParameterItemIds,
  ]);

  // Clean up staged selections for departments that are no longer valid
  React.useEffect(() => {
    const validDeptIds = new Set(validDepartmentIds || []);
    setStagedSelections((prev) => {
      const cleaned: Record<string, StagedSelections> = {};
      Object.keys(prev).forEach((deptId) => {
        const staged = prev[deptId];
        if (validDeptIds.has(deptId) && staged) {
          cleaned[deptId] = staged;
        }
      });
      return cleaned;
    });
  }, [validDepartmentIds]);

  // Clear invalid parameter item selections when departments change
  React.useEffect(() => {
    // Clear apply-all selections that are no longer valid
    if (globalDefaultParameterItemIds.length > 0) {
      const validSet = new Set(filteredValidParameterItemIds);
      const filtered = globalDefaultParameterItemIds.filter((id) =>
        validSet.has(id),
      );
      if (filtered.length !== globalDefaultParameterItemIds.length) {
        setGlobalDefaultParameterItemIds(filtered);
      }
    }

    // Clear per-file selections that are no longer valid
    setPerFile((prev) => {
      const updated: Record<string, FileClassification> = {};
      let hasChanges = false;
      Object.entries(prev).forEach(([fileName, fc]) => {
        const validSet = new Set(filteredValidParameterItemIds);
        const filtered = (fc.parameterItemIds || []).filter((id) =>
          validSet.has(id),
        );
        if (filtered.length !== (fc.parameterItemIds || []).length) {
          hasChanges = true;
          updated[fileName] = { ...fc, parameterItemIds: filtered };
        } else {
          updated[fileName] = fc;
        }
      });
      return hasChanges ? updated : prev;
    });
  }, [filteredValidParameterItemIds, globalDefaultParameterItemIds]);

  React.useEffect(() => {
    // Initialize defaults for new files
    const next: Record<string, FileClassification> = {};
    files.forEach((f) => {
      const current: FileClassification = perFile[f.name] ?? {
        parameterItemIds: [...globalDefaultParameterItemIds],
      };
      next[f.name] = current;
    });
    setPerFile(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [files.map((f) => f.name).join("|")]);

  // Keep the apply-all parameter items preselected with the intersection across all files
  React.useEffect(() => {
    const allFiles = Object.values(perFile);
    if (allFiles.length === 0) {
      setGlobalDefaultParameterItemIds([]);
      return;
    }
    const intersection = allFiles
      .map((f) => new Set(f.parameterItemIds ?? []))
      .reduce<string[]>((acc, set, index) => {
        if (index === 0) return Array.from(set);
        return acc.filter((id) => set.has(id));
      }, []);
    setGlobalDefaultParameterItemIds(intersection);
  }, [perFile]);

  const applyParameterItemsToAll = (incomingIds: string[]) => {
    if (incomingIds.length === 0) return;
    setGlobalDefaultParameterItemIds((prev) => {
      const merged = Array.from(new Set([...prev, ...incomingIds]));
      return merged;
    });
    setPerFile((prev) =>
      Object.fromEntries(
        Object.entries(prev).map(([k, v]) => {
          const merged = Array.from(
            new Set([...(v.parameterItemIds ?? []), ...incomingIds]),
          );
          return [k, { ...v, parameterItemIds: merged }];
        }),
      ),
    );
    _setZipDefaults((p) => ({
      ...p,
      parameterItemIds: Array.from(
        new Set([...(p.parameterItemIds ?? []), ...incomingIds]),
      ),
    }));
  };

  const removeParameterItemsFromAll = (idsToRemove: string[]) => {
    if (idsToRemove.length === 0) return;
    setGlobalDefaultParameterItemIds((prev) =>
      prev.filter((id) => !idsToRemove.includes(id)),
    );
    setPerFile((prev) =>
      Object.fromEntries(
        Object.entries(prev).map(([k, v]) => {
          const nextIds = (v.parameterItemIds ?? []).filter(
            (id) => !idsToRemove.includes(id),
          );
          return [k, { ...v, parameterItemIds: nextIds }];
        }),
      ),
    );
    _setZipDefaults((p) => ({
      ...p,
      parameterItemIds: (p.parameterItemIds ?? []).filter(
        (id) => !idsToRemove.includes(id),
      ),
    }));
  };

  // Validation: Check that each document has at least one parameter item for each document_parameter=true parameter
  const validationErrors = React.useMemo(() => {
    const errors: Record<string, string[]> = {};

    if (documentParameterIds.length === 0) {
      return errors; // No document parameters required
    }

    files.forEach((file) => {
      const fc = perFile[file.name] ?? {
        parameterItemIds: [...globalDefaultParameterItemIds],
      };

      const selectedItemIds = fc.parameterItemIds || [];

      // For each document_parameter=true parameter, check if at least one item is selected
      documentParameterIds.forEach((paramId) => {
        // Find parameter items for this parameter
        const itemsForParam = filteredValidParameterItemIds.filter((itemId) => {
          const item = parameterItemMapping[itemId];
          return item && item.parameter_id === paramId;
        });

        // Check if at least one item from this parameter is selected
        const hasItemForParam = itemsForParam.some((itemId) =>
          selectedItemIds.includes(itemId),
        );

        if (!hasItemForParam && itemsForParam.length > 0) {
          if (!errors[file.name]) {
            errors[file.name] = [];
          }
          const paramName = parameterMapping[paramId]?.name || paramId;
          errors[file.name]!.push(
            `Required: Select at least one ${paramName} option`,
          );
        }
      });
    });

    return errors;
  }, [
    files,
    perFile,
    globalDefaultParameterItemIds,
    documentParameterIds,
    filteredValidParameterItemIds,
    parameterItemMapping,
    parameterMapping,
  ]);

  const canSubmit = React.useMemo(() => {
    return Object.keys(validationErrors).length === 0;
  }, [validationErrors]);

  // Previously used to show a ZIP-specific panel; now unified under apply-to-all controls
  // const hasZip = files.some((f) => f.name.toLowerCase().endsWith(".zip"));

  return (
    <Dialog open={open} onOpenChange={(val) => (!val ? onClose() : undefined)}>
      <DialogContent
        className="sm:max-w-5xl max-h-[90vh]"
        data-testid="document-classification-dialog"
      >
        <DialogHeader>
          <DialogTitle>Classify Documents Before Upload</DialogTitle>
          <DialogDescription>
            Choose a type and tags for each file. You can also apply choices to
            all files.
          </DialogDescription>
        </DialogHeader>

        {/* Top Section - Default Options */}
        <div className="space-y-4">
          {/* Defaults Toolbar - only show when multiple files */}
          {files.length > 1 && (
            <div className="flex items-center gap-3 px-3 py-2 bg-muted/30 rounded-md border flex-wrap">
              <span className="text-xs text-muted-foreground font-medium">
                Defaults →
              </span>
              {validDepartmentIds.length > 1 && (
                <div data-testid="document-department-selector">
                  <DepartmentPicker
                    mapping={departmentMapping}
                    validIds={validDepartmentIds}
                    selectedIds={selectedDepartmentIds}
                    onSelect={setSelectedDepartmentIds}
                    placeholder="Dept"
                    multiSelect={true}
                    compact={true}
                    buttonClassName="h-7 px-2 text-xs"
                  />
                </div>
              )}
              <div
                className="flex-1 min-w-[120px]"
                data-testid="document-parameter-selector"
              >
                <ParameterItemPicker
                  mapping={parameterItemMapping}
                  validIds={filteredValidParameterItemIds}
                  selectedIds={globalDefaultParameterItemIds}
                  onSelect={(next) => {
                    const added = next.filter(
                      (id) => !globalDefaultParameterItemIds.includes(id),
                    );
                    const removed = globalDefaultParameterItemIds.filter(
                      (id) => !next.includes(id),
                    );
                    if (added.length) applyParameterItemsToAll(added);
                    if (removed.length) removeParameterItemsFromAll(removed);
                    setGlobalDefaultParameterItemIds(next);
                  }}
                  parameterId=""
                  parameterName="Params"
                  allowCreate={false}
                  multiSelect={true}
                  badgesPosition="below"
                  showClearAll={true}
                  hideSelectedChips={false}
                  compact={true}
                  required={
                    documentParameterIds.length > 0 &&
                    documentParameterIds.some((paramId) =>
                      filteredValidParameterItemIds.some(
                        (itemId) =>
                          parameterItemMapping[itemId]?.parameter_id ===
                          paramId,
                      ),
                    )
                  }
                />
              </div>
            </div>
          )}

          {/* Table Layout - Documents as rows */}
          <div className="border rounded-md max-h-[50vh] overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[200px]">File Name</TableHead>
                  {validDepartmentIds.length > 1 && (
                    <TableHead className="w-[180px]">
                      <div className="flex items-center gap-2">
                        <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                        <span>Department</span>
                      </div>
                    </TableHead>
                  )}
                  <TableHead className="min-w-[200px]">
                    <div className="flex items-center gap-2">
                      <Tag className="h-3.5 w-3.5 text-muted-foreground" />
                      <span>Parameter Items</span>
                    </div>
                  </TableHead>
                  {files.length > 1 && (
                    <TableHead className="w-[120px]">Keep Default</TableHead>
                  )}
                  {files.length > 1 && (
                    <TableHead className="w-[80px]">Actions</TableHead>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {files.map((file) => {
                  const fc = perFile[file.name] ?? {
                    parameterItemIds: [...globalDefaultParameterItemIds],
                    departmentIds: selectedDepartmentIds,
                  };

                  // Get per-file keep-default state, defaulting to true
                  const keepDefault = keepDefaultPerFile[file.name] ?? true;

                  const useDefaultDepartment = keepDefault;
                  const useDefaultParameterItems = keepDefault;

                  return (
                    <TableRow key={file.name}>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <div
                            className="text-sm font-medium truncate max-w-[180px]"
                            title={file.name}
                          >
                            📄 {file.name}
                          </div>
                          <Badge variant="secondary" className="text-xs w-fit">
                            {Math.round(file.size / 1024)} KB
                          </Badge>
                          {/* Validation errors */}
                          {validationErrors[file.name] &&
                            validationErrors[file.name]!.length > 0 && (
                              <div className="text-xs text-red-600 mt-1">
                                {validationErrors[file.name]!.map(
                                  (error, idx) => (
                                    <div key={idx}>{error}</div>
                                  ),
                                )}
                              </div>
                            )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <DepartmentPicker
                          mapping={departmentMapping}
                          validIds={validDepartmentIds}
                          selectedIds={
                            useDefaultDepartment
                              ? selectedDepartmentIds
                              : fc.departmentIds || selectedDepartmentIds
                          }
                          onSelect={(ids) => {
                            if (!useDefaultDepartment) {
                              setPerFile((prev) => {
                                const prevForFile: FileClassification = prev[
                                  file.name
                                ] ?? {
                                  parameterItemIds: [
                                    ...globalDefaultParameterItemIds,
                                  ],
                                  departmentIds: selectedDepartmentIds,
                                };
                                return {
                                  ...prev,
                                  [file.name]: {
                                    ...prevForFile,
                                    departmentIds: ids,
                                  },
                                } as Record<string, FileClassification>;
                              });
                            }
                          }}
                          placeholder="Dept"
                          multiSelect={true}
                          compact={true}
                          buttonClassName="h-7 px-2 text-xs"
                          disabled={useDefaultDepartment}
                        />
                      </TableCell>
                      <TableCell className="max-w-[300px]">
                        <ParameterItemPicker
                          mapping={parameterItemMapping}
                          validIds={filteredValidParameterItemIds}
                          selectedIds={
                            useDefaultParameterItems
                              ? globalDefaultParameterItemIds
                              : fc.parameterItemIds
                          }
                          onSelect={(parameterItemIds) => {
                            if (!useDefaultParameterItems) {
                              setPerFile((prev) => {
                                const prevForFile: FileClassification = prev[
                                  file.name
                                ] ?? {
                                  parameterItemIds: [
                                    ...globalDefaultParameterItemIds,
                                  ],
                                  departmentIds: selectedDepartmentIds,
                                };
                                return {
                                  ...prev,
                                  [file.name]: {
                                    ...prevForFile,
                                    parameterItemIds,
                                  },
                                } as Record<string, FileClassification>;
                              });
                            }
                          }}
                          parameterId=""
                          parameterName="Params"
                          allowCreate={false}
                          multiSelect={true}
                          badgesPosition="below"
                          showClearAll={false}
                          hideSelectedChips={false}
                          compact={true}
                          disabled={useDefaultParameterItems}
                          required={
                            documentParameterIds.length > 0 &&
                            documentParameterIds.some((paramId) =>
                              filteredValidParameterItemIds.some(
                                (itemId) =>
                                  parameterItemMapping[itemId]?.parameter_id ===
                                  paramId,
                              ),
                            )
                          }
                        />
                      </TableCell>
                      {files.length > 1 && (
                        <TableCell>
                          <Checkbox
                            checked={keepDefault}
                            onCheckedChange={(checked) => {
                              setKeepDefaultPerFile((prev) => ({
                                ...prev,
                                [file.name]: checked === true,
                              }));
                            }}
                          />
                        </TableCell>
                      )}
                      {files.length > 1 && (
                        <TableCell>
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="icon"
                                  className="h-7 w-7"
                                  onClick={() => {
                                    setPerFile((prev) => {
                                      const next = { ...prev };
                                      delete next[file.name];
                                      return next;
                                    });
                                    setKeepDefaultPerFile((prev) => {
                                      const next = { ...prev };
                                      delete next[file.name];
                                      return next;
                                    });
                                    if (onRemoveFile) {
                                      onRemoveFile(file.name);
                                    } else {
                                      const evt = new CustomEvent(
                                        "upload:remove-file",
                                        {
                                          detail: { fileName: file.name },
                                        },
                                      );
                                      window.dispatchEvent(evt);
                                    }
                                  }}
                                  aria-label="Remove file from upload"
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Remove file</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </div>

        <DialogFooter className="mt-4">
          <div className="flex items-center justify-between gap-2 w-full">
            <div>
              <input
                type="file"
                multiple
                onChange={(e) => {
                  const list = e.target.files;
                  if (list && list.length > 0) {
                    const next = Array.from(list);
                    onAddFiles?.(next);
                    // reset input so same file can be selected again later
                    e.currentTarget.value = "";
                  }
                }}
                accept={[
                  "application/pdf",
                  "image/*",
                  "application/msword",
                  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                  "text/plain",
                  "application/zip",
                  "text/html",
                  ".java,.py,.c,.h,.cpp,.hpp,.cc,.cs,.js,.jsx,.ts,.tsx,.mjs,.cjs,.html,.css,.scss,.md,.json,.yml,.yaml,.xml,.sh,.bash,.zsh,.rb,.go,.rs,.kt,.swift,.m,.mm,.sql,.ipynb",
                ].join(",")}
                className="hidden"
                id="upload-dialog-file-input"
              />
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => {
                  const el = document.getElementById(
                    "upload-dialog-file-input",
                  ) as HTMLInputElement | null;
                  el?.click();
                }}
                className="border bg-gradient-to-r from-indigo-50 to-purple-50 hover:from-indigo-100 hover:to-purple-100 border-indigo-200"
              >
                + Add More Documents
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button
                type="button"
                onClick={() => {
                  if (!canSubmit) {
                    // Show first validation error
                    const firstError = Object.values(validationErrors)[0];
                    if (firstError && firstError.length > 0) {
                      toast.error(firstError[0]);
                    }
                    return;
                  }
                  // Transform department IDs before submitting
                  const finalDepartmentIds = transformDepartmentIdsForSubmit(
                    selectedDepartmentIds,
                    isSuperadmin,
                    validDepartmentIds,
                  );

                  // Include department information in the classification
                  const perFileWithDepartment = Object.fromEntries(
                    Object.entries(perFile).map(
                      ([fileName, classification]) => [
                        fileName,
                        {
                          ...classification,
                          departmentIds:
                            classification.departmentIds &&
                            classification.departmentIds.length > 0
                              ? transformDepartmentIdsForSubmit(
                                  classification.departmentIds,
                                  isSuperadmin,
                                  validDepartmentIds,
                                ) || []
                              : finalDepartmentIds || [],
                        },
                      ],
                    ),
                  );
                  const zipDefaultsWithDepartment = {
                    ...zipDefaults,
                    departmentIds: finalDepartmentIds || [],
                  };
                  onConfirm(perFileWithDepartment, zipDefaultsWithDepartment);
                }}
                disabled={!canSubmit}
                data-testid="document-classify-submit"
              >
                Start Upload
              </Button>
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default UploadClassificationDialog;
