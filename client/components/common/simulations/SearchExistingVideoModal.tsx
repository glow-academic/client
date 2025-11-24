"use client";

import { Loader2, Search, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export interface VideoSearchResult {
  id: string;
  name: string | null;
  description: string | null;
  length_seconds: number;
  department_ids: string[] | null;
  score: number;
}

export interface SearchExistingVideoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone?: () => void;
  onStagedVideos?: (
    videos: Array<{
      videoId: string;
      name?: string;
      description?: string;
      length_seconds?: number;
    }>
  ) => void;
  searchVideoAction?: (input: {
    body: { query: string; limit: number; department_ids?: string[] | null };
  }) => Promise<VideoSearchResult[]>;
  existingVideoIds?: string[]; // IDs already in simulation
  departmentIds?: string[]; // For filtering
}

export default function SearchExistingVideoModal({
  open,
  onOpenChange,
  onDone,
  onStagedVideos,
  searchVideoAction,
  existingVideoIds = [],
  departmentIds,
}: SearchExistingVideoModalProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedVideoIds, setSelectedVideoIds] = useState<Set<string>>(
    new Set()
  );
  const [selectedVideos, setSelectedVideos] = useState<
    Map<string, VideoSearchResult>
  >(new Map());
  const [searchResults, setSearchResults] = useState<VideoSearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Format video length
  const formatLength = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  // Search when user types (debounced)
  const handleSearch = useCallback(
    async (query: string) => {
      if (!searchVideoAction) {
        setIsLoading(false);
        return;
      }
      setIsLoading(true);
      try {
        const normalizedQuery = query && query.trim() ? query.trim() : null;
        if (!normalizedQuery) {
          setSearchResults([]);
          setIsLoading(false);
          return;
        }
        const results = await searchVideoAction({
          body: {
            query: normalizedQuery,
            limit: 200,
            department_ids: departmentIds || null,
          },
        });
        // Filter out already existing videos
        const filtered = results.filter(
          (r) => !existingVideoIds.includes(r.id)
        );
        setSearchResults(filtered);
      } catch {
        toast.error("Failed to search videos");
        setSearchResults([]);
      } finally {
        setIsLoading(false);
      }
    },
    [searchVideoAction, existingVideoIds, departmentIds]
  );

  // Handle search input change with debounce
  const handleSearchQueryChange = useCallback(
    (value: string) => {
      setSearchQuery(value);
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
      if (value === "") {
        setSearchResults([]);
        setIsLoading(false);
        return;
      }
      setIsLoading(true);
      searchTimeoutRef.current = setTimeout(() => {
        handleSearch(value);
      }, 500);
    },
    [handleSearch]
  );

  // Reset state when modal closes or opens
  useEffect(() => {
    if (!open) {
      setSearchQuery("");
      setSelectedVideoIds(new Set());
      setSelectedVideos(new Map());
      setSearchResults([]);
      setIsLoading(false);
    }
  }, [open]);

  // Toggle video selection
  const handleToggleVideo = useCallback((video: VideoSearchResult) => {
    const videoId = video.id;
    setSelectedVideoIds((prev) => {
      const next = new Set(prev);
      if (next.has(videoId)) {
        next.delete(videoId);
        setSelectedVideos((prevVideos) => {
          const nextVideos = new Map(prevVideos);
          nextVideos.delete(videoId);
          return nextVideos;
        });
      } else {
        next.add(videoId);
        setSelectedVideos((prevVideos) => {
          const nextVideos = new Map(prevVideos);
          nextVideos.set(videoId, video);
          return nextVideos;
        });
      }
      return next;
    });
  }, []);

  // Handle submitting all selected videos
  const handleSubmit = useCallback(async () => {
    if (selectedVideoIds.size === 0) {
      toast.error("Please select at least one video.");
      return;
    }

    const selectedVideosArray = Array.from(selectedVideos.values());

    if (selectedVideosArray.length === 0) {
      toast.error("No videos selected.");
      return;
    }

    try {
      const videoData = selectedVideosArray.map((video) => ({
        videoId: video.id,
        name: video.name || undefined,
        description: video.description || undefined,
        length_seconds: video.length_seconds,
      }));

      if (onStagedVideos) {
        onStagedVideos(videoData);
        toast.success(
          `${selectedVideosArray.length} video(s) staged. They will be added when you click Update.`
        );
      }

      onOpenChange(false);
      if (onDone) {
        onDone();
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to stage videos.";
      toast.error(errorMessage);
    }
  }, [
    selectedVideoIds,
    selectedVideos,
    onStagedVideos,
    onOpenChange,
    onDone,
  ]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Search Existing Videos</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Search Input */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              id="search"
              placeholder="Search by name or description"
              value={searchQuery}
              onChange={(e) => handleSearchQueryChange(e.target.value)}
              className="pl-10"
              autoFocus
            />
            {isLoading && (
              <Loader2 className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
            )}
          </div>

          {/* Search Results */}
          <div className="border rounded-md max-h-60 overflow-y-auto">
            {isLoading ? (
              <div className="p-4 text-center text-sm text-muted-foreground flex items-center justify-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading videos...
              </div>
            ) : searchResults.length === 0 ? (
              <div className="p-4 text-center text-sm text-muted-foreground">
                {searchQuery && searchQuery.trim()
                  ? "No videos found matching your search"
                  : "Start typing to search for videos"}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[50px]"></TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Length</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {searchResults.map((video) => {
                    const isSelected = selectedVideoIds.has(video.id);
                    return (
                      <TableRow
                        key={video.id}
                        className="cursor-pointer hover:bg-muted/50 transition-colors"
                        onClick={() => handleToggleVideo(video)}
                      >
                        <TableCell
                          onClick={(e) => e.stopPropagation()}
                          className="w-[50px]"
                        >
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => handleToggleVideo(video)}
                          />
                        </TableCell>
                        <TableCell className="font-medium">
                          {video.name || "Unnamed Video"}
                        </TableCell>
                        <TableCell>
                          <p className="text-sm text-muted-foreground line-clamp-2">
                            {video.description || "No description"}
                          </p>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm">
                            {formatLength(video.length_seconds)}
                          </span>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-between pt-4 border-t">
            <div className="flex items-center gap-2 flex-wrap">
              {Array.from(selectedVideos.values()).map((video) => (
                <Badge
                  key={video.id}
                  variant="secondary"
                  className="flex items-center gap-1 pr-1"
                >
                  <span>{video.name || "Unnamed Video"}</span>
                  <button
                    onClick={() => handleToggleVideo(video)}
                    className="ml-1 rounded-full hover:bg-secondary-foreground/20 p-0.5 transition-colors"
                    aria-label={`Remove ${video.name || "video"}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              {selectedVideoIds.size > 0 && (
                <Button onClick={handleSubmit}>
                  Add {selectedVideoIds.size} Video
                  {selectedVideoIds.size !== 1 ? "s" : ""}
                </Button>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

