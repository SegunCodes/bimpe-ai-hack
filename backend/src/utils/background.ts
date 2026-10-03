import { waitUntil } from "@vercel/functions";

/**
 * Lets work finish after the response is sent. On Vercel this keeps the function alive until
 * the promise settles; elsewhere (local dev) the promise simply keeps running.
 */
export function runInBackground(work: Promise<void>): void {
  const guarded = work.catch((error: unknown) => console.error("Background work failed:", error));
  try {
    waitUntil(guarded);
  } catch {
    // Not running on Vercel: nothing else to do, the promise is already running.
  }
}
