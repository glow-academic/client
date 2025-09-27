import { handle } from "@/lib/api/route-factory";
import { analyticsRepo } from "@/lib/repos/analyticsRepo";
import { log } from "@/utils/logger";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));

  return handle(
    async () => {
      const data = await analyticsRepo.getReports(body);
      return data;
    },
    (e: unknown) =>
      log.error("api.analytics.reports.failed", {
        message: "Failed to fetch reports analytics",
        context: { body },
        error: e,
      })
  );
}
