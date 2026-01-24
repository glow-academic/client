/**
 * Auths.tsx
 * Auth component showing overview of auth entries
 */
"use client";
import { Copy, Edit, Eye, Key, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";

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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useProfile } from "@/contexts/profile-context";

import type {
  AuthListOut,
  DeleteAuthIn,
  DeleteAuthOut,
  DuplicateAuthIn,
  DuplicateAuthOut,
} from "@/app/(main)/system/auth/page";

export interface AuthsProps {
  // Server-provided data (for server-side rendering)
  listData: AuthListOut;
  // Server actions (replaces useMutation)
  duplicateAuthAction?: (input: DuplicateAuthIn) => Promise<DuplicateAuthOut>;
  deleteAuthAction?: (input: DeleteAuthIn) => Promise<DeleteAuthOut>;
}

export default function Auths({
  listData: serverListData,
  duplicateAuthAction,
  deleteAuthAction,
}: AuthsProps) {
  const router = useRouter();
  const { profile } = useProfile();
  const [isDuplicating, setIsDuplicating] = useState<string | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteItem, setDeleteItem] = useState<{
    id: string;
    name: string;
  } | null>(null);

  // Use server-provided data directly
  const authsData = serverListData;

  const auths = useMemo(() => authsData?.auths || [], [authsData]);

  const handleDuplicate = async (auth: (typeof auths)[number]) => {
    if (!auth.can_duplicate || !duplicateAuthAction) {
      toast.error("This auth entry cannot be duplicated");
      return;
    }

    // Ensure profileId exists - required for API calls
    if (!profile?.id) {
      toast.error("Profile not loaded. Please refresh the page.");
      return;
    }

    setIsDuplicating(auth.auth_id);
    try {
      await duplicateAuthAction({
        body: {
          auth_id: auth.auth_id || "",
        },
      });
      toast.success(`Auth "${auth.name}" duplicated successfully`);
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to duplicate auth entry"
      );
    } finally {
      setIsDuplicating(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteItem || !deleteAuthAction) return;

    // Ensure profileId exists - required for API calls
    if (!profile?.id) {
      toast.error("Profile not loaded. Please refresh the page.");
      return;
    }

    try {
      await deleteAuthAction({
        body: {
          auth_id: deleteItem.id,
        },
      });
      toast.success(`Auth "${deleteItem.name}" deleted successfully`);
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to delete auth entry"
      );
    } finally {
      setShowDeleteDialog(false);
      setDeleteItem(null);
    }
  };

  const handleDeleteClick = (id: string, name: string) => {
    setDeleteItem({ id, name });
    setShowDeleteDialog(true);
  };

  const renderPreview = (
    items: NonNullable<
      NonNullable<AuthListOut["auths"]>[number]
    >["sample_items"],
    totalCount: number
  ) => {
    if (!items) return null;
    return (
      <div className="space-y-2">
        {items.map((item) => (
          <div
            key={item.auth_item_id}
            className="flex items-center justify-between p-2 bg-muted/50 rounded-md"
          >
            <div>
              <p className="text-sm font-medium">{item.name}</p>
              <p className="text-xs text-muted-foreground line-clamp-1">
                {item.description}
              </p>
            </div>
          </div>
        ))}
        {totalCount > 3 && (
          <p className="text-xs text-muted-foreground">
            +{totalCount - 3} more
          </p>
        )}
      </div>
    );
  };

  const renderAuthCard = (auth: (typeof auths)[number]) => {
    const count = auth.num_items; // Pre-calculated from server

    return (
      <Card
        key={auth.auth_id}
        className="relative flex flex-col h-full"
        data-testid="auth-card"
        data-auth-id={auth.auth_id}
        role="gridcell"
        aria-label={`auth card ${auth.name}`}
      >
        <CardHeader className="pb-3">
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
            <div className="flex-1 min-w-0">
              <CardTitle className="text-lg flex items-center gap-2">
                <Key className="h-5 w-5" />
                <span className="truncate">{auth.name}</span>
              </CardTitle>
              <div className="flex flex-wrap items-center gap-2 mt-1">
                <Badge variant="outline">
                  {count} {count === 1 ? "item" : "items"}
                </Badge>
                {!auth.active && (
                  <Badge variant="secondary" className="text-xs">
                    Inactive
                  </Badge>
                )}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {auth.can_edit ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => router.push(`/system/auth/a/${auth.auth_id}`)}
                  aria-label={`Edit ${auth.name}`}
                  data-testid="btn-edit-auth"
                  title={`Edit ${auth.name}`}
                  className="h-9 px-3"
                >
                  <Edit className="h-4 w-4 md:mr-0 mr-2" />
                  <span className="md:hidden">Edit</span>
                </Button>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => router.push(`/system/auth/a/${auth.auth_id}`)}
                  aria-label={`View ${auth.name}`}
                  data-testid="btn-view-auth"
                  title={`View ${auth.name}`}
                  className="h-9 px-3"
                >
                  <Eye className="h-4 w-4 md:mr-0 mr-2" />
                  <span className="md:hidden">View</span>
                </Button>
              )}
              {auth.can_duplicate && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleDuplicate(auth)}
                  disabled={isDuplicating === auth.auth_id}
                  aria-busy={isDuplicating === auth.auth_id ? true : undefined}
                  aria-label={`Duplicate ${auth.name}`}
                  data-testid="btn-duplicate-auth"
                  title={`Duplicate ${auth.name}`}
                  className="h-9 px-3"
                >
                  {isDuplicating === auth.auth_id ? (
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent md:mr-0 mr-2" />
                  ) : (
                    <Copy className="h-4 w-4 md:mr-0 mr-2" />
                  )}
                  <span className="md:hidden">
                    {isDuplicating === auth.auth_id
                      ? "Duplicating..."
                      : "Duplicate"}
                  </span>
                </Button>
              )}
              {auth.can_delete && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    handleDeleteClick(auth.auth_id || "", auth.name || "")
                  }
                  aria-label={`Delete ${auth.name}`}
                  data-testid="btn-delete-auth"
                  title={`Delete ${auth.name}`}
                  className="h-9 px-3"
                >
                  <Trash2 className="h-4 w-4 md:mr-0 mr-2" />
                  <span className="md:hidden">Delete</span>
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex-1">
          <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
            {auth.description}
          </p>
          {count &&
            count > 0 &&
            auth.sample_items &&
            auth.sample_items.length > 0 && (
              <div>
                <p className="text-xs font-medium mb-2 text-muted-foreground">
                  Sample Items:
                </p>
                {renderPreview(auth.sample_items, count ?? 0)}
              </div>
            )}
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      {/* Auth Cards Grid */}
      {auths.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12">
          <p className="text-muted-foreground">No auth entries found</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {auths.map((auth) => renderAuthCard(auth))}
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Auth Entry</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deleteItem?.name}"? This action
              cannot be undone and will remove all associated auth items.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteItem(null)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
