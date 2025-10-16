/**
 * Logs hooks for v2 API
 * Provides useLogger hook that automatically includes profile context
 */

import { useProfile } from "@/contexts/profile-context";
import { log as baseLog } from "@/lib/api/v2/server/logs";

/**
 * Logger hook that automatically includes the current profile as actor
 * Use this in components for automatic context injection
 */
export function useLogger() {
  const { effectiveProfile } = useProfile();

  return {
    info: (
      event: string,
      rest: Omit<Parameters<typeof baseLog.info>[1], "actor">
    ) =>
      baseLog.info(event, {
        actor: { profileId: effectiveProfile?.id },
        ...rest,
      }),
    warn: (
      event: string,
      rest: Omit<Parameters<typeof baseLog.warn>[1], "actor">
    ) =>
      baseLog.warn(event, {
        actor: { profileId: effectiveProfile?.id },
        ...rest,
      }),
    error: (
      event: string,
      rest: Omit<Parameters<typeof baseLog.error>[1], "actor">
    ) =>
      baseLog.error(event, {
        actor: { profileId: effectiveProfile?.id },
        ...rest,
      }),
    debug: (
      event: string,
      rest: Omit<Parameters<typeof baseLog.debug>[1], "actor">
    ) =>
      baseLog.debug(event, {
        actor: { profileId: effectiveProfile?.id },
        ...rest,
      }),
  };
}
