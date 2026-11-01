import { useEffect, useState, type CSSProperties } from 'react';
import type { Catalog, CatalogPark, Deal, DealsResult, RefreshStatus } from '@top10/core/types';

// Data is fetched once on page load from the JSON API (apps/api), which wraps @top10/core.

type CatalogResponse = Catalog & { horizonDays: number };
interface PageData {
  catalog: CatalogResponse;
  prices: DealsResult;
}

const money = (n: number) => n.toLocaleString('en-NZ', { style: 'currency', currency: 'NZD' });
const day = (stayDate: string) =>
  new Date(stayDate + 'T00:00:00').toLocaleDateString('en-NZ', { weekday: 'short', day: 'numeric', month: 'short' });

const cheapestOf = (deals: Deal[]) =>
  deals.reduce<Deal | null>((best, d) => (!best || d.price < best.price ? d : best), null);

async function getJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, init);
  const body = await res.json();
  if (!res.ok) throw new Error(body.error ?? res.statusText);
  return body as T;
}

export function App() {
  const [data, setData] = useState<PageData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hotelId, setHotelId] = useState<number | null>(null);
  const [status, setStatus] = useState<RefreshStatus | null>(null);

  // On load: read what we have, and ask the API to poll if the last poll is stale.
  useEffect(() => {
    Promise.all([
      getJson<CatalogResponse>('/api/catalog'),
      getJson<DealsResult>('/api/deals'),
      getJson<RefreshStatus>('/api/refresh', { method: 'POST' }),
    ])
      .then(([catalog, prices, st]) => {
        setData({ catalog, prices });
        setStatus(st);
      })
      .catch((e: Error) => setError(e.message));
  }, []);

  // While a poll runs (a few minutes), check on it and reload the prices when it finishes.
  const polling = status?.polling ?? false;
  useEffect(() => {
    if (!polling) return;
    const timer = setInterval(async () => {
      try {
        const st = await getJson<RefreshStatus>('/api/status');
        if (st.polling) return;
        const prices = await getJson<DealsResult>('/api/deals');
        setData((d) => d && { ...d, prices });
        setStatus(st);
      } catch (e) {
        setError((e as Error).message);
      }
    }, 5000);
    return () => clearInterval(timer);
  }, [polling]);

  // Stop tracking a room. The API updates config.json and returns the new catalog.
  const removeRoom = async (roomId: number, name: string) => {
    if (!window.confirm(`Stop tracking "${name}"? It is removed from config.json.`)) return;
    try {
      const catalog = await getJson<CatalogResponse>(`/api/rooms/${roomId}`, { method: 'DELETE' });
      const prices = await getJson<DealsResult>('/api/deals');
      setData({ catalog, prices });
      setHotelId((id) => (catalog.parks.some((p) => p.hotelId === id) ? id : null));
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const refreshNow = () =>
    getJson<RefreshStatus>('/api/refresh?force=1', { method: 'POST' }).then(setStatus).catch((e: Error) => setError(e.message));

  if (error) {
    return (
      <main className="page">
        <h1>TOP 10 member prices</h1>
        <p className="error">Could not load data: {error}</p>
        <p>
          Start the API with <code>pnpm run api</code>. If prices are missing, run <code>pnpm run cli -- poll</code>;
          if the catalog is missing, run <code>pnpm run cli -- sync</code>.
        </p>
      </main>
    );
  }
  if (!data) return <main className="page"><p>Loading prices…</p></main>;

  return <Dashboard data={data} status={status} onRefresh={refreshNow} onRemove={removeRoom} hotelId={hotelId} onPark={setHotelId} />;
}

interface DashboardProps {
  data: PageData;
  status: RefreshStatus | null;
  onRefresh: () => void;
  onRemove: (roomId: number, name: string) => void;
  hotelId: number | null;
  onPark: (id: number | null) => void;
}

function Dashboard({ data, status, onRefresh, onRemove, hotelId, onPark }: DashboardProps) {
  const { catalog, prices } = data;
  // The API returns stays from today onward, so every stay shown here is current.
  const visible = prices.deals;
  const park = catalog.parks.find((p) => p.hotelId === hotelId) ?? null;

  return (
    <main className="page">
      <header className="top">
        <h1>TOP 10 member prices</h1>
      </header>

      <section className="parks">
        {catalog.parks.map((p) => (
          <ParkCard
            key={p.hotelId}
            park={p}
            deals={visible.filter((d) => d.hotelId === p.hotelId)}
            selected={p.hotelId === hotelId}
            onSelect={() => onPark(p.hotelId === hotelId ? null : p.hotelId)}
          />
        ))}
      </section>

      {park && (
        <section className="park-detail">
          <div className="hero" style={park.image ? ({ '--hero': `url("${park.image}")` } as CSSProperties) : undefined}>
            <h2>{park.name}</h2>
            <span>{park.town}</span>
          </div>
          <p><a href={park.url} target="_blank" rel="noreferrer">View on TOP 10 site ↗</a></p>
          <div className="rooms">
            {park.rooms.map((room) => {
              const roomDeals = visible.filter((d) => d.roomId === room.roomId).sort((a, b) => a.stayDate.localeCompare(b.stayDate));
              const cheapest = cheapestOf(roomDeals);
              return (
                <article key={room.roomId} className="room">
                  <button className="remove" title="Stop tracking this room" aria-label={`Stop tracking ${room.name}`} onClick={() => onRemove(room.roomId, room.name)}>
                    <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M2 2l8 8M10 2l-8 8" /></svg>
                  </button>
                  {room.image && <img src={room.image} alt={room.name} />}
                  <h3><a href={room.url} target="_blank" rel="noreferrer">{room.name} ↗</a></h3>
                  {cheapest ? (
                    <p className="cheapest">From <strong>{money(cheapest.price)}</strong> / night · {day(cheapest.stayDate)}, {cheapest.nights} nights ({money(cheapest.total)} total)</p>
                  ) : (
                    <p className="muted">Nothing bookable in this window.</p>
                  )}
                  <ul>
                    {roomDeals.map((d) => (
                      <li key={d.stayDate + d.nights} title={`${money(d.total)} total for ${d.nights} nights`}>
                        <span>{day(d.stayDate)} · {d.nights}n</span>
                        <span>
                          {money(d.price)} / night
                          {d.low && d.low.price < d.price && <span className="muted"> · low {money(d.low.price)}</span>}
                        </span>
                      </li>
                    ))}
                  </ul>
                </article>
              );
            })}
          </div>
        </section>
      )}

      <footer className="muted">
        {prices.fetchedAt ? `Prices from ${new Date(prices.fetchedAt).toLocaleString('en-NZ')}` : 'No prices yet'} ·{' '}
        {status?.polling ? 'Refreshing prices, this takes a few minutes…' : <button onClick={onRefresh}>Refresh prices</button>}
        {status?.error && <span className="error"> Refresh failed: {status.error}</span>}
      </footer>
    </main>
  );
}

function ParkCard({ park, deals, selected, onSelect }: { park: CatalogPark; deals: Deal[]; selected: boolean; onSelect: () => void }) {
  const cheapest = cheapestOf(deals);
  return (
    <button className={`park-card ${selected ? 'selected' : ''}`} onClick={onSelect}>
      {park.image ? <img src={park.image} alt="" /> : <div className="placeholder" />}
      <div className="park-text">
        <strong>{park.name}</strong>
        <span className="muted">{park.town}</span>
        <span>{cheapest ? <>From <b>{money(cheapest.price)}</b> / night · {deals.length} bookable</> : <span className="muted">Nothing bookable</span>}</span>
      </div>
    </button>
  );
}
