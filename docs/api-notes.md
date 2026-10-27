# Top10 API notes (verified 2026-10-19)

Everything is same-origin JSON on https://top10.co.nz, no NetRoomz proxying, no special headers.

## Auth (pure HTTP, no browser)
1. `GET /` -> keep Set-Cookie (`.AspNetCore.Antiforgery.*`), scrape from form `#header-login`: `__RequestVerificationToken`, `ufprt`.
2. `POST /` multipart: `SubmittedFormId=header-login, RedirectLinkUrl=, Username, Password, __RequestVerificationToken, ufprt` (+ cookies, origin/referer). Returns 302 and sets `Top10.Identity` cookie.
3. Send the cookie header on API calls. No cookie = public price.

## Endpoints
- `GET /api/parks` - parks, hotelId, rooms (roomTypeId), url.
- `GET /api/parks/options` - filter options.
- `GET /api/hotels/{hotelId}/rooms/{roomId}/pricing/{YYYY-MM-DD}/{YYYY-MM-DD}?adults=2&children=0&infants=0&promoCode=&explain=true`
  -> `offers[0].totalAmount, yourDiscountAmount, dailyBreakdown[{date,amount}], bookingDetail.isMember, infoPanel.{minimumNightsRequired,sameDayArrival}`. `offers:null` + `messages` when unavailable.
- `GET /api/hotels/{hotelId}/rooms/{roomId}/availability/{YYYY-MM}/{YYYY-MM}` -> per-day `status` (0 unavailable, 1 check-out only, 4 available).

## Findings
- Member discount = exactly 10% on 1-night stays (hotel 3008: 169 -> 152.10). A 3-night stay showed only $40 off $552 (7%): unexplained, investigate (some nightly rates may be non-discountable).
- Snapshot for hotel 3008, 1 night: today and tomorrow cost the same (169 / 182); +7d 173 / 185; +14d 206 / 218. No last-minute drop visible in one snapshot; needs time-series polling to test the hypothesis.

## Next (phase 2)
Poll chosen parks/rooms/dates on a schedule (a few requests per sec max), store `dailyBreakdown` with fetch time in SQLite, flag when price for a target night drops vs earlier observations. Keep `.env` out of git; responses contain memberEmail.
