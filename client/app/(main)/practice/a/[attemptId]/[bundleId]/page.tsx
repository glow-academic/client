import TrainingBundle, { type TrainingBundleData } from "@/components/training/TrainingBundle";
import { api } from "@/lib/api/client";
import type { Metadata } from "next";

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

const getTrainingBundle = async (
  bundleId: string,
  draftId: string | null,
): Promise<TrainingBundleData> => {
  const response = await api.post(
    "/artifacts/training/bundle/get" as never,
    {
      body: {
        training_bundle_entry_id: bundleId,
        draft_id: draftId,
      },
    } as never,
    {
      cache: "no-store",
      headers: {
        "X-Bypass-Cache": "1",
      },
    },
  );
  return response as TrainingBundleData;
};

async function patchTrainingDraft(
  input: PatchTrainingDraftIn,
): Promise<PatchTrainingDraftOut> {
  "use server";
  return api.patch("/artifacts/training/draft" as never, input);
}

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Customize Practice",
    description: "Customize and start a bundle-based practice training session.",
  };
}

export default async function PracticeBundlePage({
  params,
  searchParams,
}: {
  params: Promise<{ attemptId: string; bundleId: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { attemptId, bundleId } = await params;
  const sp = await searchParams;
  const rawDraftId = sp["draftId"];
  const draftId =
    typeof rawDraftId === "string"
      ? rawDraftId
      : Array.isArray(rawDraftId)
        ? (rawDraftId[0] ?? null)
        : null;

  const bundleData = await getTrainingBundle(bundleId, draftId);

  return (
    <TrainingBundle
      mode="practice"
      bundleData={bundleData}
      patchTrainingDraftAction={patchTrainingDraft as never}
      attemptId={attemptId}
    />
  );
}
