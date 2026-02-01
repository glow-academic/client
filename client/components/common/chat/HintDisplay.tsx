import { Button } from "@/components/ui/button";
import { Loader2, X } from "lucide-react";

type Hint = {
  simulation_message_id: string;
  hint: string;
  idx: number;
  created_at: string;
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
    <div className="w-full flex flex-col gap-2">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h4 className="text-lg font-semibold text-popover-foreground">
            Hints
          </h4>
          {isLoading && (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          )}
        </div>
        {onClose && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="h-6 w-6 p-0"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Content */}
      <div>
        {isLoading ? (
          <div className="flex items-center justify-center py-2">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm">Generating suggestions...</span>
            </div>
          </div>
        ) : hints.length > 0 ? (
          <ul className="space-y-1 list-disc ml-4">
            {hints.map((hintObj) => (
              <li key={hintObj.idx} className="text-sm text-popover-foreground">
                {hintObj.hint}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-4">
            Send a message to get hints
          </p>
        )}
      </div>
    </div>
  );
}
