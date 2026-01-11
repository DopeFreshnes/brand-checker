type TokenCache = {
    accessToken: string;
    // unix ms time when token expires (with a safety buffer)
    expiresAt: number;
  };
  
  let cache: TokenCache | null = null;
  
  export async function getIpauAccessToken(): Promise<string> {
    const tokenUrl = process.env.IPAU_TOKEN_URL;
    const clientId = process.env.IPAU_CLIENT_ID;
    const clientSecret = process.env.IPAU_CLIENT_SECRET;
  
    if (!tokenUrl || !clientId || !clientSecret) {
      throw new Error("Missing IPAU_TOKEN_URL / IPAU_CLIENT_ID / IPAU_CLIENT_SECRET in .env.local");
    }
  
    // Reuse cached token if still valid
    if (cache && Date.now() < cache.expiresAt) {
      return cache.accessToken;
    }
  
    const body = new URLSearchParams();
    body.set("grant_type", "client_credentials");
    body.set("client_id", clientId);
    body.set("client_secret", clientSecret);
  
    const res = await fetch(tokenUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Accept": "application/json",
      },
      body,
      cache: "no-store",
    });
  
    const text = await res.text();
    if (!res.ok) {
      throw new Error(`Token request failed ${res.status}: ${text.slice(0, 200)}`);
    }
  
    const data = JSON.parse(text) as {
      access_token?: string;
      expires_in?: number;
      token_type?: string;
    };
  
    if (!data.access_token) {
      throw new Error(`Token response missing access_token: ${text.slice(0, 200)}`);
    }
  
    const expiresInSec = data.expires_in ?? 3600;
  
    // Cache token with a 60s safety buffer
    cache = {
      accessToken: data.access_token,
      expiresAt: Date.now() + (expiresInSec - 60) * 1000,
    };
  
    return data.access_token;
  }
  