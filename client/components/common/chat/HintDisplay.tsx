import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Copy, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface HintDisplayProps {
  hints: string[];
  isLoading?: boolean;
  onClose: () => void;
  onSelectHint: (hint: string) => void;
}

export default function HintDisplay({
  hints,
  isLoading = false,
  onClose,
  onSelectHint,
}: HintDisplayProps) {
  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Hint copied to clipboard!");
  };

  return (
    <Card className="w-full max-w-md mx-auto bg-white dark:bg-gray-800 shadow-lg rounded-lg">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg font-semibold flex items-center gap-2">
          GTA Suggestions
          {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
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
          hints.map((hint, index) => (
            <div
              key={index}
              className="flex flex-col p-3 border rounded-md bg-gray-50 dark:bg-gray-700"
            >
              <p className="text-sm text-gray-800 dark:text-gray-200 mb-2">
                {hint}
              </p>
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleCopy(hint)}
                  className="text-xs"
                >
                  <Copy className="h-3 w-3 mr-1" /> Copy
                </Button>
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => onSelectHint(hint)}
                  className="text-xs"
                >
                  Use This
                </Button>
              </div>
            </div>
          ))
        ) : (
          <p className="text-sm text-muted-foreground text-center py-4">
            Send a message to get GTA response suggestions
          </p>
        )}
      </CardContent>
    </Card>
  );
}
