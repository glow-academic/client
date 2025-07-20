import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Cohort, Profile } from "@/types";
import { ArrowRight } from "lucide-react";
import Link from "next/link";

interface CompletionistViewProps {
  data: {
    percentage: number;
    actionItems: { type: string; href: string; label: string }[] | Cohort[];
  };
  profile: Profile | null;
}

export default function CompletionistView({
  data,
  profile,
}: CompletionistViewProps) {
  if (!data) return null;

  const getGreeting = () => `Welcome back, ${profile?.firstName || "User"}!`;

  return (
    <div>
      <div className="flex items-center gap-4 mb-4">
        <div>
          <h2 className="text-2xl font-bold">{getGreeting()}</h2>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex justify-between items-baseline">
          <span className="text-sm font-medium">Overall Completion</span>
          <span className="text-xl font-bold text-primary">
            {data.percentage}%
          </span>
        </div>
        <Progress value={data.percentage} className="w-full h-3" />
      </div>

      <div className="mt-6 pt-6 border-t">
        <h3 className="text-sm font-semibold text-muted-foreground mb-3">
          RECOMMENDED ACTIONS
        </h3>
        <div className="flex flex-wrap gap-3">
          {/* Render Action Items based on role */}
          {profile?.role === "ta" &&
            Array.isArray(data.actionItems) &&
            data.actionItems.length > 0 &&
            (data.actionItems as Cohort[]).every(
              (item) => typeof item === "object" && "id" in item && "title" in item
            ) &&
            (data.actionItems as Cohort[]).map((cohort) => (
              <Link
                key={cohort.id}
                href={`/dashboard/cohorts/${cohort.id}`}
                passHref
              >
                <Button variant="outline">
                  Review {cohort.title} <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </Link>
            ))}

          {profile?.role !== "ta" &&
            Array.isArray(data.actionItems) &&
            data.actionItems.length > 0 &&
            (data.actionItems as { type: string; href: string; label: string }[]).every(
              (item) =>
                typeof item === "object" &&
                "type" in item &&
                "href" in item &&
                "label" in item
            ) &&
            (data.actionItems as { type: string; href: string; label: string }[]).map((item) => (
              <Link key={item.href} href={item.href} passHref>
                <Button>
                  {item.label} <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </Link>
            ))}
          {data.actionItems.length === 0 && (
            <p className="text-sm text-green-600 font-medium">
              🎉 Everything is complete. Great work!
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
