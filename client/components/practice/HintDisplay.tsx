import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Copy, Loader2, X } from "lucide-react";
import { toast } from "sonner";

interface HintDisplayProps {
  hints: Array<{ id: string; hint: string }>;
  isLoading?: boolean;
  onSelectHint: (hint: string) => void;
  onClose?: () => void;
}

export default function HintDisplay({
  hints,
  isLoading = false,
  onSelectHint,
  onClose,
}: HintDisplayProps) {
  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Hint copied to clipboard!");
  };

  return (
    <Card className="w-full max-w-md mx-auto bg-white dark:bg-gray-800 shadow-lg rounded-lg">
      <CardHeader className="pb-2">
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
      <CardContent className="space-y-3">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Generating suggestions...</span>
            </div>
          </div>
        ) : hints.length > 0 ? (
          hints.map((hintObj) => (
            <div
              key={hintObj.id}
              className="flex flex-col p-3 border rounded-md bg-gray-50 dark:bg-gray-700"
            >
              <p className="text-sm text-gray-800 dark:text-gray-200 mb-2">
                {hintObj.hint}
              </p>
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleCopy(hintObj.hint)}
                  className="text-xs"
                >
                  <Copy className="h-3 w-3 mr-1" /> Copy
                </Button>
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => onSelectHint(hintObj.hint)}
                  className="text-xs"
                >
                  Use This
                </Button>
              </div>
            </div>
          ))
        ) : (
          <p className="text-sm text-muted-foreground text-center py-4">
            Send a message to get hints
          </p>
        )}
      </CardContent>
    </Card>
  );
}
