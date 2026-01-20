
// solarflow/services/actrec.ts
export type ActRecRow = Record<string, any>; // you can tighten this to your real schema later

export async function fetchActrecTop(top = 20, offset = 0): Promise<ActRecRow[]> {
  const base = import.meta.env.VITE_API_BASE; // from your .env.local during dev
  if (!base) {
    throw new Error("VITE_API_BASE is not defined. Did you set .env.local?");
  }

  const url = `${base}/actrec?top=${encodeURIComponent(top)}&offset=${encodeURIComponent(offset)}`;
  const res = await fetch(url, { method: "GET" });
  if (!res.ok) {
    throw new Error(`API error ${res.status}`);
  }
  const json = await res.json(); // { data, count, offset, top }
  return json.data as ActRecRow[];
}
