import { poll, deals, syncCatalog, type Deal } from '@top10/core';

const fmtDeal = (d: Deal) =>
  `${d.stayDate}  ${d.nights}n  $${d.price.toFixed(2)}/night  ($${d.total} total)  ${d.label}`;

const USAGE = [
  'usage:',
  '  sync                       fetch park/room names and images for config.json',
  '  poll                       price every tracked room and save the result',
  '  deals [fromDay] [toDay]    bookable as of the last poll, cheapest per night first',
  '                             (days from today; default: today through the horizon)',
].join('\n');

const [cmd, ...args] = process.argv.slice(2);

switch (cmd) {
  case 'sync': {
    const c = await syncCatalog();
    for (const p of c.parks) console.log(`${p.name} (${p.hotelId}): ${p.rooms.map((r) => r.name).join(', ')}`);
    break;
  }
  case 'poll': {
    const r = await poll();
    console.log(`found ${r.stays} bookable stays with ${r.requests} requests`);
    break;
  }
  case 'deals': {
    const [fromDay, toDay] = args.map(Number);
    const { fetchedAt, deals: list } = deals({ fromDay, toDay });
    console.log(`prices from ${new Date(fetchedAt).toLocaleString()}`);
    console.log(list.length ? list.map(fmtDeal).join('\n') : 'nothing bookable in that window');
    break;
  }
  default:
    console.log(USAGE);
}
