import { createHmac, timingSafeEqual } from "crypto";
import type { Session } from "next-auth";

type HeaderLike = {
  get(name: string): string | null | undefined;
};

const PROFILE_ID_HEADER = "x-test-profile-id";
const SIGNATURE_HEADER = "x-test-signature";

export type TestProfileIds = {
  profileId: string;
};

export function validateTestHeaders(
  headers: HeaderLike,
): TestProfileIds | null {
  const secret =
    process.env["AUTH_SECRET"] || "test_secret_key_for_integration_tests";
  const profileId = headers.get(PROFILE_ID_HEADER)?.trim();
  const signature = headers.get(SIGNATURE_HEADER)?.trim();

  if (!profileId || !signature) {
    return null;
  }

  let provided: Buffer;
  try {
    provided = Buffer.from(signature, "base64");
  } catch {
    return null;
  }

  const hmac = createHmac("sha256", secret);
  hmac.update(profileId);
  const expected = hmac.digest();

  if (provided.length !== expected.length) {
    return null;
  }

  if (!timingSafeEqual(provided, expected)) {
    return null;
  }

  return { profileId };
}

export function createTestSession({ profileId }: TestProfileIds): Session {
  const expires = new Date(Date.now() + 60 * 60 * 1000).toISOString();

  const baseSession: Session = {
    user: {
      id: profileId,
      name: null,
      email: null,
      image: null,
      profileId,
      role: "guest",
    } as Session["user"] & {
      profileId?: string;
      role?: string;
    },
    expires,
  } as Session;

  return {
    ...baseSession,
  } as Session;
}

