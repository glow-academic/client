import { Button } from "@/components/ui/button";
import { Lightbulb, Loader2, X } from "lucide-react";

type Hint = {
  hint?: string | null;
  idx?: number | null;
};

interface HintDisplayProps {
  hints: Hint[];
  isLoading?: boolean;
  onClose?: () => void;
}

export default function HintDisplay({
  hints,
  isLoading = false,
  onClose,
}: HintDisplayProps) {
  return (
    <div className="w-full flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Lightbulb className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-semibold text-foreground">
            Hints
          </span>
          {isLoading && (
            <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
          )}
        </div>
        {onClose && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="h-6 w-6 p-0 hover:bg-muted"
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>

      {/* Content */}
      <div>
        {isLoading ? (
          <div className="flex items-center justify-center py-4">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm">Generating suggestions...</span>
            </div>
          </div>
        ) : hints.length > 0 ? (
          <div className="space-y-2">
            {hints.map((hintObj, index) => (
              <div
                key={hintObj.idx ?? index}
                className="flex gap-2 text-sm text-muted-foreground"
              >
                <span className="text-amber-500 font-medium shrink-0">
                  {(hintObj.idx ?? index) + 1}.
                </span>
                <span>{hintObj.hint}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-4">
            Send a message to get hints
          </p>
        )}
      </div>
    </div>
  );
}
