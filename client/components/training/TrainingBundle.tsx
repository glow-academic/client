"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useProfile } from "@/contexts/profile-context";
import { useRouter } from "next/navigation";
import { parseAsBoolean, parseAsString, useQueryStates } from "nuqs";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

export type TrainingBundleData = {
  training_bundle_entry_id: string;
  simulation_name?: string | null;
  profile_has_access: boolean;
  group_id?: string | null;
  views?: {
    draft_training_bundle?: {
      draft_id?: string | null;
      version?: number | null;
      department_ids?: string[];
      persona_ids?: string[];
      document_ids?: string[];
      parameter_field_ids?: string[];
    } | null;
  } | null;
  resources?: {
    current?: {
      departments?: Array<{ department_id?: string | null; name?: string | null }> | null;
      personas?: Array<{ persona_id?: string | null; name?: string | null }> | null;
      documents?: Array<{ document_id?: string | null; name?: string | null }> | null;
      parameter_fields?: Array<{
        field_id?: string | null;
        name?: string | null;
        parameter_name?: string | null;
      }> | null;
      scenario_time_limits?: Array<{ id?: string | null; time_limit_seconds?: number | null }> | null;
    } | null;
    suggestions?: {
      departments?: Array<{ department_id?: string | null; name?: string | null }> | null;
      personas?: Array<{ persona_id?: string | null; name?: string | null }> | null;
      documents?: Array<{ document_id?: string | null; name?: string | null }> | null;
      parameter_fields?: Array<{
        field_id?: string | null;
        name?: string | null;
        parameter_name?: string | null;
      }> | null;
      scenario_time_limits?: Array<{ id?: string | null; time_limit_seconds?: number | null }> | null;
    } | null;
  } | null;
};

type PatchTrainingDraftIn = {
  body: {
    input_draft_id?: string | null;
    expected_version?: number;
    departments?: { resource_ids?: string[] };
    personas?: { resource_ids?: string[] };
    documents?: { resource_ids?: string[] };
    parameter_fields?: { resource_ids?: string[] };
  };
};

type PatchTrainingDraftOut = {
  draft_id?: string | null;
  new_version?: number | null;
};

interface TrainingBundleProps {
  mode: "practice" | "home";
  bundleData: TrainingBundleData;
  patchTrainingDraftAction: (input: PatchTrainingDraftIn) => Promise<PatchTrainingDraftOut>;
}

