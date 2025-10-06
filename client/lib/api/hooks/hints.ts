import { useWebSocket } from "@/contexts/websocket-context";
import { log } from "@/utils/logger";
import { useCallback, useState } from "react";

interface HintRequest {
  chat_id: string;
  student_message: string;
}

interface HintResponse {
  success: boolean;
  chat_id: string;
  hints: string[];
}

export const useHint = () => {
  const { socket } = useWebSocket();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getHints = useCallback(
    async ({ chat_id, student_message }: HintRequest): Promise<string[]> => {
      if (!socket) {
        throw new Error("WebSocket not connected");
      }

      setIsLoading(true);
      setError(null);

      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          setIsLoading(false);
          reject(new Error("Hint request timeout"));
        }, 30000); // 30 second timeout

        const handleHintsReceived = (data: HintResponse) => {
          if (data.chat_id === chat_id) {
            clearTimeout(timeout);
            socket.off("hints_received", handleHintsReceived);
            socket.off("simulation_error", handleError);
            setIsLoading(false);

            if (data.success) {
              log.info("hint.fetch.success", {
                message: "Hints received successfully",
                context: {
                  file: "client/lib/api/hooks/hints.ts",
                  function: "getHints",
                  hintsCount: data.hints.length,
                },
              });
              resolve(data.hints);
            } else {
              reject(new Error("Failed to get hints"));
            }
          }
        };

        const handleError = (data: { message: string }) => {
          clearTimeout(timeout);
          socket.off("hints_received", handleHintsReceived);
          socket.off("simulation_error", handleError);
          setIsLoading(false);

          log.error("hint.fetch.error", {
            message: data.message,
            context: {
              file: "client/lib/api/hooks/hints.ts",
              function: "getHints",
            },
          });
          setError(data.message);
          reject(new Error(data.message));
        };

        // Set up event listeners
        socket.on("hints_received", handleHintsReceived);
        socket.on("simulation_error", handleError);

        // Send the hint request
        socket.emit("get_hints", {
          chat_id,
          student_message,
        });

        log.info("hint.fetch.request", {
          message: "Hint request sent",
          context: {
            file: "client/lib/api/hooks/hints.ts",
            function: "getHints",
            chat_id,
          },
        });
      });
    },
    [socket]
  );

  return {
    getHints,
    isLoading,
    error,
  };
};
