/**
 * EvalCard.tsx
 * Eval card component for benchmark page
 * @AshokSaravanan222 & @siladiea
 * 01/XX/2025
 */

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useProfile } from "@/contexts/profile-context";
import { AlertCircle, CheckCircle2, Clock, Loader2, Play } from "lucide-react";
// ProfileItem type derived from server response (single source of truth)
import type { ProfileItem } from "@/app/(main)/layout-server";

export interface EvalCardProps {
  evalId: string;
  name: string;
  description: string;
  status: string; // 'pending', 'running', 'completed'
  totalRuns: number;
  completedRuns: number;
  pendingRuns: number;
  rubricName: string;
  onStartEval: (evalId: string) => void;
  loadingEval: string | null;
  effectiveProfile: ProfileItem;
}

export default function EvalCard({
  evalId,
  name,
  description,
  status,
  totalRuns,
  completedRuns,
  pendingRuns,
  rubricName,
  onStartEval,
  loadingEval,
  effectiveProfile,
}: EvalCardProps) {
  const { activeProfile } = useProfile();
  const isEmulatingAnother = Boolean(
    effectiveProfile?.id &&
      activeProfile?.id &&
      effectiveProfile.id !== activeProfile.id,
  );

  const isLoading = loadingEval === evalId;
  const isDisabled = isLoading || isEmulatingAnother;

  const getStatusBadge = () => {
    switch (status) {
      case "completed":
        return (
          <Badge variant="default" className="bg-green-500">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Completed
          </Badge>
        );
      case "running":
        return (
          <Badge variant="secondary">
            <Clock className="h-3 w-3 mr-1" />
            Running
          </Badge>
        );
      default:
        return (
          <Badge variant="outline">
            <AlertCircle className="h-3 w-3 mr-1" />
            Pending
          </Badge>
        );
    }
  };

  return (
    <Card className="hover:shadow-md transition-shadow flex flex-col">
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-2">
          <CardTitle className="text-lg line-clamp-2">{name}</CardTitle>
          <p className="text-sm text-muted-foreground line-clamp-3">
            {description}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            {getStatusBadge()}
            <Badge variant="outline">
              {totalRuns} {totalRuns === 1 ? "run" : "runs"}
            </Badge>
            <Badge variant="outline" className="text-xs">
              {rubricName}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex-1">
        <div className="text-sm text-muted-foreground space-y-1">
          <div>
            Completed: {completedRuns} / {totalRuns}
          </div>
          {pendingRuns > 0 && (
            <div>Pending: {pendingRuns}</div>
          )}
        </div>
      </CardContent>
      <CardFooter>
        <Button
          onClick={() => onStartEval(evalId)}
          disabled={isDisabled}
          className="w-full"
          variant="default"
        >
          {isLoading ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Starting...
            </>
          ) : (
            <>
              <Play className="h-4 w-4 mr-2" />
              Start Eval
            </>
          )}
        </Button>
      </CardFooter>
    </Card>
  );
}

export function EvalCardSkeleton() {
  return (
    <Card className="flex flex-col">
      <CardHeader className="pb-3">
        <Skeleton className="h-6 w-3/4 mb-2" />
        <Skeleton className="h-4 w-full mb-1" />
        <Skeleton className="h-4 w-2/3" />
        <div className="flex gap-2 mt-2">
          <Skeleton className="h-5 w-20 rounded-full" />
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
      </CardHeader>
      <CardContent className="flex-1">
        <Skeleton className="h-4 w-full mb-1" />
        <Skeleton className="h-4 w-2/3" />
      </CardContent>
      <CardFooter>
        <Skeleton className="h-10 w-full" />
      </CardFooter>
    </Card>
  );
}

