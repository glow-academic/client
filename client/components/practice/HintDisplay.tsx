import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, X } from "lucide-react";

import type { AttemptFullResponse } from "@/lib/api/v2/schemas/attempts";

interface HintDisplayProps {
  hints: AttemptFullResponse["chats"][number]["hints"][number]["hints"];
  isLoading?: boolean;
  onClose?: () => void;
}

export default function HintDisplay({
  hints,
  isLoading = false,
  onClose,
}: HintDisplayProps) {
  return (
    <Card className="w-full max-w-md mx-auto bg-white dark:bg-gray-800 shadow-lg rounded-lg">
      <CardHeader className="pb-0">
        <CardTitle className="text-lg font-semibold flex items-center justify-between">
          <div className="flex items-center gap-2">
            Hints
            {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
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
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0 -mt-4">
        {isLoading ? (
          <div className="flex items-center justify-center">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Generating suggestions...</span>
            </div>
          </div>
        ) : hints.length > 0 ? (
          <ul className="space-y-2 list-disc list-inside pl-4">
            {hints.map((hintObj) => (
              <li
                key={hintObj.idx}
                className="text-sm text-gray-800 dark:text-gray-200"
              >
                {hintObj.hint}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-4">
            Send a message to get hints
          </p>
        )}
      </CardContent>
    </Card>
  );
}
