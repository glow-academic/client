import { getSimulatableProfiles } from "./get-simulatable-profiles";

export async function canEmulate({
  requesterRole,
  targetProfileId,
}: {
  requesterRole: string;
  targetProfileId: string;
}) {
  // Example policy:
  // superadmin: can emulate anyone
  // admin/instructional: can emulate only among getSimulatableProfiles(requester)
  if (requesterRole === "superadmin") return true;

  // Fetch simulatable ids for requester from DB
  try {
    const allowedProfiles = await getSimulatableProfiles();
    return allowedProfiles.some((profile) => profile.id === targetProfileId);
  } catch {
    // If we can't fetch the profiles, deny by default
    return false;
  }
}
