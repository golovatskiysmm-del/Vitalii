# Instagram Carousel Studio

AI-powered tool to analyze Instagram carousels and generate unique content for auto-posting.

## Features

- **Analyze** any public Instagram carousel post (images, videos, captions)
- **Generate** unique carousel with AI text (Claude) + AI images (DALL-E 3)
- **Avatar** — automatically overlay your photo on all generated images
- **Approve & Post** — review, edit, then post immediately or schedule
- **Auto-scheduling** — schedule posts for specific times

## Tech Stack

- **Next.js 14** (App Router)
- **Claude claude-sonnet-4-6** — content analysis & generation
- **DALL-E 3** — unique image generation
- **Instagram Graph API** — publishing
- **Prisma** + **Vercel Postgres** (or SQLite for local)
- **Vercel Blob** — image storage

---

## Local Development

### 1. Install dependencies

```bash
npm install
```

### 2. Set up SQLite for local dev

```bash
cp prisma/schema.sqlite.prisma prisma/schema.prisma
```

### 3. Configure environment

```bash
cp .env.example .env
```

Edit `.env`:
```env
DATABASE_URL="file:./dev.db"
ANTHROPIC_API_KEY="sk-ant-your-key"
OPENAI_API_KEY="sk-your-key"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

### 4. Initialize database

```bash
npm run db:push
```

### 5. Run the app

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## Deploy to Vercel

### 1. Push to GitHub

```bash
git add . && git commit -m "Initial commit" && git push
```

### 2. Import to Vercel

Go to [vercel.com](https://vercel.com) → New Project → Import from GitHub

### 3. Add Storage

In your Vercel project:
- **Storage** → Add **Postgres** (auto-sets `DATABASE_URL` and `DIRECT_URL`)
- **Storage** → Add **Blob** (auto-sets `BLOB_READ_WRITE_TOKEN`)

### 4. Set Environment Variables

In Vercel dashboard → Settings → Environment Variables:

| Variable | Value |
|----------|-------|
| `ANTHROPIC_API_KEY` | Your Claude API key |
| `OPENAI_API_KEY` | Your OpenAI API key |
| `NEXT_PUBLIC_APP_URL` | `https://your-app.vercel.app` |

### 5. Run database migration

After first deploy, run in Vercel dashboard → Functions → or via CLI:
```bash
npx vercel env pull .env.local
npx prisma migrate deploy
```

### 6. Cron job (auto-scheduling)

`vercel.json` already configures a cron job running every 5 minutes to process scheduled posts.

---

## Instagram Graph API Setup

1. Go to [developers.facebook.com](https://developers.facebook.com) → Create App → Business
2. Add **Instagram Graph API** product
3. Connect your **Instagram Business/Creator** account via a Facebook Page
4. Required permissions: `instagram_basic`, `instagram_content_publish`, `pages_read_engagement`
5. Generate a **long-lived access token** (valid 60 days)
6. Find your **Instagram Business Account ID** via Graph API Explorer
7. Enter credentials in the app's **Settings** page

---

## Workflow

```
1. Paste Instagram URL → Analyze
2. Set generation options (niche, tone, brand)
3. AI generates unique slides + images
4. Preview carousel, edit caption if needed
5. Approve → Post Now or Schedule
```
