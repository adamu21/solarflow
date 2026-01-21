
// If you want these exact 5 fields only:
export type ActRecRow = {
  _idnum: string | string;
  recnum: number | string;
  jobnme: string | null;
  shtnme: string | null;
  addrs1: string | null;
};

export async function fetchActrecTop(top = 20, offset = 0): Promise<ActRecRow[]> {
  const base = import.meta.env.VITE_API_BASE;
  if (!base) throw new Error("VITE_API_BASE is not defined (check .env.local)");

  const url = `${base}/actrec?top=${encodeURIComponent(top)}&offset=${encodeURIComponent(offset)}`;
  const res = await fetch(url, { method: "GET" });

  // Helpful logging during dev
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Failed to fetch actrec (${res.status}) ${text}`);
  }

  const json = await res.json();
  // Defensive: map to just the columns you want
  const rows = (json?.data ?? []).map((r: any) => ({
    _idnum: r?._idnum ?? "",
    recnum: r?.recnum ?? "",
    jobnme: r?.jobnme ?? "",
    shtnme: r?.shtnme ?? "",
    addrs1: r?.addrs1 ?? "",
  }));
  return rows as ActRecRow[];
};