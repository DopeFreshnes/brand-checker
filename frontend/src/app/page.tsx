"use client";

import { useState } from "react";
import { TrademarkCard } from "@/components/TrademarkCard";

type AvailabilityStatus = "available" | "taken" | "unknown" | "similar";

type TrademarkMatch = {
  id: string;
  words?: string;
  status?: string;
  classes?: string[];
  classLabels?: string[];
};

type CheckResult = {
  label: string;
  status: AvailabilityStatus;
  details?: string;

  summary?: string;
  whyThisMatters?: string;
  exactMatches?: TrademarkMatch[];
  similarMatches?: TrademarkMatch[];
};


type ApiResponse = {
  success: boolean;
  results: {
    businessName: CheckResult;
    trademark: CheckResult;
    domains: CheckResult[];
    socials: CheckResult[];
  };
  error?: string;
};

export default function HomePage() {
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ApiResponse | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setData(null);

    if (!name.trim()) {
      setError("Please enter a name to check.");
      return;
    }

    try {
      setLoading(true);
      const res = await fetch("/api/check", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name }),
      });

      if (!res.ok) {
        throw new Error(`Request failed with status ${res.status}`);
      }

      const json = (await res.json()) as ApiResponse;
      setData(json);
      if (!json.success && json.error) {
        setError(json.error);
      }
    } catch (err: any) {
      console.error(err);
      setError("Something went wrong while checking. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const renderStatusBadge = (status: AvailabilityStatus) => {
    const base = "inline-flex items-center rounded-full px-2 py-1 text-xs font-medium";
    switch (status) {
      case "available":
        return <span className={`${base} bg-green-100 text-green-800`}>Available</span>;
      case "taken":
        return <span className={`${base} bg-red-100 text-red-800`}>Taken</span>;
      case "similar":
        return <span className={`${base} bg-amber-100 text-amber-800`}>Similar</span>;
      case "unknown":
      default:
        return <span className={`${base} bg-gray-100 text-gray-800`}>Unknown</span>;
    }
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50">
      <div className="mx-auto flex max-w-3xl flex-col gap-8 px-4 py-10">
        <header className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">
            Brand Availability Checker (AU MVP)
          </h1>
          <p className="text-sm text-slate-300">
            Check a potential business / brand name across{" "}
            <span className="font-medium">business names, trademarks, domains & socials</span> in
            one go. This MVP uses demo data for now.
          </p>
        </header>

        <form
          onSubmit={handleSubmit}
          className="flex flex-col gap-3 rounded-2xl bg-slate-900/70 p-4 shadow-lg ring-1 ring-slate-800"
        >
          <label className="text-sm font-medium text-slate-200">
            Brand or business name
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-50 shadow-inner outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400"
              placeholder="e.g. Koala Brew"
            />
          </label>

          <button
            type="submit"
            disabled={loading}
            className="inline-flex items-center justify-center rounded-xl bg-indigo-500 px-4 py-2 text-sm font-medium text-white shadow-md transition hover:bg-indigo-400 hover:shadow-lg disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-300"
          >
            {loading ? "Checking..." : "Check availability"}
          </button>

          {error && (
            <p className="text-sm text-rose-300">
              {error}
            </p>
          )}

          <p className="text-xs text-slate-400">
            Note: This is an early prototype and not legal advice. Data sources & real-time
            checks will be wired in later for ASIC, IP Australia, domains & socials.
          </p>
        </form>

        {data?.success ? (
          <section className="space-y-4">
            <h2 className="text-lg font-semibold text-slate-100">Results</h2>

            <div className="grid gap-4 md:grid-cols-2">
              {/* Business Name */}
              <div className="rounded-2xl bg-slate-900/70 p-4 ring-1 ring-slate-800">
                <div className="mb-1 flex items-center justify-between">
                  <h3 className="text-sm font-medium text-slate-100">Business name (Australia)</h3>
                  {renderStatusBadge(data.results.businessName.status)}
                </div>
                {data.results.businessName.details ? (
                  <p className="text-xs text-slate-400">{data.results.businessName.details}</p>
                ) : null}
              </div>

              {/* Trademark */}
              <TrademarkCard trademark={data.results.trademark} />
            </div>

            {/* Domains */}
            <div className="rounded-2xl bg-slate-900/70 p-4 ring-1 ring-slate-800">
              <h3 className="mb-2 text-sm font-medium text-slate-100">Domains</h3>
              <div className="space-y-2">
                {data.results.domains.map((d) => (
                  <div key={d.label} className="flex items-center justify-between text-xs">
                    <span className="text-slate-200">{d.label}</span>
                    <div className="flex items-center gap-2">
                      {renderStatusBadge(d.status)}
                      {d.details ? <span className="text-[10px] text-slate-400">{d.details}</span> : null}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Socials */}
            <div className="rounded-2xl bg-slate-900/70 p-4 ring-1 ring-slate-800">
              <h3 className="mb-2 text-sm font-medium text-slate-100">Social handles</h3>
              <div className="space-y-2">
                {data.results.socials.map((s) => (
                  <div key={s.label} className="flex items-center justify-between text-xs">
                    <span className="text-slate-200">{s.label}</span>
                    <div className="flex items-center gap-2">
                      {renderStatusBadge(s.status)}
                      {s.details ? <span className="text-[10px] text-slate-400">{s.details}</span> : null}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        ) : null}
      </div>
    </main>
  );
}
