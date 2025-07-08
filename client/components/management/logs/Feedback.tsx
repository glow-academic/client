/**
 * Feedback.tsx
 * Used to look at feedback from users.
 * @AshokSaravanan222 & @siladiea
 * 07/08/2025
 */
"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getAllAppFeedback } from "@/utils/queries/app_feedback/get-all-app-feedback";
import { getAllProfiles } from "@/utils/queries/profiles/get-all-profiles";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { MessageSquare, RefreshCw, X } from "lucide-react";
import { useMemo, useState } from "react";

interface AppFeedback {
  id: number;
  createdAt: string | null;
  profileId: string | null;
  type: "feature" | "bug" | "question" | "other";
  message: string | null;
}

interface Profile {
  id: string;
  firstName: string;
  lastName: string;
  alias: string;
}

export default function Feedback() {
  const [selectedFeedback, setSelectedFeedback] = useState<AppFeedback | null>(
    null
  );
  const [filterType, setFilterType] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const queryClient = useQueryClient();

  const { data: feedbackData, isLoading: loadingFeedback } = useQuery({
    queryKey: ["app_feedback"],
    queryFn: () => getAllAppFeedback(),
    refetchInterval: 60000, // Refetch every minute
  });

  // Get unique profile IDs from feedback data
  const profileIds = useMemo(() => {
    if (!feedbackData) return [];
    return [...new Set(feedbackData.map((f) => f.profileId).filter(Boolean))];
  }, [feedbackData]);

  // Fetch profiles for feedback authors
  const { data: profiles = [] } = useQuery({
    queryKey: ["profiles", profileIds],
    queryFn: async () => getAllProfiles(),
    enabled: profileIds.length > 0,
  });

  const profileMap = useMemo(() => {
    const map: Record<string, Profile> = {};
    profiles.forEach((profile) => {
      if (profile) {
        map[profile.id] = profile;
      }
    });
    return map;
  }, [profiles]);

  const filteredFeedback = useMemo(() => {
    if (!feedbackData) return [];

    return feedbackData.filter((feedback) => {
      // Filter by type
      if (filterType !== "all" && feedback.type !== filterType) {
        return false;
      }

      // Filter by search term
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase();
        const matchesMessage = feedback.message
          ?.toLowerCase()
          .includes(searchLower);
        const profile = feedback.profileId
          ? profileMap[feedback.profileId]
          : null;
        const matchesAuthor = profile
          ? `${profile.firstName} ${profile.lastName}`
              .toLowerCase()
              .includes(searchLower) ||
            profile.alias.toLowerCase().includes(searchLower)
          : false;

        if (!matchesMessage && !matchesAuthor) {
          return false;
        }
      }

      return true;
    });
  }, [feedbackData, filterType, searchTerm, profileMap]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await queryClient.invalidateQueries({ queryKey: ["app_feedback"] });
    } finally {
      setIsRefreshing(false);
    }
  };

  const getFeedbackTypeVariant = (type: string) => {
    switch (type) {
      case "bug":
        return "destructive";
      case "feature":
        return "default";
      case "question":
        return "secondary";
      case "other":
        return "outline";
      default:
        return "default";
    }
  };

  const getFeedbackTypeIcon = (type: string) => {
    switch (type) {
      case "bug":
        return "🐛";
      case "feature":
        return "✨";
      case "question":
        return "❓";
      case "other":
        return "📝";
      default:
        return "📝";
    }
  };

  const formatTimestamp = (timestamp: string | null) => {
    if (!timestamp) return "N/A";
    return new Date(timestamp).toLocaleString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const truncateText = (text: string | null, maxLength: number = 100) => {
    if (!text) return "N/A";
    return text.length > maxLength
      ? `${text.substring(0, maxLength)}...`
      : text;
  };

  const getAuthorName = (profileId: string | null) => {
    if (!profileId) return "Anonymous";
    const profile = profileMap[profileId];
    if (!profile) return "Unknown User";
    return `${profile.firstName} ${profile.lastName}`;
  };

  const getAuthorAlias = (profileId: string | null) => {
    if (!profileId) return "";
    const profile = profileMap[profileId];
    if (!profile) return "";
    return profile.alias;
  };

  const clearFilters = () => {
    setFilterType("all");
    setSearchTerm("");
  };

  if (loadingFeedback) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                User Feedback
              </CardTitle>
              <CardDescription>
                Feedback and suggestions from users
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={isRefreshing}
            >
              <RefreshCw
                className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`}
              />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-64">
            <div className="text-lg">Loading feedback...</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!feedbackData || feedbackData.length === 0) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                User Feedback
              </CardTitle>
              <CardDescription>
                Feedback and suggestions from users
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={isRefreshing}
            >
              <RefreshCw
                className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`}
              />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <MessageSquare className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
              <div className="text-lg text-muted-foreground">
                No feedback found
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              User Feedback
            </CardTitle>
            <CardDescription>
              Feedback and suggestions from users ({feedbackData.length} total)
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isRefreshing}
          >
            <RefreshCw
              className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`}
            />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
          <div className="flex flex-col sm:flex-row gap-2 flex-1">
            <div className="flex items-center gap-2">
              <Label htmlFor="search" className="text-sm font-medium">
                Search:
              </Label>
              <Input
                id="search"
                placeholder="Search feedback or author..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full sm:w-64"
              />
            </div>

            <div className="flex items-center gap-2">
              <Label htmlFor="type-filter" className="text-sm font-medium">
                Type:
              </Label>
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger id="type-filter" className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="bug">🐛 Bug</SelectItem>
                  <SelectItem value="feature">✨ Feature</SelectItem>
                  <SelectItem value="question">❓ Question</SelectItem>
                  <SelectItem value="other">📝 Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {(filterType !== "all" || searchTerm) && (
            <Button
              variant="outline"
              size="sm"
              onClick={clearFilters}
              className="flex items-center gap-2"
            >
              <X className="h-3 w-3" />
              Clear Filters
            </Button>
          )}
        </div>

        {/* Results count */}
        <div className="text-sm text-muted-foreground">
          Showing {filteredFeedback.length} of {feedbackData.length} feedback
          items
        </div>

        {/* Feedback Table - Scrollable */}
        <div className="border rounded-lg max-h-96 overflow-auto">
          <Table>
            <TableHeader className="sticky top-0 bg-background">
              <TableRow>
                <TableHead className="w-[80px]">ID</TableHead>
                <TableHead className="w-[120px]">Type</TableHead>
                <TableHead>Message</TableHead>
                <TableHead className="w-[150px]">Author</TableHead>
                <TableHead className="w-[180px]">Created At</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredFeedback.map((feedback) => (
                <TableRow key={feedback.id}>
                  <TableCell className="font-medium">{feedback.id}</TableCell>
                  <TableCell>
                    <Badge variant={getFeedbackTypeVariant(feedback.type)}>
                      {getFeedbackTypeIcon(feedback.type)}{" "}
                      {feedback.type.toUpperCase()}
                    </Badge>
                  </TableCell>
                  <TableCell className="max-w-md">
                    <span className="truncate">
                      {truncateText(feedback.message)}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-medium text-sm">
                        {getAuthorName(feedback.profileId)}
                      </span>
                      {getAuthorAlias(feedback.profileId) && (
                        <span className="text-xs text-muted-foreground">
                          {getAuthorAlias(feedback.profileId)}
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">
                    {formatTimestamp(feedback.createdAt)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* Detail Dialog */}
        <Dialog
          open={selectedFeedback !== null}
          onOpenChange={(open) => !open && setSelectedFeedback(null)}
        >
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <div className="space-y-4">
              {selectedFeedback && (
                <>
                  <div className="flex items-center gap-2 pb-2 border-b">
                    <Badge
                      variant={getFeedbackTypeVariant(selectedFeedback.type)}
                    >
                      {getFeedbackTypeIcon(selectedFeedback.type)}{" "}
                      {selectedFeedback.type.toUpperCase()}
                    </Badge>
                    <span className="text-sm text-muted-foreground">
                      ID: {selectedFeedback.id}
                    </span>
                  </div>

                  <div>
                    <h4 className="font-semibold mb-2">Author</h4>
                    <div className="bg-muted p-3 rounded-lg">
                      <div className="font-medium">
                        {getAuthorName(selectedFeedback.profileId)}
                      </div>
                      {getAuthorAlias(selectedFeedback.profileId) && (
                        <div className="text-sm text-muted-foreground">
                          {getAuthorAlias(selectedFeedback.profileId)}
                        </div>
                      )}
                    </div>
                  </div>

                  <div>
                    <h4 className="font-semibold mb-2">Message</h4>
                    <div className="bg-muted p-4 rounded-lg">
                      <p className="whitespace-pre-wrap text-sm">
                        {selectedFeedback.message || "No message provided"}
                      </p>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-semibold mb-2">Submitted</h4>
                    <div className="bg-muted p-3 rounded-lg">
                      <div className="text-sm">
                        {formatTimestamp(selectedFeedback.createdAt)}
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
