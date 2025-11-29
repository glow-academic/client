/**
 * Evals.tsx
 * Evals list component with card-based layout
 * @AshokSaravanan222
 * 01/26/2025
 */
"use client";

import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Eye,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import type {
  DeleteEvalIn,
  DeleteEvalOut,
  EvalsListOut,
} from "@/app/(main)/engine/evals/page";
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
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useProfile } from "@/contexts/profile-context";

export interface EvalsProps {
  listData: EvalsListOut;
  deleteEvalAction?: (input: DeleteEvalIn) => Promise<DeleteEvalOut>;
}

export default function Evals({
  listData: serverListData,
  deleteEvalAction,
}: EvalsProps) {
  const router = useRouter();
  const { socket } = useProfile();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteItem, setDeleteItem] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [evals, setEvals] = useState(serverListData.evals || []);

  // Update evals when server data changes
  useEffect(() => {
    setEvals(serverListData.evals || []);
  }, [serverListData]);

  // WebSocket integration for real-time status updates
  useEffect(() => {
    if (!socket) return;

    const handleEvalProgress = (data: {
      eval_id: string;
      model_run_id?: string;
      status: string;
      message: string;
    }) => {
      setEvals((prev) =>
        prev.map((evalItem) => {
          if (evalItem.eval_id === data.eval_id) {
            // Update status based on progress
            let newStatus = evalItem.status;
            if (data.status === "running") {
              newStatus = "running";
            } else if (data.status === "completed") {
              // Check if all runs are completed
              const newCompletedRuns = evalItem.completed_runs + 1;
              if (newCompletedRuns >= evalItem.total_runs) {
                newStatus = "completed";
              } else {
                newStatus = "running";
              }
              return {
                ...evalItem,
                completed_runs: newCompletedRuns,
                pending_runs: evalItem.pending_runs - 1,
                status: newStatus,
              };
            }
            return evalItem;
          }
          return evalItem;
        })
      );
    };

    const handleEvalCompleted = (data: {
      eval_id: string;
      message: string;
    }) => {
      setEvals((prev) =>
        prev.map((evalItem) => {
          if (evalItem.eval_id === data.eval_id) {
            return {
              ...evalItem,
              status: "completed",
              pending_runs: 0,
              completed_runs: evalItem.total_runs,
            };
          }
          return evalItem;
        })
      );
    };

    const handleEvalStopped = (data: {
      eval_id: string;
      success: boolean;
      stopped_count: number;
    }) => {
      setEvals((prev) =>
        prev.map((evalItem) => {
          if (evalItem.eval_id === data.eval_id) {
            return {
              ...evalItem,
              status: "completed",
              pending_runs: Math.max(
                0,
                evalItem.pending_runs - data.stopped_count
              ),
              completed_runs: evalItem.completed_runs + data.stopped_count,
            };
          }
          return evalItem;
        })
      );
    };

    socket.on("eval_progress", handleEvalProgress);
    socket.on("eval_completed", handleEvalCompleted);
    socket.on("eval_stopped", handleEvalStopped);

    return () => {
      socket.off("eval_progress", handleEvalProgress);
      socket.off("eval_completed", handleEvalCompleted);
      socket.off("eval_stopped", handleEvalStopped);
    };
  }, [socket]);

  const handleDelete = async () => {
    if (!deleteItem || !deleteEvalAction) return;

    try {
      await deleteEvalAction({
        body: {
          evalId: deleteItem.id,
          profileId: "", // Will be filled by server action
        },
      });
      toast.success(`Eval "${deleteItem.name}" deleted successfully`);
      setShowDeleteDialog(false);
      setDeleteItem(null);
      router.refresh();
    } catch (error) {
      toast.error(`Failed to delete eval: ${error}`);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "running":
        return (
          <Badge variant="default" className="bg-blue-500">
            <Clock className="h-3 w-3 mr-1" />
            Running
          </Badge>
        );
      case "completed":
        return (
          <Badge variant="default" className="bg-green-500">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Completed
          </Badge>
        );
      case "pending":
      default:
        return (
          <Badge variant="secondary">
            <AlertCircle className="h-3 w-3 mr-1" />
            Pending
          </Badge>
        );
    }
  };

  const filteredEvals = useMemo(() => {
    if (!searchQuery) return evals;
    const query = searchQuery.toLowerCase();
    return evals.filter(
      (evalItem) =>
        evalItem.name.toLowerCase().includes(query) ||
        evalItem.description.toLowerCase().includes(query) ||
        evalItem.rubric_name.toLowerCase().includes(query)
    );
  }, [evals, searchQuery]);

  const renderEvalCard = (evalItem: (typeof evals)[number]) => (
    <Card
      key={evalItem.eval_id}
      className="hover:shadow-md transition-shadow cursor-pointer"
      onClick={() => router.push(`/engine/evals/e/${evalItem.eval_id}`)}
      data-testid="eval-card"
      data-eval-id={evalItem.eval_id}
    >
      <CardHeader className="pb-3">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
          <div className="flex-1 min-w-0">
            <CardTitle className="text-lg truncate">{evalItem.name}</CardTitle>
            <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
              {evalItem.description}
            </p>
            <div className="flex flex-wrap items-center gap-2 mt-2">
              {getStatusBadge(evalItem.status)}
              <Badge variant="outline">
                {evalItem.total_runs}{" "}
                {evalItem.total_runs === 1 ? "run" : "runs"}
              </Badge>
              <Badge variant="outline" className="text-xs">
                {evalItem.rubric_name}
              </Badge>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                router.push(`/engine/evals/e/${evalItem.eval_id}`);
              }}
            >
              <Eye className="h-4 w-4 mr-2" />
              View
            </Button>
            {evalItem.can_delete && deleteEvalAction && (
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  setDeleteItem({ id: evalItem.eval_id, name: evalItem.name });
                  setShowDeleteDialog(true);
                }}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
    </Card>
  );

  return (
    <div className="space-y-6" data-page="evals-index">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Evals</h1>
          <p className="text-muted-foreground">
            Manage and run evaluations on model runs
          </p>
        </div>
        <Button onClick={() => router.push("/engine/evals/new")}>
          <Plus className="h-4 w-4 mr-2" />
          New Eval
        </Button>
      </div>

      <div className="flex items-center gap-2">
        <Input
          placeholder="Search evals..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="max-w-sm"
        />
        {searchQuery && (
          <Button variant="ghost" size="sm" onClick={() => setSearchQuery("")}>
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {filteredEvals.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12">
          <p className="text-muted-foreground">
            {searchQuery ? "No evals match your search" : "No evals found"}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredEvals.map(renderEvalCard)}
        </div>
      )}

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Eval</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deleteItem?.name}"? This action
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
