type TokenResponse = {
    access_token: string;
    expires_in: number; // seconds
    token_type: string; // "Bearer"
  };
  
  let cachedToken: { value: string; expiresAtMs: number } | null = null;
  
  const TOKEN_URL =
    "https://production.api.ipaustralia.gov.au/public/external-token-api/v1/access_token";
  
  const TM_BASE =
    "https://production.api.ipaustralia.gov.au/public/australian-trade-mark-search-api/v1";
  
  function requireEnv(name: string): string {
    const v = process.env[name];
    if (!v) throw new Error(`Missing env var: ${name}`);
    return v;
  }
  
  async function getAccessToken(): Promise<string> {
    // Reuse token if still valid (give ourselves a 60s buffer)
    if (cachedToken && Date.now() < cachedToken.expiresAtMs - 60_000) {
      return cachedToken.value;
    }
  
    const clientId = requireEnv("IPA_CLIENT_ID");
    const clientSecret = requireEnv("IPA_CLIENT_SECRET");
  
    const form = new URLSearchParams();
    form.set("grant_type", "client_credentials");
    form.set("client_id", clientId);
    form.set("client_secret", clientSecret);
  
    const res = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form.toString(),
    });
  
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Token request failed: ${res.status} ${text}`);
    }
  
    const json = (await res.json()) as TokenResponse;
    const expiresAtMs = Date.now() + json.expires_in * 1000;
  
    cachedToken = { value: json.access_token, expiresAtMs };
    return json.access_token;
  }
  
  // Tries to pull “numbers/ids” from whatever shape the API returns.
  function extractIds(payload: any): string[] {
    // Common patterns we might see:
    // { results: ["123", "456"] }
    // { tradeMarkNumbers: [...] }
    // { ipRightIdentifiers: [...] }
    // { results: [{ number: "123" }, ...] }
    const candidates: any[] = [
      payload?.results,
      payload?.tradeMarkNumbers,
      payload?.ipRightIdentifiers,
      payload?.items,
      payload?.data,
    ].filter(Boolean);
  
    for (const c of candidates) {
      if (Array.isArray(c)) {
        // Array of strings
        if (c.every((x) => typeof x === "string" || typeof x === "number")) {
          return c.map((x) => String(x));
        }
        // Array of objects that might contain number/id
        const maybe = c
          .map((x) => x?.number ?? x?.ipRightIdentifier ?? x?.id)
          .filter(Boolean)
          .map((x) => String(x));
        if (maybe.length) return maybe;
      }
    }
  
    return [];
  }
  
  export async function searchTrademarks(query: string): Promise<{
    status: "available" | "similar" | "taken" | "unknown";
    hits: Array<{ number: string; words?: string; statusText?: string }>;
  }> {
    const token = await getAccessToken();
  
    // Quick Search request shape from gov docs:
    // POST /search/quick with { query, sort, filters... } :contentReference[oaicite:1]{index=1}
    const quickBody = {
      query,
      sort: { field: "NUMBER", direction: "DESCENDING" },
      filters: {
        quickSearchType: ["WORD"], // simplest to start with
        // You can add status filters later if desired
        // status: ["REGISTERED", "ACCEPTED", "PENDING"]
      },
    };
  
    const quickRes = await fetch(`${TM_BASE}/search/quick`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(quickBody),
    });
  
    if (!quickRes.ok) {
      const text = await quickRes.text();
      throw new Error(`TM quick search failed: ${quickRes.status} ${text}`);
    }
  
    const quickJson = await quickRes.json();
    const ids = extractIds(quickJson).slice(0, 5);
  
    // If no hits, likely available (at least by simple word search)
    if (ids.length === 0) {
      return { status: "available", hits: [] };
    }
  
    // Fetch details for top hits so we can show something meaningful
    const hits = await Promise.all(
      ids.map(async (id) => {
        try {
          const dRes = await fetch(`${TM_BASE}/trade-mark/${encodeURIComponent(id)}`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (!dRes.ok) return { number: id };
  
          const d = await dRes.json();
  
          // Best-effort extraction (field names can vary)
          const words =
            d?.words ?? d?.markWords ?? d?.tradeMark?.words ?? d?.tradeMark?.markWords;
  
          const statusText =
            d?.status?.label ??
            d?.status ??
            d?.tradeMark?.status?.label ??
            d?.tradeMark?.status;
  
          return { number: id, words, statusText };
        } catch {
          return { number: id };
        }
      })
    );
  
    // For MVP, “similar” is a safe default if we got any hits.
    // Later you can tighten this to "taken" when exact match appears.
    return { status: "similar", hits };
  }
  