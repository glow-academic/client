import { render } from '@/test/custom-render';
import { screen } from '@/test/custom-render';
import { describe, expect, it, vi } from "vitest";

// Mock NewPersona component
vi.mock("@/components/create/personas/NewPersona", () => ({
  __esModule: true,
  default: () => (
    <div data-testid="new-persona-component">New Persona Component</div>
  ),
}));

import NewPersonaPage, {
  metadata,
} from "@/app/(main)/create/personas/new/page";

describe("NewPersonaPage", () => {
  it("renders without crashing", () => {
    render(<NewPersonaPage />);
    expect(screen.getByTestId("new-persona-component")).toBeInTheDocument();
    expect(screen.getByText("New Persona Component")).toBeInTheDocument();
  });

  it("exports correct metadata", () => {
    expect(metadata).toBeDefined();
    expect(metadata.title).toBe("New Persona");
    expect(metadata.description).toContain("New persona creation page");
  });

  it("renders the NewPersona component inside a wrapper", () => {
    render(<NewPersonaPage />);
    const wrapper = screen.getByTestId("new-persona-component").parentElement;
    expect(wrapper).toHaveClass("space-y-6");
  });
});
