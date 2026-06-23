import { createBrowserClient } from "@supabase/ssr";
import { getSupabaseAnonKey, getSupabaseUrl } from "@/lib/supabase/env";

export function createClient() {
  const url = getSupabaseUrl();
  const key = getSupabaseAnonKey();
  // #region agent log
  if (typeof window !== "undefined") {
    fetch("http://127.0.0.1:7317/ingest/5ca51102-074a-497f-a02f-436942c7f190", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Debug-Session-Id": "427e58",
      },
      body: JSON.stringify({
        sessionId: "427e58",
        runId: "pre-fix",
        hypothesisId: "H2",
        location: "lib/supabase/client.ts:createClient",
        message: "supabase client config",
        data: {
          urlHost: url.replace(/^https?:\/\//, "").split("/")[0],
          keyPrefix: key.slice(0, 12),
          keyLooksPublishable: key.startsWith("sb_publishable"),
          keyLooksAnon: key.startsWith("eyJ"),
        },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
  }
  // #endregion
  return createBrowserClient(url, key);
}
