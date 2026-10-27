import { readFileSync, writeFileSync } from 'node:fs';

// Regenerates data/parks.json from the public /api/parks endpoint.
// Only parks and rooms listed in data/whitelist.json ({ "<hotelId>": [roomTypeId, ...] }) are kept.
// Usage: npm run sync-parks
const BASE = 'https://top10.co.nz';
const whitelist: Record<string, number[]> = JSON.parse(readFileSync('data/whitelist.json', 'utf8'));

const res = await fetch(`${BASE}/api/parks`, { headers: { 'user-agent': 'Mozilla/5.0' } });
if (!res.ok) throw new Error(`/api/parks ${res.status}`);
const parks: any[] = await res.json();

const out = Object.entries(whitelist).map(([hotelId, roomIds]) => {
  const p = parks.find((x) => x.hotelId === Number(hotelId));
  if (!p) throw new Error(`hotelId ${hotelId} not found`);
  const rooms = roomIds.map((id) => {
    const r = p.rooms.find((x: any) => x.roomTypeId === id);
    if (!r) throw new Error(`room ${id} not found in hotel ${hotelId}`);
    return {
      roomTypeId: r.roomTypeId, name: r.name, types: (r.types ?? []).map((t: any) => t.name),
      sleeps: r.sleeps, isPetFriendly: r.isPetFriendly, url: r.url, abstract: r.abstract?.trim(),
    };
  });
  return {
    hotelId: p.hotelId, parkId: p.id, name: p.name, title: p.title, region: p.regionName,
    town: p.townOrDistrict, address: p.address, lat: p.lat, long: p.long, phone: p.phone?.name,
    url: BASE + p.url, isPetFriendly: p.isPetFriendly, reviewScore: p.reviewProScore, rooms,
  };
});

writeFileSync('data/parks.json', JSON.stringify({ source: `${BASE}/api/parks`, syncedAt: new Date().toISOString(), parks: out }, null, 2) + '\n');
for (const p of out) {
  console.log(`${p.name} (${p.hotelId})`);
  for (const r of p.rooms) console.log(`  ${r.roomTypeId} ${r.name}`);
}