export default function TrainingBundle({
  mode,
  bundleData,
  patchTrainingDraftAction,
}: TrainingBundleProps) {
  const router = useRouter();
  const { socket, isConnected } = useProfile();

  const draft = bundleData.views?.draft_training_bundle || null;
  const current = bundleData.resources?.current;
  const suggestions = bundleData.resources?.suggestions;

  const departments = useMemo(
    () => suggestions?.departments || current?.departments || [],
    [current?.departments, suggestions?.departments],
  );
  const personas = useMemo(
    () => suggestions?.personas || current?.personas || [],
    [current?.personas, suggestions?.personas],
  );
  const documents = useMemo(
    () => suggestions?.documents || current?.documents || [],
    [current?.documents, suggestions?.documents],
  );
  const parameterFields = useMemo(
    () => suggestions?.parameter_fields || current?.parameter_fields || [],
    [current?.parameter_fields, suggestions?.parameter_fields],
  );

  const initialDepartmentId =
    draft?.department_ids?.[0] ||
    current?.departments?.[0]?.department_id ||
    departments.find((d) => d.department_id)?.department_id ||
    null;

  const [urlParams, setUrlParams] = useQueryStates(
    {
      draftId: parseAsString,
      infiniteMode: parseAsBoolean,
      userInstructions: parseAsString,
    },
    { history: "replace", shallow: true },
  );

  const [draftId, setDraftId] = useState<string | null>(urlParams.draftId || draft?.draft_id || null);
  const [draftVersion, setDraftVersion] = useState<number>(draft?.version || 0);
  const [departmentId, setDepartmentId] = useState<string | null>(initialDepartmentId);
  const [personaIds, setPersonaIds] = useState<string[]>(draft?.persona_ids || []);
  const [documentIds, setDocumentIds] = useState<string[]>(draft?.document_ids || []);
  const [parameterFieldIds, setParameterFieldIds] = useState<string[]>(draft?.parameter_field_ids || []);
  const [isStarting, setIsStarting] = useState(false);

  const infiniteMode = urlParams.infiniteMode ?? false;
  const userInstructions = urlParams.userInstructions || "";

  const saveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const savingRef = useRef(false);

  useEffect(() => {
    if (draftId && draftId !== urlParams.draftId) {
      void setUrlParams({ draftId });
    }
  }, [draftId, setUrlParams, urlParams.draftId]);

  const toggleSelection = useCallback(
    (id: string, values: string[], setter: (next: string[]) => void) => {
      if (values.includes(id)) {
        setter(values.filter((x) => x !== id));
      } else {
        setter([...values, id]);
      }
    },
    [],
  );

  const saveDraftNow = useCallback(async () => {
    if (!departmentId || savingRef.current) return;

    savingRef.current = true;
    try {
      const result = await patchTrainingDraftAction({
        body: {
          input_draft_id: draftId,
          expected_version: draftVersion,
          departments: { resource_ids: [departmentId] },
          personas: { resource_ids: personaIds },
          documents: { resource_ids: documentIds },
          parameter_fields: { resource_ids: parameterFieldIds },
        },
      });

      if (result.draft_id) {
        setDraftId(result.draft_id);
      }
      if (typeof result.new_version === "number") {
        setDraftVersion(result.new_version);
      }
    } catch {
      toast.error("Failed to save draft selections.");
    } finally {
      savingRef.current = false;
    }
  }, [departmentId, draftId, draftVersion, personaIds, documentIds, parameterFieldIds, patchTrainingDraftAction]);

  useEffect(() => {
    if (!departmentId) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      void saveDraftNow();
    }, 700);

    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [departmentId, personaIds, documentIds, parameterFieldIds, saveDraftNow]);

  useEffect(() => {
    if (!socket) return;

    const handleTrainingStarted = (data: { attempt_id?: string }) => {
      if (!isStarting) return;
      setIsStarting(false);
      if (data.attempt_id) {
        const basePath = mode === "practice" ? "/practice" : "/home";
        router.push(`${basePath}/a/${data.attempt_id}`);
        router.refresh();
      }
    };

    const handleTrainingError = (data: { message?: string }) => {
      if (!isStarting) return;
      setIsStarting(false);
      toast.error(data.message || "Failed to start training");
    };

    socket.on("training_started", handleTrainingStarted);
    socket.on("training_error", handleTrainingError);

    return () => {
      socket.off("training_started", handleTrainingStarted);
      socket.off("training_error", handleTrainingError);
    };
  }, [socket, isStarting, mode, router]);

  const canStart = useMemo(() => {
    return !!departmentId && !!bundleData.training_bundle_entry_id;
  }, [departmentId, bundleData.training_bundle_entry_id]);

  const startTraining = useCallback(async () => {
    if (!socket || !isConnected) {
      toast.error("WebSocket not connected. Please refresh the page.");
      return;
    }
    if (!canStart || !departmentId) {
      toast.error("Please choose a department before starting.");
      return;
    }

    await saveDraftNow();

    if (!draftId) {
      toast.error("Draft is required before starting.");
      return;
    }

    setIsStarting(true);
    socket.emit("training_start", {
      training_bundle_entry_id: bundleData.training_bundle_entry_id,
      department_id: departmentId,
      draft_id: draftId,
      infinite: infiniteMode,
      user_instructions: userInstructions.trim() ? [userInstructions.trim()] : null,
    });
  }, [
    socket,
    isConnected,
    canStart,
    departmentId,
    saveDraftNow,
    draftId,
    bundleData.training_bundle_entry_id,
    infiniteMode,
    userInstructions,
  ]);

  if (!bundleData.profile_has_access) {
    return <p className="text-sm text-muted-foreground">You do not have access to this training bundle.</p>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Customize Training</h1>
        <p className="text-sm text-muted-foreground">{bundleData.simulation_name || "Training bundle"}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Department</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {departments.map((department) => (
            <label key={department.department_id || "unknown"} className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                checked={departmentId === department.department_id}
                onChange={() => setDepartmentId(department.department_id || null)}
              />
              <span>{department.name || "Unnamed department"}</span>
            </label>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Personas</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {personas.map((persona) => {
            const id = persona.persona_id || "";
            return (
              <label key={id} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={id ? personaIds.includes(id) : false}
                  onChange={() => id && toggleSelection(id, personaIds, setPersonaIds)}
                />
                <span>{persona.name || "Unnamed persona"}</span>
              </label>
            );
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Documents</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {documents.map((document) => {
            const id = document.document_id || "";
            return (
              <label key={id} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={id ? documentIds.includes(id) : false}
                  onChange={() => id && toggleSelection(id, documentIds, setDocumentIds)}
                />
                <span>{document.name || "Unnamed document"}</span>
              </label>
            );
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Parameter Fields</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {parameterFields.map((field) => {
            const id = field.field_id || "";
            return (
              <label key={id} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={id ? parameterFieldIds.includes(id) : false}
                  onChange={() => id && toggleSelection(id, parameterFieldIds, setParameterFieldIds)}
                />
                <span>{field.name || "Unnamed field"}</span>
                {field.parameter_name ? <span className="text-muted-foreground">({field.parameter_name})</span> : null}
              </label>
            );
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Session Options</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={infiniteMode}
              onChange={(e) => void setUrlParams({ infiniteMode: e.target.checked })}
            />
            <span>Infinite mode</span>
          </label>

          <div className="space-y-2">
            <Label htmlFor="user-instructions">User instructions</Label>
            <Input
              id="user-instructions"
              value={userInstructions}
              onChange={(e) => void setUrlParams({ userInstructions: e.target.value || null })}
              placeholder="Optional hint for generation"
            />
          </div>

          <div className="flex gap-2">
            <Button variant="outline" onClick={() => router.back()}>
              Cancel
            </Button>
            <Button onClick={() => void startTraining()} disabled={!canStart || isStarting}>
              {isStarting ? "Starting..." : "Start Training"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
