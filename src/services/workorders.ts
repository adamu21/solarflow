
// src/services/workorder.ts
// Small helper that calls the backend /workorders endpoint and returns typed rows.

export type WorkOrderRow = {
  orddte: string;            // dates come over JSON as strings; format depends on your DB
  ordnum: number;
  dscrpt: string | null;
  recnum: number;
  clnnum: number;
  clnnme: string | null;
  shtcln: string | null;
  addrs: string | null;
  contact: string | null;
  phone: string | null;
  email: string | null;
};

export type WorkOrdersResponse = {
  data: WorkOrderRow[];
  count: number;
  offset: number;
  top: number;
  q?: string | null;
};

export async function fetchWorkOrders(
  top = 20,
  offset = 0,
  q: string | undefined = undefined
): Promise<WorkOrderRow[]> {
  // Where is the API? In dev, you set this in .env.local
  // You can also fall back to '/api' if you added a Vite proxy.
  const base = import.meta.env.VITE_API_BASE || '/api';

  const params = new URLSearchParams({
    top: String(top),
    offset: String(offset),
  });
  if (q && q.trim()) params.set('q', q.trim());

  const url = `${base}/workorders?${params.toString()}`;
  const res = await fetch(url);

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Failed to fetch work orders (${res.status}) ${text}`);
  }

  const json: WorkOrdersResponse = await res.json();

  // Optional: ensure numeric types are numbers (not strings)
  const rows = (json?.data ?? []).map((r: any) => ({
    orddte: r?.orddte ?? '',
    ordnum: Number(r?.ordnum ?? 0),
    dscrpt: r?.dscrpt ?? null,
    recnum: Number(r?.recnum ?? 0),
    clnnum: Number(r?.clnnum ?? 0),
    clnnme: r?.clnnme ?? null,
    shtcln: r?.shtcln ?? null,
    addrs: r?.addrs ?? null,
    contact: r?.contact ?? null,
    phone: r?.phone ?? null,
    email: r?.email ?? null,
  }));

  return rows as WorkOrderRow[];
}
