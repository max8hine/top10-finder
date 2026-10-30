# Top10 API notes (verified 2026-10-31)

Everything is same-origin JSON on https://top10.co.nz, no special headers.

## Auth (pure HTTP, no browser)
1. `GET /` -> keep Set-Cookie (`.AspNetCore.Antiforgery.*`), scrape from form `#header-login`: `__RequestVerificationToken`, `ufprt`.
2. `POST /` multipart: `SubmittedFormId=header-login, RedirectLinkUrl=, Username, Password, __RequestVerificationToken, ufprt` (+ cookies, origin/referer). Returns 302 and sets `Top10.Identity` cookie.
3. Send the cookie header on API calls. Without it, the price shown is the public (non-member) price, which this project doesn't use.

## Endpoints
- `GET /api/parks` - parks, hotelId, rooms (roomTypeId), url.
- `GET /api/hotels/{hotelId}/rooms/{roomId}/availability/{YYYY-MM}/{YYYY-MM}` -> `days[{date, status}]`, status 0 unavailable, 1 check-out only, 4 available.
  - Quirk: the range is whole months from the 1st of the first month up to the 1st of the last month. Same-month ranges return only the 1st. Request one month past the last date you need, then filter.
- `GET /api/hotels/{hotelId}/rooms/{roomId}/pricing/{YYYY-MM-DD}/{YYYY-MM-DD}?adults=2&children=0&infants=0&promoCode=&explain=true`
  -> `offers[0].totalAmount` (member total for the stay). `offers` is null plus `messages` when the stay can't be booked.
</content>
