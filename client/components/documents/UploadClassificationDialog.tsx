"use client";
import * as React from "react";

import { DocumentTypePicker } from "@/components/documents/DocumentTypePicker";
import { DepartmentPicker } from "@/components/common/forms/DepartmentPicker";
import { ParameterItemPicker } from "@/components/common/forms/ParameterItemPicker";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useProfile } from "@/contexts/profile-context";
import { toast } from "sonner";

type DocumentType =
  | "homework"
  | "project"
  | "quiz"
  | "midterm"
  | "lab"
  | "lecture"
  | "syllabus";

type ParameterItemMappingItem = {
  name: string;
  description: string;
};

type ParameterMappingItem = {
  name: string;
  description: string;
};

export type FileClassification = {
  type: DocumentType;
  parameterItemIds: string[];
  departmentIds?: string[];
};

export interface UploadClassificationDialogProps {
  open: boolean;
  files: File[];
  onClose: () => void;
  onConfirm: (
    perFile: Record<string, FileClassification>,
    defaultsForZip: FileClassification
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

// Global defaults state - tracks the default values to apply to all files
const DEFAULT_TYPE: DocumentType = "homework";

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

  // Per-file classification state (keyed by file.name)
  const [perFile, setPerFile] = React.useState<
    Record<string, FileClassification>
  >({});
  const [zipDefaults, setZipDefaults] = React.useState<FileClassification>({
    type: DEFAULT_TYPE,
    parameterItemIds: [],
  });
  // Global defaults state
  const [globalDefaultType, setGlobalDefaultType] =
    React.useState<DocumentType>(DEFAULT_TYPE);
  const [globalDefaultParameterItemIds, setGlobalDefaultParameterItemIds] =
    React.useState<string[]>([]);
  // Department selection state - default to user's primary department
  const [selectedDepartmentIds, setSelectedDepartmentIds] = React.useState<
    string[]
  >(
    effectiveProfile?.primaryDepartmentId
      ? [effectiveProfile.primaryDepartmentId]
      : []
  );

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
      (paramId) => parameterMapping[paramId]?.document_parameter === true
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
          selectedDeptParameterItemIds.add(id)
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
          allDeptParameterItemIds.add(id)
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
      (id) => !currentDeptIds.includes(id)
    );

    // Find departments that were newly selected
    const newlySelectedDepts = currentDeptIds.filter(
      (id) => !prevDeptIds.includes(id)
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
                (id) => validParamSet.has(id)
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
                      validParamSet.has(id)
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
                  }
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
        validSet.has(id)
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
          validSet.has(id)
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
        type: globalDefaultType,
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

