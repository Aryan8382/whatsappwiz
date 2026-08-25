# The Messenger API — Integration Notes

## What I found
Your codebase already had a `MessengerService` (`backend/src/messages/messenger.service.ts`) wired up for **The Messenger API**, and your `.env` already contains the token you gave me:

```
MESSENGER_API_BASE_URL="https://live.themessenger.app/api"
MESSENGER_API_KEY="218|Wzs5iqDXWxd9ew1vPgh66N0bghbTGRBjYHBbHm3Eb34eccd6"
MESSENGER_WABA_ID="YOUR_WABA_ID"   <-- still a placeholder, see below
```

It already covered: send text/image/video/document/template, get templates, get conversations, media handle upload, get media, and webhook get/register/delete.

## What was missing (now added)
Every remaining endpoint from your Postman collection is now implemented in `MessengerService` and exposed via a new controller `MessengerController` at `/api/v1/messages/messenger/*` (JWT‑protected, same as the rest of your API):

| Postman group | Method / Route |
|---|---|
| User list | `GET /messages/messenger/users` |
| User create | `POST /messages/messenger/users` |
| Get conversations | `GET /messages/messenger/conversations?phone_number=` (already existed) |
| Get profile | `GET /messages/messenger/profile?fields=` |
| Get profile (alt `/user`) | `GET /messages/messenger/profile/user` |
| Update profile | `POST /messages/messenger/profile` |
| Phone number details | `GET /messages/messenger/phone-number-details?fields=` |
| Get template (single) | `GET /messages/messenger/templates/single?template_name=` |
| Get templates | `GET /messages/messenger/templates?limit=` (already existed) |
| Read receipts | `POST /messages/messenger/read-receipts` |
| Reply buttons | `POST /messages/messenger/send/reply-buttons` |
| CTA URL button | `POST /messages/messenger/send/cta-url` |
| List message | `POST /messages/messenger/send/list` |
| Address message | `POST /messages/messenger/send/address` |
| Location message | `POST /messages/messenger/send/location` |
| Flow message | `POST /messages/messenger/send/flow` |
| Audio message | `POST /messages/messenger/send/audio` |
| Reply to a message (context) | `POST /messages/messenger/send/reply` |
| Carousel template | `POST /messages/messenger/send/template/carousel` |
| Coupon code template | `POST /messages/messenger/send/template/coupon` |
| Flows template (button) | `POST /messages/messenger/send/template/flow` |
| Webhook get/set/delete | `GET/POST/DELETE /messages/messenger/webhook` (already existed) |
| Media get | `GET /messages/messenger/media?mediaId=` (already existed) |
| Token status check | `GET /messages/messenger/status` |

All the simple text/image/video/document/basic-template sends you already had continue to work unchanged — I only **added** methods, nothing was removed.

## Files changed
- `backend/src/messages/messenger.service.ts` — added ~20 new methods for the endpoints above.
- `backend/src/messages/messenger.controller.ts` — **new file**, thin REST wrapper over those methods.
- `backend/src/messages/dto/messenger-api.dto.ts` — **new file**, request validation DTOs.
- `backend/src/messages/messages.module.ts` — registered the new controller.
- `backend/src/messages/messages.service.ts` — fixed a pre-existing bug: `sendTemplate()` referenced a `cost` variable that was never declared, which would have thrown on every template send.

## How to apply
Unzip `messenger-api-integration-update.zip` at the root of your project (next to your existing `waba-work-updated/` folder) and let it overwrite the 5 files listed above — the folder structure matches your project exactly.

Then, from `backend/`:
```bash
npm run build   # or npm run start:dev
```
No new npm packages are required (uses the native `fetch`/`FormData` already used elsewhere in the file).

## One thing you still need to fix
`MESSENGER_WABA_ID` in `backend/.env` is still the literal placeholder `"YOUR_WABA_ID"`. The service silently skips sending the `x-waba-id` header while it's a placeholder. Set it to your real WABA ID from The Messenger dashboard, or things like profile/phone-number lookups may return the wrong account's data.

## Quick test
Once the server is running:
```bash
curl -H "Authorization: Bearer <your platform JWT>" http://localhost:4000/api/v1/messages/messenger/status
```
This calls `GET /get_templates?limit=1` against the live Messenger API using your token and tells you if it's valid.
