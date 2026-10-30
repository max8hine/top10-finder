import { poll, deals, leadProfile, history, loadConfig, syncCatalog, type Change, type Deal } from '@top10/core';

const fmtChange = (c: Change) =>
  c.kind === 'available'
    ? `★ ${c.label} ${c.stayDate} (${c.nights}n): became available at $${c.to}`
    : `↓ ${c.label} ${c.stayDate} (${c.nights}n): $${c.from} → $${c.to}`;

const fmtDeal = (d: Deal) => {
  const was = d.previousPrice !== null && d.previousPrice !== d.price ? `  (was $${d.previousPrice})` : '';
  const lowest = d.isLowest ? '  ★ lowest seen' : '';
  return `${d.stayDate}  ${d.nights}n  $${d.price}  ${d.label}${was}${lowest}`;
};

const USAGE = [
  'usage:',
  '  sync                       fetch park/room names and images for config.json',
  '  poll                       price every tracked stay and record it',
  '  deals [fromDay] [toDay]    bookable now (default 0 7 = tonight to next week)',
  '  lead                       average price by days before check-in',
  '  history <roomId> <YYYY-MM-DD>',
].join('\n');

const [cmd, ...args] = process.argv.slice(2);

switch (cmd) {
  case 'sync': {
    const c = await syncCatalog();
    for (const p of c.parks) console.log(`${p.name} (${p.hotelId}): ${p.rooms.map((r) => r.name).join(', ')}`);
    break;
  }
  case 'poll': {
    const r = await poll(loadConfig());
    console.log(`checked ${r.stays} stays with ${r.requests} requests`);
    console.log(r.changes.map(fmtChange).join('\n') || 'no changes since last poll');
    break;
  }
  case 'deals': {
    const [fromDay = 0, toDay = loadConfig().horizonDays] = args.map(Number);
    const list = deals({ fromDay, toDay });
    console.log(list.length ? list.map(fmtDeal).join('\n') : 'nothing bookable in that window');
    break;
  }
  case 'lead': {
    const points = leadProfile();
    if (!points.length) console.log('not enough history yet; run poll a few times');
    for (const p of points) {
      const above = ((p.avgRatio - 1) * 100).toFixed(1);
      console.log(`${String(p.daysBefore).padStart(3)} days before  +${above}% vs cheapest  (${p.samples} samples)`);
    }
    break;
  }
  case 'history': {
    const [roomId, stayDate] = args;
    if (!roomId || !stayDate) {
      console.log(USAGE);
      break;
    }
    const rows = history(Number(roomId), stayDate);
    if (!rows.length) console.log('no observations');
    for (const r of rows) {
      console.log(`${r.fetched_at}  ${r.available ? `$${r.price}` : r.note}`);
    }
    break;
  }
  default:
    console.log(USAGE);
}
