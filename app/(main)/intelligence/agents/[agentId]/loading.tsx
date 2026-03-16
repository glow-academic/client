import { FormSkeleton } from "@/components/common/forms/FormSkeleton";

export default function Loading() {
  return <FormSkeleton steps={5} wrapper="space-y-6 py-4 px-4" />;
}
