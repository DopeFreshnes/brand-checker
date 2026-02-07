"use client";

type AvailabilityStatus = "available" | "taken" | "unknown" | "similar";

export type TrademarkMatch = {
  id: string;
  words?: string;
  status?: string;
  classes?: string[];
  classLabels?: string[];
};

export type TrademarkResult = {
  label: string;
  status: AvailabilityStatus;
  summary?: string;
  whyThisMatters?: string;
  details?: string;
  exactMatches?: TrademarkMatch[];
  similarMatches?: TrademarkMatch[];
};

function StatusBadge({ status }: { status: AvailabilityStatus }) {
  const base = "inline-flex items-center rounded-full px-2 py-1 text-xs font-medium";
  switch (status) {
    case "available":
      return <span className={`${base} bg-green-100 text-green-800`}>Available</span>;
    case "taken":
      return <span className={`${base} bg-red-100 text-red-800`}>Taken</span>;
    case "similar":
      return <span className={`${base} bg-amber-100 text-amber-800`}>Similar</span>;
    default:
      return <span className={`${base} bg-gray-100 text-gray-800`}>Unknown</span>;
  }
}

function WhyTooltip({ text }: { text?: string }) {
  if (!text) return null;
  return (
    <span
      className="ml-2 inline-flex cursor-help items-center rounded-full border border-slate-700 bg-slate-950 px-2 py-0.5 text-[10px] text-slate-200"
      title={text}
    >
      Why this matters
    </span>
  );
}

function RecordLink({ id }: { id: string }) {
  const href = `https://search.ipaustralia.gov.au/trademarks/search/view/${encodeURIComponent(id)}`;
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="text-slate-100 underline decoration-slate-500 underline-offset-2 hover:decoration-slate-200"
    >
      {id}
    </a>
  );
}

function MatchRow({ match }: { match: TrademarkMatch }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-3">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
        <RecordLink id={match.id} />
        {match.words ? <span className="text-slate-200">“{match.words}”</span> : null}
        {match.status ? <span className="text-slate-400">{match.status}</span> : null}
      </div>

      {match.classLabels?.length ? (
        <div className="mt-2 text-[11px] text-slate-300">
          <span className="font-medium text-slate-200">Classes:</span>{" "}
          {match.classLabels.slice(0, 6).join(", ")}
          {match.classLabels.length > 6 ? "…" : ""}
        </div>
      ) : null}
    </div>
  );
}

export function TrademarkCard({ trademark }: { trademark: TrademarkResult }) {
  const exact = trademark.exactMatches ?? [];
  const similar = trademark.similarMatches ?? [];

  return (
    <div className="rounded-2xl bg-slate-900/70 p-4 ring-1 ring-slate-800">
      <div className="mb-2 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-medium text-slate-100">{trademark.label ?? "Trademark"}</h3>

          {trademark.summary ? (
            <p className="mt-1 text-xs text-slate-300">{trademark.summary}</p>
          ) : null}

          <WhyTooltip text={trademark.whyThisMatters} />
        </div>

        <StatusBadge status={trademark.status} />
      </div>

      {trademark.details ? <p className="text-xs text-slate-400">{trademark.details}</p> : null}

      {exact.length > 0 ? (
        <div className="mt-4">
          <div className="mb-2 text-xs font-semibold text-slate-200">Exact matches</div>
          <div className="grid gap-2">
            {exact.map((m) => (
              <MatchRow key={`exact-${m.id}`} match={m} />
            ))}
          </div>
        </div>
      ) : null}

      {similar.length > 0 ? (
        <div className="mt-4">
          <div className="mb-2 text-xs font-semibold text-slate-200">Similar matches</div>
          <div className="grid gap-2">
            {similar.map((m) => (
              <MatchRow key={`sim-${m.id}`} match={m} />
            ))}
          </div>
        </div>
      ) : null}

      <p className="mt-4 text-[10px] text-slate-500">
        Not legal advice. Consider professional advice before registering or using a brand.
      </p>
    </div>
  );
}
