# CashBook — Personal Money Manager

Mobile-friendly petty cash tracker. React + Supabase + Vite.

---

## Quickstart (3 steps)

### 1. Supabase setup
1. Go to https://supabase.com → create free account → New Project
2. Go to SQL Editor → New Query → paste contents of `schema.sql` → Run
3. Go to Settings → API → copy your Project URL and anon key

### 2. Configure
```bash
cp .env.example .env
# Open .env and fill in your Supabase URL and anon key
```

### 3. Run
```bash
npm install
npm run dev
# Open http://localhost:5173
```

Sign up with your email → you're in. Default categories are auto-created.

---

## Deploy to Vercel (free)

```bash
npm install -g vercel
vercel
# Follow prompts, add env vars when asked
```

Or connect GitHub repo at vercel.com → import → add env vars → deploy.

---

## Project structure

```
cashbook/
├── src/
│   ├── main.jsx        # React entry point
│   ├── App.jsx         # Entire app (all screens)
│   └── supabase.js     # Supabase client
├── index.html
├── vite.config.js
├── package.json
├── schema.sql          # Run this in Supabase SQL editor
├── .env.example        # Copy to .env and fill in keys
└── .env                # Your secret keys (never commit)
```

---

## Tips

- **Email confirmation**: Supabase → Authentication → Providers → Email → turn off "Confirm email" for easier dev
- **Phone home screen**: Open app URL in mobile browser → Share → Add to Home Screen
- **Dark mode**: Click the moon icon top right
