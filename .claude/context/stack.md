# Tech Stack & Project Structure — StrikersAcademy
_Maintained by Shakespeare. Sources: root/client/server/shared package.json, .env.example, CLAUDE.md_
_Last updated: 2026-04-02_

## Monorepo layout
```
StrikersAcademy/
├── package.json          # npm workspaces root
├── .env.example          # env variable template
├── CLAUDE.md             # project instructions for AI agents
├── client/               # React frontend (@strikers/client)
│   ├── src/
│   │   ├── App.tsx
│   │   ├── main.tsx
│   │   ├── pages/
│   │   ├── components/layout/
│   │   ├── hooks/
│   │   └── services/api.ts
│   └── package.json
├── server/               # Fastify backend (@strikers/server)
│   ├── src/
│   │   ├── index.ts      # entry point
│   │   ├── app.ts        # Fastify instance + plugin registration
│   │   ├── routes/       # route definitions (thin)
│   │   ├── controllers/  # HTTP req/reply handling
│   │   ├── services/     # business logic
│   │   ├── middleware/   # authenticate, errorHandler
│   │   ├── plugins/      # prisma plugin
│   │   ├── utils/        # password.ts, response.ts
│   │   └── types/        # fastify.d.ts (augments FastifyRequest.user)
│   ├── prisma/
│   │   └── schema.prisma
│   └── package.json
└── shared/               # Shared TypeScript types (@strikers/shared)
    ├── src/
    │   ├── index.ts
    │   └── types/        # user, facility, slot, booking, payment, coupon, api
    └── package.json
```

## npm workspace packages
| Package | Name | Role |
|---|---|---|
| `client/` | `@strikers/client` | React Vite frontend |
| `server/` | `@strikers/server` | Fastify API backend |
| `shared/` | `@strikers/shared` | Shared TypeScript types |

## Root npm scripts
| Script | What it does |
|---|---|
| `npm run dev` | Runs server + client concurrently (via `concurrently`) |
| `npm run build` | Builds shared → server → client (in order) |
| `npm run db:generate` | `prisma generate` (in server workspace) |
| `npm run db:migrate` | `prisma migrate dev` (in server workspace) |
| `npm run db:studio` | Opens Prisma Studio |
| `npm run lint` | ESLint on client + server |

## Server scripts (`server/package.json`)
| Script | What it does |
|---|---|
| `dev` | `tsx watch src/index.ts` (hot-reload) |
| `build` | `tsc` |
| `start` | `node dist/index.js` (production) |
| `db:generate` | `prisma generate` |
| `db:migrate` | `prisma migrate dev` |
| `db:migrate:prod` | `prisma migrate deploy` |
| `db:studio` | `prisma studio` |
| `db:seed` | `tsx prisma/seed.ts` |

## Client scripts (`client/package.json`)
| Script | What it does |
|---|---|
| `dev` | `vite` dev server on port 5173 |
| `build` | `tsc && vite build` |
| `preview` | `vite preview` |

---

## Backend stack
| Layer | Technology | Version |
|---|---|---|
| Runtime | Node.js | >=18 |
| Framework | Fastify | ^4.27 |
| ORM | Prisma | ^5.14 |
| Database | SQLite (dev) / PostgreSQL (prod) | — |
| Auth | @fastify/jwt + @fastify/cookie | 8.x / 9.x |
| CORS | @fastify/cors | ^9.0 |
| Payments | razorpay SDK | ^2.9 |
| Validation | zod | ^3.23 |
| Password | Node crypto scrypt (built-in) | — |
| Language | TypeScript | ^5.4 |
| Dev server | tsx | ^4.15 |

## Frontend stack
| Layer | Technology | Version |
|---|---|---|
| Framework | React | ^18.3 |
| Build | Vite | ^5.3 |
| Routing | react-router-dom | ^6.23 |
| HTTP client | axios | ^1.7 |
| Styling | TailwindCSS | ^3.4 |
| Payments | Razorpay JS (CDN) | — |
| Language | TypeScript | ^5.4 |

---

## Environment variables

### Server-side
| Variable | Default / Example | Purpose |
|---|---|---|
| `NODE_ENV` | `development` | Controls logging level, cookie `secure` flag |
| `PORT` | `3000` | Server listen port |
| `HOST` | `0.0.0.0` | Server listen host |
| `DATABASE_URL` | `file:./dev.db` | Prisma connection string |
| `JWT_SECRET` | _(generate with crypto.randomBytes)_ | Signs JWT tokens |
| `JWT_EXPIRES_IN` | `7d` | JWT expiry (informational — actual value: 30d hardcoded in controller) |
| `COOKIE_SECRET` | _(secret string)_ | Signs cookies |
| `CLIENT_URL` | `http://localhost:5173` | CORS allowed origin |
| `SSL_KEY_PATH` | _(empty)_ | Path to TLS private key for direct HTTPS |
| `SSL_CERT_PATH` | _(empty)_ | Path to TLS certificate for direct HTTPS |
| `RAZORPAY_KEY_ID` | `rzp_test_xxx` | Razorpay API key (public) |
| `RAZORPAY_KEY_SECRET` | _(secret)_ | Razorpay API secret |
| `RAZORPAY_WEBHOOK_SECRET` | _(secret)_ | For webhook signature verification |

### Client-side (Vite — must be prefixed `VITE_`)
| Variable | Default | Purpose |
|---|---|---|
| `VITE_API_URL` | `http://localhost:3000` | Backend base URL |
| `VITE_RAZORPAY_KEY_ID` | `rzp_test_xxx` | Razorpay public key for checkout modal |
| `VITE_APP_NAME` | `StrikersAcademy` | App display name |

---

## HTTPS / SSL setup
- Fastify reads `SSL_KEY_PATH` + `SSL_CERT_PATH` at startup
- If both are set and files exist → Fastify runs HTTPS natively
- If empty or files missing → falls back to HTTP (warning logged)
- Recommended production: Cloudflare Full SSL termination (Cloudflare → HTTPS → origin Fastify)
- Alternative: Caddy/Nginx reverse proxy handles TLS; Fastify runs HTTP behind it
- Cookies: `secure: true` when `NODE_ENV === 'production'`

## Vite dev proxy
Vite is configured to proxy `/api/*` → `http://localhost:3000` in development so the frontend doesn't hit CORS issues (see `client/vite.config.ts` if it exists, or set `VITE_API_URL`).

## Constraints
- Budget: <= ₹1000/month infra
- Single academy, single VPS
- Expected: ~200 daily users, ~10 concurrent
- Mobile-first design (customers + admin on phone/tablet)
