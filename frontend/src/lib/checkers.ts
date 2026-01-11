
import { labelNiceClass } from "@/lib/niceClasses";

export type AvailabilityStatus = "available" | "taken" | "unknown" | "similar";

export type TrademarkMatch = {
  id: string;
  words?: string;
  status?: string;
  classes?: string[];
  classLabels?: string[];
};

export type CheckResult = {
  label: string;
  status: AvailabilityStatus;
  summary?: string;
  whyThisMatters?: string;
  details?: string;
  exactMatches?: TrademarkMatch[];
  similarMatches?: TrademarkMatch[];
};

export type AggregatedResults = {
  businessName: CheckResult;
  trademark: CheckResult;
  domains: CheckResult[];
  socials: CheckResult[];
};

function normalizeQuery(name: string) {
  return name.trim().replace(/\s+/g, " ");
}

// ---- OAuth token caching (valid ~1 hour) ----
let cachedToken: { token: string; expiresAt: number } | null = null;

async function getIpauAccessToken(): Promise<string> {
  const env = process.env.IPAU_ENV || "test";

  const tokenUrl =
    env === "production"
      ? process.env.IPAU_TOKEN_URL_PROD
      : process.env.IPAU_TOKEN_URL_TEST;

  const clientId = process.env.IPAU_CLIENT_ID;
  const clientSecret = process.env.IPAU_CLIENT_SECRET;

  if (!tokenUrl) throw new Error("Missing IPAU_TOKEN_URL_TEST/PROD in .env.local");
  if (!clientId) throw new Error("Missing IPAU_CLIENT_ID in .env.local");
  if (!clientSecret) throw new Error("Missing IPAU_CLIENT_SECRET in .env.local");

  // If we have a valid cached token, reuse it
  if (cachedToken && Date.now() < cachedToken.expiresAt) {
    return cachedToken.token;
  }

  const form = new URLSearchParams();
  form.set("grant_type", "client_credentials");
  form.set("client_id", clientId);
  form.set("client_secret", clientSecret);

  const res = await fetch(tokenUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: form.toString(),
    cache: "no-store",
  });

  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Token request failed ${res.status}: ${text.slice(0, 250)}`);
  }

  const data = JSON.parse(text);
  const accessToken = data?.access_token;
  const expiresIn = Number(data?.expires_in ?? 3600);

  if (!accessToken) {
    throw new Error(`Token response missing access_token: ${text.slice(0, 250)}`);
  }

  // Cache it with a small safety buffer (60s)
  cachedToken = {
    token: accessToken,
    expiresAt: Date.now() + (expiresIn - 60) * 1000,
  };

  return accessToken;
}
function extractNiceClasses(tm: any): string[] {
    // Try common shapes across APIs
    const candidates: any[] = [];
  
    // direct arrays
    if (Array.isArray(tm?.classes)) candidates.push(...tm.classes);
    if (Array.isArray(tm?.niceClasses)) candidates.push(...tm.niceClasses);
    if (Array.isArray(tm?.classifications)) candidates.push(...tm.classifications);
  
    // nested common shapes
    if (Array.isArray(tm?.goodsAndServices?.classes)) candidates.push(...tm.goodsAndServices.classes);
    if (Array.isArray(tm?.goodsAndServices?.niceClasses)) candidates.push(...tm.goodsAndServices.niceClasses);
  
    // sometimes it’s goodsAndServices items, each with a class number
    if (Array.isArray(tm?.goodsAndServices)) candidates.push(...tm.goodsAndServices);
  
    // sometimes “classifications” is object with list inside
    if (Array.isArray(tm?.classificationList)) candidates.push(...tm.classificationList);
  
    // Convert to class numbers
    const numbers = candidates
      .map((c) => (c?.number ?? c?.classNumber ?? c?.niceClass ?? c?.class ?? c?.classId ?? c))
      .map((v) => (v == null ? "" : String(v).trim()))
      .filter(Boolean);
  
    // Deduplicate + sort numerically when possible
    const unique = Array.from(new Set(numbers));
    unique.sort((a, b) => Number(a) - Number(b));
  
    return unique;
  }  

async function fetchTrademarkDetails(id: string, token: string, baseUrl: string) {
    const url = `${baseUrl.replace(/\/$/, "")}/trade-mark/${encodeURIComponent(id)}`;
  
    const res = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
      cache: "no-store",
    });
  
    const text = await res.text();
    if (!res.ok) {
      return { id, error: `Detail fetch failed ${res.status}: ${text.slice(0, 120)}` };
    }
  
    try {
      return { id, data: JSON.parse(text) };
    } catch {
      return { id, error: `Detail fetch returned non-JSON: ${text.slice(0, 120)}` };
    }
  }
  
// ---- IP Australia Trademark quick search ----
export async function checkIpAustraliaTrademark(name: string): Promise<CheckResult> {
    const q = normalizeQuery(name);
  
    const env = process.env.IPAU_ENV || "test";
    const baseUrl =
      env === "production"
        ? process.env.IPAU_TM_BASE_URL_PROD
        : process.env.IPAU_TM_BASE_URL_TEST;
  
    if (!baseUrl) {
      return {
        label: "Trademark (IP Australia)",
        status: "unknown",
        summary: "We couldn’t run the trademark check right now.",
        whyThisMatters:
          "Trademark results help you avoid picking a name that could conflict with an existing brand.",
        details: "Missing IPAU_TM_BASE_URL_TEST/PROD in .env.local",
        exactMatches: [],
        similarMatches: [],
      };
    }
  
    const url = `${baseUrl.replace(/\/$/, "")}/search/quick`;
  
    // ✅ Matches ApiQuickSearchRequest from the docs
    const payload = {
      query: q,
      sort: {
        field: "NUMBER" as const,
        direction: "ASCENDING" as const,
      },
      filters: {
        quickSearchType: ["WORD"] as const,
        status: ["REGISTERED"] as const,
      },
      // Optional:
      // changedSinceDate: "2019-01-15",
    };
  
    try {
      const token = await getIpauAccessToken();
  
      // 1) Quick search
      const res = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(payload),
        cache: "no-store",
      });
  
      const text = await res.text();
      if (!res.ok) {
        return {
          label: "Trademark (IP Australia)",
          status: "unknown",
          summary: "We couldn’t complete the trademark check right now.",
          whyThisMatters:
            "Trademark results help you avoid choosing a name that could conflict with an existing brand.",
          details: `IP Australia error ${res.status}: ${text.slice(0, 250)}`,
          exactMatches: [],
          similarMatches: [],
        };
      }
  
      const data = JSON.parse(text);
  
      // 2) Parse quick search result
      const count = Number(data?.count ?? 0);
      const trademarkIds: string[] = Array.isArray(data?.trademarkIds) ? data.trademarkIds : [];
  
      if (count === 0 || trademarkIds.length === 0) {
        return {
          label: "Trademark (IP Australia)",
          status: "available",
          summary: "No registered word trademarks were found in Australia.",
          whyThisMatters:
            "This lowers risk, but it’s not a guarantee. Similar marks, pending applications, or other rights may still exist.",
          details: "0 registered results returned by IP Australia quick search.",
          exactMatches: [],
          similarMatches: [],
        };
      }
  
      // 3) Fetch details for top IDs (so we can show names + classes)
      const topIds = trademarkIds.slice(0, 5);
      const detailResults = await Promise.all(
        topIds.map((id) => fetchTrademarkDetails(id, token, baseUrl))
      );
  
      // 4) Normalize detailed records -> structured matches
      const qLower = q.toLowerCase();
  
      const parsed = detailResults.map((d) => {
        if ("error" in d) {
          return {
            id: d.id,
            words: "",
            status: "",
            classes: [] as string[],
            classLabels: [] as string[],
            error: true,
          };
        }
  
        const tm = (d as any).data;
        console.log("goodsAndServices sample:", JSON.stringify(tm?.goodsAndServices, null, 2).slice(0, 2000));
  
        // words/name fields vary
        const words =
          (tm?.words ??
            tm?.tradeMarkWords ??
            tm?.markText ??
            tm?.text ??
            tm?.name ??
            tm?.tradeMarkName ??
            "") as string;
  
        // status fields vary
        const status =
          (tm?.statusGroup ??
            tm?.statusCode ??
            tm.statusDetail ??
            tm?.status ??
            tm?.tradeMarkStatus ??
            tm?.state ??
            tm?.ipRightStatus ??
            "") as string;
  
        // classes/categories can be nested; try common shapes
        
        // ✅ IP Australia detail shape: goodsAndServices is an array of { class: "35", descriptionText: [...] }
        const classesSet = new Set<string>();

        if (Array.isArray(tm?.goodsAndServices)) {
            for (const gs of tm.goodsAndServices) {
                const cls = gs?.class;
                if (cls) classesSet.add(String(cls));
            }
        }

        const classes = Array.from(classesSet).sort((a, b) => Number(a) - Number(b));
        const classLabels = classes.map(labelNiceClass);

        // Optional debug (recommended while testing)
        console.log("TM classes:", classes);
        console.log("TM goodsAndServices sample:", JSON.stringify(tm?.goodsAndServices, null, 2).slice(0, 600));

        return {
            id: d.id,
            words: (words ?? "").toString(),
            status: (status ?? "").toString(),
            classes,
            classLabels,
            error: false,
        };

      });
  
      // Split into exact vs similar (ignore “error” rows)
      const exactMatches = parsed
        .filter((p) => !p.error && p.words.toLowerCase() === qLower)
        .map((p) => ({
          id: p.id,
          words: p.words,
          status: p.status,
          classes: p.classes,
          classLabels: p.classLabels,
        }));
  
      const similarMatches = parsed
        .filter((p) => !p.error && p.words.toLowerCase() !== qLower)
        .map((p) => ({
          id: p.id,
          words: p.words,
          status: p.status,
          classes: p.classes,
          classLabels: p.classLabels,
        }));
  
      // If we couldn’t parse any details, fall back to IDs only
      const anyParsed = exactMatches.length + similarMatches.length > 0;
  
      if (!anyParsed) {
        return {
          label: "Trademark (IP Australia)",
          status: "similar",
          summary: "Registered trademarks exist with this name or something similar.",
          whyThisMatters:
            "Even if names aren’t identical, similar marks in related categories can increase legal and branding risk.",
          details: `Found ${count} registered match(es). IDs: ${trademarkIds.slice(0, 5).join(", ")}`,
          exactMatches: [],
          similarMatches: trademarkIds.slice(0, 5).map((id) => ({ id })),
        };
      }
  
      const isTaken = exactMatches.length > 0;
  
      return {
        label: "Trademark (IP Australia)",
        status: isTaken ? "taken" : "similar",
        summary: isTaken
          ? "An identical registered trademark exists in Australia."
          : "Similar registered trademarks exist in Australia.",
        whyThisMatters: isTaken
          ? "Using the same name can create a high risk of trademark conflict, especially in related industries."
          : "Even if names aren’t identical, similar marks in related categories can still cause legal and branding risk.",
        details: `Found ${count} registered match(es). Showing the top ${topIds.length}.`,
        exactMatches,
        similarMatches,
      };
    } catch (err: any) {
      return {
        label: "Trademark (IP Australia)",
        status: "unknown",
        summary: "We couldn’t run the trademark check right now.",
        whyThisMatters:
          "Trademark results help you avoid choosing a name that could conflict with an existing brand.",
        details: `Request failed: ${err?.message || "unknown error"}`,
        exactMatches: [],
        similarMatches: [],
      };
    }
  }
  
// ---- MVP aggregated results ----
export async function getDemoResults(name: string): Promise<AggregatedResults> {
  const normalized = name.toLowerCase().trim();
  const compact = normalized.replace(/\s+/g, "");

  // Demo logic (keep for now)
  const isProbablyTaken = normalized.includes("koala") || normalized.includes("australia");
  const hasSimilar = normalized.includes("brew") || normalized.includes("coffee");

  // Real trademark check
  const trademark = await checkIpAustraliaTrademark(name);

  return {
    businessName: {
      label: "ASIC business name (AU)",
      status: isProbablyTaken ? "taken" : "available",
      details: isProbablyTaken
        ? "A similar or identical business name appears to exist (demo)."
        : "No exact match found (demo).",
    },
    trademark,
    domains: [
      {
        label: `${compact}.com`,
        status: isProbablyTaken ? "taken" : "available",
        details: isProbablyTaken ? "Likely registered already (demo)." : "Appears free (demo).",
      },
      {
        label: `${compact}.com.au`,
        status: hasSimilar ? "similar" : "available",
        details: hasSimilar ? "Similar domains may exist (demo)." : "Appears free (demo).",
      },
    ],
    socials: [
      {
        label: `@${compact} (Instagram)`,
        status: isProbablyTaken ? "taken" : "available",
        details: isProbablyTaken ? "Handle looks popular (demo)." : "Appears free (demo).",
      },
      {
        label: `@${compact} (TikTok)`,
        status: "available",
        details: "Appears free (demo).",
      },
    ],
  };
}
