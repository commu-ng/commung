# 커뮹!

커뮹!은 마스토돈 스타일의 새로운 커뮤 플랫폼입니다.

커뮤를 개장하면 간편하게 전용 인스턴스가 준비됩니다. 러너 입장에서는 매번 회원가입할 필요 없이 커뮤별 프로필을 쉽게 만들 수 있습니다.

---

## 🏗️ Architecture

This is a monorepo project managed with pnpm workspaces, consisting of:

- **`api/`** - Hono API server with Drizzle ORM
- **`console/`** - React Router frontend for management console
- **`app/`** - React Router frontend for per-subdomain applications

## 📋 Prerequisites

- **Node.js**: v20 or higher
- **pnpm**: v10.15.0 or higher
- **PostgreSQL**: v14 or higher
- **Caddy**: For local reverse proxy (optional but recommended)

## 🚀 Getting Started

### 1. Install Dependencies

```bash
pnpm install
```

### 2. Environment Variables

Create `.env` files in each workspace directory:

#### `api/.env`

```env
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/commu_ng

# Server
PORT=3000

# Domain
CONSOLE_DOMAIN=localhost:3001

# R2 Storage (Cloudflare R2 or S3-compatible)
R2_ENDPOINT_URL=https://your-account.r2.cloudflarestorage.com
R2_ACCESS_KEY_ID=your_access_key
R2_SECRET_ACCESS_KEY=your_secret_key
R2_BUCKET_NAME=your_bucket_name
R2_PUBLIC_URL=https://your-public-url.com

# Email (Mailgun)
MAILGUN_API_KEY=your_mailgun_api_key
MAILGUN_DOMAIN=mg.yourdomain.com

# Monitoring (optional)
SENTRY_DSN=your_sentry_dsn
```

#### `app/.env`

```env
VITE_CONSOLE_URL=http://localhost:3001
VITE_API_BASE_URL=http://localhost:3000
```

#### `console/.env`

```env
VITE_API_BASE_URL=http://localhost:3000
VITE_DOMAIN=localhost
```

### 3. Database Setup

```bash
# Create database
createdb commu_ng

# Navigate to API directory
cd api

# Generate migration
pnpm db:generate

# Run migration
pnpm db:migrate

# (Optional) Open Drizzle Studio to inspect database
pnpm db:studio
```

### 4. Run Development Servers

```bash
# Run all services in parallel (from root)
pnpm dev

# Or run individually:
cd api && pnpm dev       # API server on :3000
cd console && pnpm dev   # Console on :3001
cd app && pnpm dev       # App on :3002
```

### 5. Using Caddy (Recommended)

The included `Caddyfile` proxies requests to api, console, and app in development:

```bash
caddy run
```

This sets up local domains with proper routing.

## 📁 Project Structure

```
commu-ng/
├── api/                    # Hono API server
│   ├── src/
│   │   ├── config/        # Configuration (env vars)
│   │   ├── drizzle/       # Database schema & relations
│   │   ├── http/          # HTTP route handlers
│   │   ├── middleware/    # Auth, community middleware
│   │   ├── services/      # Business logic
│   │   └── utils/         # Utility functions
│   └── package.json
│
├── console/               # Management console frontend
│   ├── app/
│   │   ├── components/    # React components
│   │   ├── routes/        # React Router routes
│   │   ├── lib/           # Utilities & API client
│   │   └── hooks/         # React hooks
│   └── package.json
│
├── app/                   # Per-subdomain application
│   ├── app/
│   │   ├── components/    # React components
│   │   ├── routes/        # React Router routes
│   │   ├── lib/           # Utilities & API client
│   │   └── hooks/         # React hooks
│   └── package.json
│
├── Caddyfile              # Local development proxy
├── pnpm-workspace.yaml    # Workspace configuration
└── package.json           # Root package.json
```

## 🧪 Testing

```bash
# Run API tests
cd api
pnpm test

# Watch mode
pnpm test:watch
```

## 🔧 Common Commands

```bash
# Type checking (all packages)
pnpm typecheck

# Build (all packages)
pnpm build

# Database migrations
cd api
pnpm db:generate  # Generate migration from schema changes
pnpm db:migrate   # Apply migrations
pnpm db:studio    # Open Drizzle Studio
```

## 🛠️ Tech Stack

### Backend (API)
- **Hono** - Fast web framework
- **Drizzle ORM** - TypeScript ORM
- **PostgreSQL** - Database
- **Zod** - Schema validation
- **Cloudflare R2** - Object storage (S3-compatible)

### Frontend (Console & App)
- **React Router v7** - Full-stack React framework
- **React 19** - UI library
- **TanStack Query** - Server state management
- **Tailwind CSS** - Styling
- **shadcn/ui** - UI components

### DevOps
- **pnpm** - Package manager
- **TypeScript 5.9.3** - Type safety
- **Caddy** - Reverse proxy
- **Sentry** - Error monitoring

## 📝 Adding Routes

### Console/App Routes

Both `console` and `app` use React Router. To add a new route:

1. Create a route file in `app/routes/` or `console/app/routes/`
2. Update `app/routes.ts` with the new route definition

Example:
```typescript
// console/app/routes/my-new-page.tsx
export default function MyNewPage() {
  return <div>My New Page</div>;
}
```

See [CLAUDE.md](./CLAUDE.md) for additional project-specific notes.

## 📄 License

See [LICENSE](./LICENSE) for details.
