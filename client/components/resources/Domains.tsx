/**
 * Domains.tsx
 * Resource component for domain selection
 * Shows available domains with resource type and creatable flag
 */

"use client";

import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { Check, Loader2, Sparkles, X } from "lucide-react";
import { useCallback, useMemo } from "react";

export interface DomainsProps {
  domain_ids?: string[];
  domain_resources?: Array<{
    id?: string | null;
    resource?: string | null;
    creatable?: boolean | null;
    generated?: boolean | null;
  }>;
  show_domains?: boolean;
  domains?: Array<{
    id?: string | null;
    resource?: string | null;
    creatable?: boolean | null;
    generated?: boolean | null;
  }>;
  disabled?: boolean;
  onChange: (ids: string[]) => void;
  label?: string;
  id?: string;
  required?: boolean;
  group_id?: string | null;
  link_tool_id?: string | null;
  showAiGenerate?: boolean;
  onGenerate?: () => void | Promise<void>;
  isGenerating?: boolean;
  aiDomainResources?: Array<{
    id?: string | null;
    resource?: string | null;
  }> | null;
  onAccept?: () => void;
  onReject?: () => void;
}

export function Domains({
  domain_ids,
  domain_resources,
  show_domains = false,
  domains,
  disabled = false,
  onChange,
  label = "Domains",
  id = "domains",
  required = false,
  showAiGenerate = false,
  onGenerate,
  isGenerating = false,
  aiDomainResources,
  onAccept,
  onReject,
}: DomainsProps) {
  const ids = useMemo(() => domain_ids ?? [], [domain_ids]);
  const show = show_domains ?? false;
  const allDomains = useMemo(() => domains ?? [], [domains]);

  const showDiff = !!aiDomainResources?.length;

  const hasGenerated = useMemo(() => {
    return domain_resources?.some((d) => d.generated) ?? false;
  }, [domain_resources]);

  const handleToggle = useCallback(
    (domainId: string) => {
      if (ids.includes(domainId)) {
        onChange(ids.filter((id) => id !== domainId));
      } else {
        onChange([...ids, domainId]);
      }
    },
    [ids, onChange]
  );

  const handleAccept = useCallback(() => {
    if (!aiDomainResources?.length) return;
    const newIds = aiDomainResources
      .map((d) => d.id)
      .filter((id): id is string => !!id && !ids.includes(id));
    if (newIds.length > 0) {
      onChange([...ids, ...newIds]);
    }
    onAccept?.();
  }, [aiDomainResources, ids, onChange, onAccept]);

  const handleReject = useCallback(() => {
    onReject?.();
  }, [onReject]);

  if (!show) {
    return null;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        {label && (
          <Label htmlFor={id} className="flex items-center gap-1">
            {label}
            {required && <span className="text-destructive">*</span>}
          </Label>
        )}
        {onGenerate && showAiGenerate && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={onGenerate}
                  disabled={disabled || isGenerating || showDiff}
                >
                  {isGenerating ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="h-3.5 w-3.5" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {hasGenerated ? "Regenerate" : "Generate"}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
        {showDiff && (
          <>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-success hover:text-success"
                    onClick={handleAccept}
                  >
                    <Check className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Accept</TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-destructive hover:text-destructive"
                    onClick={handleReject}
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Reject</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        {allDomains.map((domain) => {
          const isSelected = domain.id ? ids.includes(domain.id) : false;
          return (
            <Button
              key={domain.id ?? "unknown"}
              type="button"
              variant={isSelected ? "default" : "outline"}
              size="sm"
              onClick={() => domain.id && handleToggle(domain.id)}
              disabled={disabled}
              className={cn("gap-2", isSelected && "ring-2 ring-primary")}
            >
              {domain.resource ?? "Unknown"}
              {domain.creatable && (
                <Badge variant="secondary" className="text-[10px] px-1 py-0">
                  Creatable
                </Badge>
              )}
            </Button>
          );
        })}
        {allDomains.length === 0 && (
          <p className="text-sm text-muted-foreground">No domains available.</p>
        )}
      </div>
    </div>
  );
}