  const applyTypeToAll = (type: DocumentType) => {
    setGlobalDefaultType(type);
    setPerFile((prev) =>
      Object.fromEntries(
        Object.entries(prev).map(([k, v]) => [k, { ...v, type }])
      )
    );
    setZipDefaults((p) => ({ ...p, type }));
  };

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
            new Set([...(v.parameterItemIds ?? []), ...incomingIds])
          );
          return [k, { ...v, parameterItemIds: merged }];
        })
      )
    );
    setZipDefaults((p) => ({
      ...p,
      parameterItemIds: Array.from(
        new Set([...(p.parameterItemIds ?? []), ...incomingIds])
      ),
    }));
  };

  const removeParameterItemsFromAll = (idsToRemove: string[]) => {
    if (idsToRemove.length === 0) return;
    setGlobalDefaultParameterItemIds((prev) =>
      prev.filter((id) => !idsToRemove.includes(id))
    );
    setPerFile((prev) =>
      Object.fromEntries(
        Object.entries(prev).map(([k, v]) => {
          const nextIds = (v.parameterItemIds ?? []).filter(
            (id) => !idsToRemove.includes(id)
          );
          return [k, { ...v, parameterItemIds: nextIds }];
        })
      )
    );
    setZipDefaults((p) => ({
      ...p,
      parameterItemIds: (p.parameterItemIds ?? []).filter(
        (id) => !idsToRemove.includes(id)
      ),
    }));
  };

  // Apply defaults now - force apply current defaults to all files
  const applyDefaultsNow = () => {
    setPerFile((prev) =>
      Object.fromEntries(
        Object.entries(prev).map(([k]) => [
          k,
          {
            type: globalDefaultType,
            parameterItemIds: [...globalDefaultParameterItemIds],
          },
        ])
      )
    );
    setZipDefaults({
      type: globalDefaultType,
      parameterItemIds: [...globalDefaultParameterItemIds],
    });
  };

  // Validation: Check that each document has at least one parameter item for each document_parameter=true parameter
  const validationErrors = React.useMemo(() => {
    const errors: Record<string, string[]> = {};

    if (documentParameterIds.length === 0) {
      return errors; // No document parameters required
    }

    files.forEach((file) => {
      const fc = perFile[file.name] ?? {
        type: globalDefaultType,
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
          selectedItemIds.includes(itemId)
        );

        if (!hasItemForParam && itemsForParam.length > 0) {
          if (!errors[file.name]) {
            errors[file.name] = [];
          }
          const paramName = parameterMapping[paramId]?.name || paramId;
          errors[file.name]!.push(
            `Required: Select at least one ${paramName} option`
          );
        }
      });
    });

    return errors;
  }, [
    files,
    perFile,
    globalDefaultType,
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
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Classify Documents Before Upload</DialogTitle>
          <DialogDescription>
            Choose a type and tags for each file. You can also apply choices to
            all files.
          </DialogDescription>
        </DialogHeader>

        {/* Compact Horizontal Defaults Toolbar - only show when multiple files */}
        {files.length > 1 && (
          <div className="flex items-center gap-3 px-3 py-2 bg-muted/30 rounded-md border flex-wrap">
            <span className="text-xs text-muted-foreground">Defaults →</span>
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
            <DocumentTypePicker
              selectedType={globalDefaultType}
              onSelect={applyTypeToAll}
              placeholder="Type"
              compact={true}
            />
            <div className="flex-1 min-w-[120px]">
              <ParameterItemPicker
                mapping={parameterItemMapping}
                validIds={filteredValidParameterItemIds}
                selectedIds={globalDefaultParameterItemIds}
                onSelect={(next) => {
                  const added = next.filter(
                    (id) => !globalDefaultParameterItemIds.includes(id)
                  );
                  const removed = globalDefaultParameterItemIds.filter(
                    (id) => !next.includes(id)
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
                        parameterItemMapping[itemId]?.parameter_id === paramId
                    )
                  )
                }
              />
            </div>
            <Button
              type="button"
              variant="secondary"
              onClick={applyDefaultsNow}
              size="sm"
              className="h-7 px-2 text-xs border bg-gradient-to-r from-indigo-50 to-purple-50 hover:from-indigo-100 hover:to-purple-100 border-indigo-200"
            >
              Apply to all
            </Button>
          </div>
        )}

        {/* Department Selection - show when single file */}
        {files.length === 1 && (
          <div className="space-y-2 mb-4">
            <Label htmlFor="department">Department</Label>
            <DepartmentPicker
              mapping={departmentMapping}
              validIds={validDepartmentIds}
              selectedIds={selectedDepartmentIds}
              onSelect={setSelectedDepartmentIds}
              placeholder="All Departments"
              multiSelect={true}
            />
          </div>
        )}

        {/* Section 2: Files List */}
        <div className="space-y-2 max-h-[50vh] overflow-auto pr-1">
          {files.map((file) => {
            const fc = perFile[file.name] ?? {
              type: globalDefaultType,
              parameterItemIds: [...globalDefaultParameterItemIds],
            };

            return (
              <div key={file.name} className="rounded-md border p-2 bg-white">
                {/* Row 1: Filename + Size + Remove */}
                <div className="flex items-center justify-between mb-2">
                  <div className="text-sm font-medium truncate mr-2 text-gray-900">
                    📄 {file.name}
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-xs">
                      {Math.round(file.size / 1024)} KB
                    </Badge>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-5 w-5"
                      onClick={() => {
                        setPerFile((prev) => {
                          const next = { ...prev };
                          delete next[file.name];
                          return next;
                        });
                        if (onRemoveFile) {
                          onRemoveFile(file.name);
                        } else {
                          const evt = new CustomEvent("upload:remove-file", {
                            detail: { fileName: file.name },
                          });
                          window.dispatchEvent(evt);
                        }
                      }}
                      aria-label="Remove file from upload"
                      title="Remove file"
                    >
                      ✕
                    </Button>
                  </div>
                </div>

                {/* Horizontal Layout: Dept, Type, Params */}
                <div className="flex items-center gap-2 flex-wrap">
                  <DepartmentPicker
                    mapping={departmentMapping}
                    validIds={validDepartmentIds}
                    selectedIds={fc.departmentIds || selectedDepartmentIds}
                    onSelect={(ids) =>
                      setPerFile((prev) => {
                        const prevForFile: FileClassification = prev[
                          file.name
                        ] ?? {
                          type: globalDefaultType,
                          parameterItemIds: [...globalDefaultParameterItemIds],
                          departmentIds: selectedDepartmentIds,
                        };
                        return {
                          ...prev,
                          [file.name]: {
                            ...prevForFile,
                            departmentIds: ids,
                          },
                        } as Record<string, FileClassification>;
                      })
                    }
                    placeholder="Dept"
                    multiSelect={true}
                    compact={true}
                    buttonClassName="h-7 px-2 text-xs"
                  />
                  <DocumentTypePicker
                    selectedType={fc.type}
                    onSelect={(type) =>
                      setPerFile((prev) => {
                        const prevForFile: FileClassification = prev[
                          file.name
                        ] ?? {
                          type: globalDefaultType,
                          parameterItemIds: [...globalDefaultParameterItemIds],
                          departmentIds: selectedDepartmentIds,
                        };
                        return {
                          ...prev,
                          [file.name]: {
                            ...prevForFile,
                            type,
                          },
                        } as Record<string, FileClassification>;
                      })
                    }
                    placeholder="Type"
                    compact={true}
                  />
                  <div className="flex-1 min-w-[120px]">
                    <ParameterItemPicker
                      mapping={parameterItemMapping}
                      validIds={filteredValidParameterItemIds}
                      selectedIds={fc.parameterItemIds}
                      onSelect={(parameterItemIds) =>
                        setPerFile((prev) => {
                          const prevForFile: FileClassification = prev[
                            file.name
                          ] ?? {
                            type: fc.type,
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
                        })
                      }
                      parameterId=""
                      parameterName="Params"
                      allowCreate={false}
                      multiSelect={true}
                      badgesPosition="below"
                      showClearAll={false}
                      hideSelectedChips={false}
                      compact={true}
                      required={
                        documentParameterIds.length > 0 &&
                        documentParameterIds.some((paramId) =>
                          filteredValidParameterItemIds.some(
                            (itemId) =>
                              parameterItemMapping[itemId]?.parameter_id ===
                              paramId
                          )
                        )
                      }
                    />
                  </div>
                  {/* Validation errors */}
                  {validationErrors[file.name] &&
                    validationErrors[file.name]!.length > 0 && (
                      <div className="mt-1 text-xs text-red-600">
                        {validationErrors[file.name]!.map((error, idx) => (
                          <div key={idx}>{error}</div>
                        ))}
                      </div>
                    )}
                </div>
              </div>
            );
          })}
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
                    "upload-dialog-file-input"
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
                  // Include department information in the classification
                  const perFileWithDepartment = Object.fromEntries(
                    Object.entries(perFile).map(
                      ([fileName, classification]) => [
                        fileName,
                        {
                          ...classification,
                          departmentIds: selectedDepartmentIds,
                        },
                      ]
                    )
                  );
                  const zipDefaultsWithDepartment = {
                    ...zipDefaults,
                    departmentIds: selectedDepartmentIds,
                  };
                  onConfirm(perFileWithDepartment, zipDefaultsWithDepartment);
                }}
                disabled={!canSubmit}
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
