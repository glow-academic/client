import TrainingBundle, { type TrainingBundleData } from "@/components/artifacts/training/TrainingBundle";
import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import type { Metadata } from "next";

/** ---- Strong types from OpenAPI ---- */
type GetTrainingBundleOut = OutputOf<
  "/api/v4/artifacts/training/get",
  "post"
>;
type PatchTrainingDraftIn = InputOf<
  "/api/v4/artifacts/training/draft",
  "patch"
>;
type PatchTrainingDraftOut = OutputOf<
  "/api/v4/artifacts/training/draft",
  "patch"
>;

const getTrainingBundle = async (
  bundleId: string,
  draftId: string | null,
): Promise<GetTrainingBundleOut> => {
  return api.post(
    "/artifacts/training/get",
    {
      body: {
        training_bundle_entry_id: bundleId,
        draft_id: draftId,
      },
    },
    {
      cache: "no-store",
      headers: {
        "X-Bypass-Cache": "1",
      },
    },
  );
};

async function patchTrainingDraft(
  input: PatchTrainingDraftIn,
): Promise<PatchTrainingDraftOut> {
  "use server";
  return api.patch("/artifacts/training/draft", input);
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
  params: Promise<{ attemptId: string; trainingId: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { attemptId, trainingId } = await params;
  const sp = await searchParams;
  const rawDraftId = sp["draftId"];
  const draftId =
    typeof rawDraftId === "string"
      ? rawDraftId
      : Array.isArray(rawDraftId)
        ? (rawDraftId[0] ?? null)
        : null;

  const bundleData = await getTrainingBundle(trainingId, draftId);

  return (
    <TrainingBundle
      mode="practice"
      bundleData={bundleData as TrainingBundleData}
      patchTrainingDraftAction={patchTrainingDraft}
      attemptId={attemptId}
    />
  );
}
