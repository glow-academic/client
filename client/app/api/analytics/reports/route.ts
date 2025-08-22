import { getApiBase } from "@/lib/api-base";
import { handle } from "@/lib/api/route-factory";
import { log } from "@/utils/logger";

function parseArray(value: unknown): string[] | undefined {
  if (Array.isArray(value)) return value.map(String);
  if (typeof value === "string" && value.trim().length > 0) {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed.map(String);
    } catch {
      return value
        .split(",")
        .map((v) => v.trim())
        .filter(Boolean);
    }
  }
  return undefined;
}

export async function POST(req: Request) {
  const json = await req.json().catch(() => ({}));
  const startDate = String(json?.startDate ?? "");
  const endDate = String(json?.endDate ?? "");
  const cohortIds = parseArray(json?.cohortIds) ?? [];
  const roles = parseArray(json?.roles) ?? [];
  const simulationFilters = (parseArray(json?.simulationFilters) as
    | ("general" | "practice" | "archived")[]
    | undefined) ?? ["general"];
  const profileId = json?.profileId ? String(json.profileId) : undefined;

  if (!startDate || !endDate) {
    return Response.json(
      { error: "startDate and endDate are required" },
      { status: 400 }
    );
  }

  const filters = {
    startDate,
    endDate,
    cohortIds,
    roles,
    simulationFilters,
    profileId,
  };

  return handle(
    async () => {
      const base = getApiBase();
      const res = await fetch(`${base}/analytics/leaderboard`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(filters),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || res.statusText);
      }
      return res.json();
    },
    (e: unknown) =>
      log.error("api.analytics.leaderboard.failed", {
        message: "Failed to fetch leaderboard",
        context: { route: "/api/analytics/leaderboard", body: json },
        error: e,
      })
  );
}
