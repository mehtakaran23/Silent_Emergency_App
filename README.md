"# Silent Emergency App" 

## Running locally

1. Start MongoDB and set `MONGO_URI` and a strong `JWT_SECRET` in `server/.env`.
2. Run the API with `cd server && npm run dev`.
3. Run the client with `cd client && npm run dev`.

Set `CLIENT_URL` to the client origin. To deliver emergency email notifications,
also configure `RESEND_API_KEY`, `RESEND_TEST_RECIPIENT`, and `EMAIL_FROM`
(use `onboarding@resend.dev` while testing). Initial Resend test mode sends
only to `RESEND_TEST_RECIPIENT`; use a verified sending domain and remove that
test restriction before sending to emergency contacts in production. Optionally
set a separate `CONTACT_RESPONSE_SECRET` for response
links (otherwise `JWT_SECRET` is used). Each successful notification contains a signed, expiring response
link (`/respond/:token`) that lets the recipient acknowledge the alert without
creating an account. Acknowledgements and live GPS updates are broadcast to the
authenticated alert owner over Socket.IO.

When Resend is not configured, email attempts are recorded as `FAILED`; the
application never reports undelivered email as successful.

## API areas

- `/api/auth` — registration, login, and the authenticated current-user endpoint
- `/api/profile` — read/update the current profile
- `/api/contacts` — authenticated emergency contact CRUD (maximum five)
- `/api/sos` — start, resolve/cancel, active/history, and secure contact response
- `/api/location` — authenticated GPS updates and alert location history
- `/api/notifications` — delivery/acknowledgement logs for the current user"
