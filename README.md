# StrikersAcademy

Cricket academy slot booking platform for nets and turf wicket sessions in Chennai.

## Tech Stack

- **Frontend:** React 18 + Vite + TypeScript + TailwindCSS
- **Backend:** Fastify + TypeScript
- **Database:** SQLite via Prisma ORM
- **Payments:** Razorpay (UPI)

## Prerequisites

- Node.js >= 18
- npm >= 9

## Setup

```bash
# 1. Clone and install dependencies
git clone <repo-url>
cd StrikersAcademy
npm install

# 2. Configure environment
cp .env.example .env
# Edit .env with your values

# 3. Set up the database
npm run db:generate
npm run db:migrate

# 4. Start development servers (runs both client and server)
npm run dev
```

The client runs on http://localhost:5173
The server runs on http://localhost:3000

## Project Structure

```
StrikersAcademy/
├── client/          # React + Vite frontend
├── server/          # Fastify backend
│   └── prisma/      # Database schema and migrations
└── shared/          # Shared TypeScript types
```

## Database

```bash
npm run db:generate   # Regenerate Prisma client after schema changes
npm run db:migrate    # Run migrations (creates DB if not exists)
npm run db:studio     # Open Prisma Studio (visual DB browser)
```

## Deployment

Target: Hetzner VPS (Germany) with Nginx reverse proxy.
- Build: `npm run build`
- Serve client dist via Nginx static
- Run server with PM2

## Roles

- `CUSTOMER` — Books slots, views history, makes payments
- `ADMIN` — Manages facilities, slots, bookings, view reports
