# CalenStar 2.0 — Setup Guide

## What you're building
A social daily journaling app — log your day with text, photos & videos, share to a public feed, follow friends, earn streaks. Ad-supported free tier.

---

## Prerequisites
- Node.js 18+ → https://nodejs.org (download LTS)
- Git → https://git-scm.com
- A GitHub account
- Your existing Supabase project (vmnivjiwhenxkwssmdbq)
- A Vercel account (vercel.com — free)

---

## Step 1 — Set up the database

1. Go to https://supabase.com/dashboard → your project
2. Click **SQL Editor** in the left sidebar
3. Click **New query**
4. Open `schema.sql` from this project folder, copy ALL the contents, paste into the editor
5. Click **Run** (green button)
6. You should see "Success" — all tables are created

---

## Step 2 — Set up Storage (for photos & videos)

1. In your Supabase dashboard, click **Storage** in the left sidebar
2. Click **New bucket**
3. Name it exactly: `entry-media`
4. Check **Public bucket** ✓
5. Click **Save**
6. Click the bucket → **Policies** tab → **New policy**
7. Choose "For full customization" and paste this:

```sql
-- Allow authenticated users to upload to their own folder
CREATE POLICY "User uploads" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'entry-media' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Allow public read
CREATE POLICY "Public read" ON storage.objects
FOR SELECT USING (bucket_id = 'entry-media');
```

---

## Step 3 — Install dependencies locally

Open Terminal (Mac) or Command Prompt (Windows), then:

```bash
# Navigate to the project folder (adjust path as needed)
cd path/to/calenstar2

# Install all packages
npm install

# Start the dev server
npm run dev
```

Open http://localhost:5173 in your browser — you should see the app!

---

## Step 4 — Push to GitHub

```bash
# Initialize git (if not already)
git init
git add .
git commit -m "CalenStar 2.0 initial commit"

# Create a new repo on github.com, then:
git remote add origin https://github.com/YOUR_USERNAME/calenstar.git
git branch -M main
git push -u origin main
```

---

## Step 5 — Deploy to Vercel

1. Go to https://vercel.com → **Add New Project**
2. Import your GitHub repo
3. Framework: **Vite** (auto-detected)
4. Click **Environment Variables** and add:
   - `VITE_SUPABASE_URL` = `https://vmnivjiwhenxkwssmdbq.supabase.co`
   - `VITE_SUPABASE_ANON_KEY` = `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` (your full anon key)
5. Click **Deploy**

Your app will be live at `https://calenstar.vercel.app` (or similar) in ~60 seconds.

---

## Step 6 — Update Supabase auth settings

1. Supabase dashboard → **Authentication** → **URL Configuration**
2. Set **Site URL** to your Vercel URL (e.g. `https://calenstar.vercel.app`)
3. Add to **Redirect URLs**: `https://calenstar.vercel.app/**`
4. Save

---

## Folder structure

```
calenstar2/
├── src/
│   ├── components/
│   │   ├── AppShell.jsx     ← bottom nav + layout
│   │   ├── EntryCard.jsx    ← social post card (likes, comments)
│   │   ├── AdCard.jsx       ← ad slot (swap for real ad network)
│   │   └── Spinner.jsx
│   ├── hooks/
│   │   └── useAuth.jsx      ← session context
│   ├── lib/
│   │   └── supabase.js      ← Supabase client
│   ├── pages/
│   │   ├── AuthPage.jsx     ← sign up / sign in
│   │   ├── FeedPage.jsx     ← home feed + ad injection
│   │   ├── LogPage.jsx      ← daily entry with media upload
│   │   ├── DiscoverPage.jsx ← explore public posts
│   │   ├── NotificationsPage.jsx
│   │   └── ProfilePage.jsx  ← profile grid + follow
│   ├── App.jsx
│   ├── main.jsx
│   └── index.css            ← design tokens + global styles
├── schema.sql               ← run this in Supabase SQL editor
├── .env                     ← your keys (never commit this)
├── vercel.json
└── package.json
```

---

## Replacing ads with a real ad network

The `AdCard.jsx` component is a placeholder. To run real ads:

**Google AdSense (easiest):**
1. Apply at https://adsense.google.com
2. Get approved (takes a few days)
3. Replace `<AdCard />` with their script-injected ad unit

**Meta Audience Network:**
- Requires native app (iOS/Android) — better for App Store version

---

## What's next
- Add real-time comments with Supabase Realtime
- Push notifications via Web Push API
- App Store version with Expo/React Native (Phase 3)
