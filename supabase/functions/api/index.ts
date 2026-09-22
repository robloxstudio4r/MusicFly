import { serve } from "https://deno.land/std/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SERVICE_KEY = Deno.env.get("SERVICE_ROLE_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const admin = createClient(SUPABASE_URL, SERVICE_KEY);

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  const auth = req.headers.get("authorization") ?? "";
  const token = auth.replace(/^Bearer\s+/i, "");
  if (!token) return json({ error: "missing api key" }, 401);

  // Validate key
  const { data: keyRow } = await admin
    .from("api_keys")
    .select("user_id, revoked")
    .eq("key", token)
    .maybeSingle();
  if (!keyRow || keyRow.revoked) return json({ error: "invalid api key" }, 401);

  // Check user is premium
  const { data: profile } = await admin
    .from("profiles")
    .select("premium, banned")
    .eq("id", keyRow.user_id)
    .single();
  if (!profile || profile.banned)   return json({ error: "account disabled" }, 403);
  if (!profile.premium)             return json({ error: "premium required" }, 403);

  // Rate limit (simple: log calls, reject > 1000/hr)
  const hourAgo = new Date(Date.now() - 3600_000).toISOString();
  const { count } = await admin
    .from("api_calls")
    .select("*", { count: "exact", head: true })
    .eq("api_key", token)
    .gte("created_at", hourAgo);
  if ((count ?? 0) > 1000) return json({ error: "rate limit exceeded" }, 429);

  await admin.from("api_calls").insert({ api_key: token, endpoint: req.url });

  const url = new URL(req.url);
  const path = url.pathname.replace(/^\/api/, "");

  if (path === "/tracks" || path === "/v1/tracks") {
    const { data } = await admin
      .from("tracks").select("id,title,artist,genre,plays")
      .eq("published", true)
      .limit(Number(url.searchParams.get("limit") ?? 50));
    return json({ data });
  }

  if (path === "/tracks/search" || path === "/v1/tracks/search") {
    const q = url.searchParams.get("q") ?? "";
    const { data } = await admin
      .from("tracks").select("id,title,artist,genre")
      .eq("published", true)
      .or(`title.ilike.%${q}%,artist.ilike.%${q}%`)
      .limit(50);
    return json({ data });
  }

  return json({ error: "not found" }, 404);
});
