import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import type { Catalog, CatalogPark, Deal, LeadPoint } from '@top10/core/types';

// Data is fetched once on page load from the JSON API (apps/api), which wraps @top10/core.

type CatalogResponse = Catalog & { horizonDays: number };
interface PageData {
  catalog: CatalogResponse;
  deals: Deal[];
  lead: LeadPoint[];
}

const WINDOWS = [
  { label: 'Tonight', maxDays: 0 },
  { label: 'Next 3 days', maxDays: 3 },
  { label: 'Next week', maxDays: 7 },
  { label: 'Whole horizon', maxDays: Infinity },
];

const money = (n: number) => n.toLocaleString('en-NZ', { style: 'currency', currency: 'NZD', maximumFractionDigits: 0 });
const day = (stayDate: string) =>
  new Date(stayDate + 'T00:00:00').toLocaleDateString('en-NZ', { weekday: 'short', day: 'numeric', month: 'short' });

const todayKey = () => {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

/** Days from today to the check-in date (0 = tonight). */
const daysAway = (stayDate: string, today: string) =>
  Math.round((Date.parse(stayDate + 'T00:00:00') - Date.parse(today + 'T00:00:00')) / 86_400_000);

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(path);
  const body = await res.json();
  if (!res.ok) throw new Error(body.error ?? res.statusText);
  return body as T;
}

export function App() {
  const [data, setData] = useState<PageData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hotelId, setHotelId] = useState<number | null>(null);
  const [maxDays, setMaxDays] = useState(WINDOWS[2].maxDays);

  useEffect(() => {
    Promise.all([
      getJson<CatalogResponse>('/api/catalog'),
      getJson<Deal[]>('/api/deals'),
      getJson<LeadPoint[]>('/api/lead'),
    ])
      .then(([catalog, deals, lead]) => setData({ catalog, deals, lead }))
      .catch((e: Error) => setError(e.message));
  }, []);

  if (error) {
    return (
      <main className="page">
        <h1>TOP 10 member prices</h1>
        <p className="error">Could not load data: {error}</p>
        <p>Start the API with <code>pnpm run api</code>. If the catalog is missing, run <code>pnpm run cli -- sync</code>.</p>
      </main>
    );
  }
  if (!data) return <main className="page"><p>Loading prices…</p></main>;

  return <Dashboard data={data} hotelId={hotelId} onPark={setHotelId} maxDays={maxDays} onWindow={setMaxDays} />;
}

interface DashboardProps {
  data: PageData;
  hotelId: number | null;
  onPark: (id: number | null) => void;
  maxDays: number;
  onWindow: (n: number) => void;
}

function Dashboard({ data, hotelId, onPark, maxDays, onWindow }: DashboardProps) {
  const today = useMemo(todayKey, []);
  const { catalog, deals, lead } = data;

  // Window filter is applied in the browser, so changing it needs no new request.
  const inWindow = (d: Deal) => daysAway(d.stayDate, today) <= maxDays;
  const visible = deals.filter(inWindow);
  const park = catalog.parks.find((p) => p.hotelId === hotelId) ?? null;

  return (
    <main className="page">
      <header className="top">
        <h1>TOP 10 member prices</h1>
        <label>
          Check-in
          <select value={maxDays} onChange={(e) => onWindow(Number(e.target.value))}>
            {WINDOWS.map((w) => <option key={w.label} value={w.maxDays}>{w.label}</option>)}
          </select>
        </label>
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
              const cheapest = roomDeals.reduce<Deal | null>((best, d) => (!best || d.price < best.price ? d : best), null);
              return (
                <article key={room.roomId} className="room">
                  {room.image && <img src={room.image} alt={room.name} />}
                  <h3>{room.name}</h3>
                  {cheapest ? (
                    <p className="cheapest">From <strong>{money(cheapest.price)}</strong> · {day(cheapest.stayDate)}, {cheapest.nights} nights</p>
                  ) : (
                    <p className="muted">Nothing bookable in this window.</p>
                  )}
                  <ul>
                    {roomDeals.map((d) => (
                      <li key={d.stayDate + d.nights}>
                        <span>{day(d.stayDate)} · {d.nights}n</span>
                        <span>
                          {money(d.price)}
                          {d.isLowest && <em className="tag">lowest seen</em>}
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

      <LeadChart points={lead} />
      <footer className="muted">Catalog synced {new Date(catalog.syncedAt).toLocaleString('en-NZ')} · horizon {catalog.horizonDays} days</footer>
    </main>
  );
}

function ParkCard({ park, deals, selected, onSelect }: { park: CatalogPark; deals: Deal[]; selected: boolean; onSelect: () => void }) {
  const cheapest = deals.reduce<Deal | null>((best, d) => (!best || d.price < best.price ? d : best), null);
  return (
    <button className={`park-card ${selected ? 'selected' : ''}`} onClick={onSelect}>
      {park.image ? <img src={park.image} alt="" /> : <div className="placeholder" />}
      <div className="park-text">
        <strong>{park.name}</strong>
        <span className="muted">{park.town}</span>
        <span>{cheapest ? <>From <b>{money(cheapest.price)}</b> · {deals.length} bookable</> : <span className="muted">Nothing bookable</span>}</span>
      </div>
    </button>
  );
}

function LeadChart({ points }: { points: LeadPoint[] }) {
  if (!points.length) {
    return (
      <section className="lead">
        <h2>When to book</h2>
        <p className="muted">Not enough price history yet. Poll on a schedule and check back.</p>
      </section>
    );
  }
  const worst = Math.max(...points.map((p) => p.avgRatio));
  return (
    <section className="lead">
      <h2>When to book</h2>
      <p className="muted">Average price by days before check-in, compared with the cheapest price seen for each stay. Shorter bars are cheaper.</p>
      <div className="bars">
        {points.map((p) => (
          <div key={p.daysBefore} className="bar-row">
            <span>{p.daysBefore}d</span>
            <div className="bar" style={{ width: `${(p.avgRatio / worst) * 100}%` }} />
            <span>+{((p.avgRatio - 1) * 100).toFixed(1)}%</span>
          </div>
        ))}
      </div>
    </section>
  );
}
