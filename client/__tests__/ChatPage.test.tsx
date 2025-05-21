import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import ChatPage from "../app/chat/[chatId]/page";
import { vi, expect, beforeEach, describe, it } from "vitest";

// Mock the query functions
vi.mock("@/utils/queries/get-messages", () => ({
  getMessages: vi.fn().mockResolvedValue([
    {
      id: "msg1",
      created_at: new Date().toISOString(),
      query: "Existing message",
      response: "Existing response",
      completed: true,
    },
  ]),
}));

vi.mock("@/utils/queries/get-user", () => ({
  getUser: vi.fn().mockResolvedValue({
    id: "11111111-1111-1111-1111-111111111111",
    username: "user1",
  }),
}));

vi.mock("@/utils/queries/get-chat", () => ({
  getChat: vi.fn().mockResolvedValue({
    id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
    title: "Test Chat",
    user_id: "11111111-1111-1111-1111-111111111111",
  }),
}));

// Mock fetch API
global.fetch = vi.fn().mockImplementation(() =>
  Promise.resolve({
    json: () =>
      Promise.resolve({
        chat_id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
        response: "Echo: Hello",
      }),
  }),
);

// Mock environment variable
vi.stubEnv("NEXT_PUBLIC_API_URL", "http://localhost:8000");

describe("ChatPage", () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  // Create resolved params object to match the component's expectations
  const resolvedParams = Promise.resolve({
    chatId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
  });

  beforeEach(() => {
    render(
      <QueryClientProvider client={queryClient}>
        <ChatPage params={resolvedParams} />
      </QueryClientProvider>,
    );
  });

  it("renders the chat input and submit button", () => {
    expect(
      screen.getByPlaceholderText("Type your message..."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /send/i })).toBeInTheDocument();
  });

  it("displays existing messages from the query", async () => {
    await waitFor(() => {
      expect(screen.getByText("Existing message")).toBeInTheDocument();
      expect(screen.getByText("Existing response")).toBeInTheDocument();
    });
  });

  it("allows users to type and submit messages", async () => {
    const input = screen.getByPlaceholderText("Type your message...");
    const submitButton = screen.getByRole("button", { name: /send/i });

    fireEvent.change(input, { target: { value: "Hello" } });
    expect(input).toHaveValue("Hello");

    fireEvent.click(submitButton);

    // Input should be cleared after submission
    await waitFor(() => {
      expect(input).toHaveValue("");
    });

    // Verify fetch was called with the right parameters
    expect(fetch).toHaveBeenCalledWith("http://localhost:8000/chat", {
      method: "POST",
      body: expect.any(FormData),
    });

    // Verify the FormData contains the right values
    const fetchCall = (fetch as any).mock.calls[0];
    const formData = fetchCall[1].body;
    expect(formData.get("message")).toBe("Hello");
    expect(formData.get("chat_id")).toBe(
      "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
    );
  });
});
