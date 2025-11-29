/**
 * EvalForm.tsx
 * Form component for creating evals
 */
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RubricPicker } from "@/components/common/forms/RubricPicker";
import { ModelRunsSelector } from "./ModelRunsSelector";
import type { RubricsListOut } from "@/app/(main)/management/rubrics/page";
import type { CreateEvalIn, CreateEvalOut } from "@/app/(main)/engine/evals/new/page";
import { toast } from "sonner";
import { api } from "@/lib/api/client";

export interface EvalFormProps {
  rubricsList: RubricsListOut;
  profileId: string;
  createEvalAction: (input: CreateEvalIn) => Promise<CreateEvalOut>;
}

export function EvalForm({ rubricsList, profileId, createEvalAction }: EvalFormProps) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [selectedRubricId, setSelectedRubricId] = useState<string[]>([]);
  const [selectedModelRunIds, setSelectedModelRunIds] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Build rubric mapping
  const rubricMapping = rubricsList.rubrics.reduce(
    (acc, rubric) => {
      acc[rubric.rubric_id] = {
        name: rubric.name,
        description: rubric.description,
      };
      return acc;
    },
    {} as Record<string, { name: string; description: string }>
  );

  const validRubricIds = rubricsList.rubrics.map((r) => r.rubric_id);

  const handleSubmit = async (run: boolean) => {
    if (!name.trim()) {
      toast.error("Name is required");
      return;
    }
    if (!description.trim()) {
      toast.error("Description is required");
      return;
    }
    if (selectedRubricId.length === 0) {
      toast.error("Please select a rubric");
      return;
    }
    if (selectedModelRunIds.length === 0) {
      toast.error("Please select at least one model run");
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await createEvalAction({
        body: {
          name: name.trim(),
          description: description.trim(),
          rubric_id: selectedRubricId[0]!,
          model_run_ids: selectedModelRunIds,
          profileId: "", // Will be filled by server action
          run: false, // Always create first, then run if needed
        },
      });

      if (result.success) {
        if (run) {
          // If run flag is set, call run endpoint
          try {
            const runResult = await api.post("/evals/run", {
              body: {
                evalId: result.evalId,
                profileId: "", // Will be filled by server action
              },
            });
            if (runResult.success) {
              toast.success(`Eval "${name}" created and started successfully`);
              router.push(`/engine/evals/e/${result.evalId}`);
            } else {
              toast.success(`Eval "${name}" created successfully`);
              router.push("/engine/evals");
            }
          } catch (runError) {
            toast.error(`Eval created but failed to start: ${runError}`);
            router.push("/engine/evals");
          }
        } else {
          toast.success(`Eval "${name}" created successfully`);
          router.push("/engine/evals");
        }
      }
    } catch (error) {
      toast.error(`Failed to create eval: ${error}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Eval Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="name">Name *</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter eval name"
            />
          </div>
          <div>
            <Label htmlFor="description">Description *</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Enter eval description"
              rows={4}
            />
          </div>
          <div>
            <Label>Rubric *</Label>
            <RubricPicker
              mapping={rubricMapping}
              validIds={validRubricIds}
              selectedIds={selectedRubricId}
              onSelect={setSelectedRubricId}
              multiSelect={false}
              placeholder="Select a rubric..."
            />
          </div>
        </CardContent>
      </Card>

      <ModelRunsSelector
        profileId={profileId}
        selectedModelRunIds={selectedModelRunIds}
        onSelect={setSelectedModelRunIds}
        modelMapping={rubricsList.model_mapping || {}}
      />

      <div className="flex gap-4">
        <Button
          onClick={() => handleSubmit(false)}
          disabled={isSubmitting}
          variant="outline"
        >
          Create
        </Button>
        <Button
          onClick={() => handleSubmit(true)}
          disabled={isSubmitting}
        >
          Create and Run
        </Button>
      </div>
    </div>
  );
}

