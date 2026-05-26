/**
 * Internal helper for artifact upload modules.
 *
 * Wraps a File in FormData under the canonical ``file`` part name,
 * POSTs to the given BFF route, and asserts the response carries the
 * required id key. All exported helpers in this folder thread through
 * here so error handling stays consistent.
 */

export async function uploadMultipart<T>(
  endpoint: string,
  file: File,
  requiredKey: keyof T & string,
): Promise<T> {
  const form = new FormData();
  form.append("file", file);

  const response = await fetch(endpoint, {
    method: "POST",
    body: form,
  });
  if (!response.ok) {
    const errText = await response.text().catch(() => "");
    throw new Error(errText || `Upload failed (${response.status})`);
  }
  const result = (await response.json()) as T;
  if (!(result as Record<string, unknown>)[requiredKey]) {
    throw new Error(`Upload response missing ${requiredKey}`);
  }
  return result;
}
