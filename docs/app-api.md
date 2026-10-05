# Signing in from a native app

How a native (iOS/Android) client authenticates against a Proviso server. The web app uses a cookie; the app uses a bearer token. Everything else — every route under `/api`, its zod-validated body, its role checks — is the same for both.

## Sign in

Send the normal sign-in request with one extra header:

```http
POST /api/auth/login
Content-Type: application/json
X-Proviso-Client: app
User-Agent: Proviso/1.0 (iPhone; iOS 18.0)

{ "username": "…", "password": "…" }
```

- **Success** → `200 { "ok": true, "token": "<64 hex chars>", "expiresAt": "<ISO date>" }`. No cookie is set.
- **Authenticator code enrolled** → `200 { "requiresTOTP": true, "nonce": "…" }`. Then `POST /api/auth/totp-verify` with the same `X-Proviso-Client: app` header and `{ "nonce", "code", "isRecovery"? }`; success returns the token as above.
- **Wrong details** → `401 { "error" }`. **Locked or rate-limited** → `429 { "error" }` (with `Retry-After` when locked).

Store the token in the platform keychain (iOS Keychain / Android Keystore-backed storage), never in plain preferences.

The `User-Agent` is what Settings → Your devices shows ("Proviso app on iPhone"); include the platform name.

## Use it

```http
GET /api/auth/me
Authorization: Bearer <token>
```

→ `{ "user": { "userId", "name", "username", "role" } }`. Call it at start-up: a `401` means the token has expired or was signed out — show the sign-in screen. `role` is `CFO`, `PARTNER` or `CHILD`; the server enforces what each can do, so the app only needs it to choose which screens to show.

Send the same header on every `/api` request. Writes that fail return `{ "error" }` with a 4xx status.

## Lifetime

- A token stops working after **30 days without use**, and **90 days after sign-in** regardless. Using the app pushes the idle deadline forward (at most once a day).
- It also stops working when the user signs that device out (Settings → Your devices), signs out all other devices, or has their password changed.
- An app token is only accepted as a bearer header, and a browser cookie is only accepted as a cookie.

## Sign out

```http
POST /api/auth/logout
Authorization: Bearer <token>
```

Then delete the stored token.

## Not yet supported

- **Passkeys** from a native app (needs the platform passkey APIs and an associated-domain file on the server).
- **CORS**: the API sends no CORS headers. A native HTTP client doesn't need them; a web view served from a different origin would.
