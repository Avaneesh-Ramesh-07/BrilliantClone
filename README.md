# AlgebraPath

Learn algebra by solving equations hands-on.

## Setup

1. Copy `.env.example` to `.env.local` and add your Supabase credentials:
   ```
   NEXT_PUBLIC_SUPABASE_URL=your-project-url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
   ```

2. Run the SQL migration in `supabase/migrations/001_initial_schema.sql` in your Supabase SQL editor.

3. Install dependencies and start the dev server:
   ```
   npm install
   npm run dev
   ```

4. Open [http://localhost:3000](http://localhost:3000)

## Deploy (Vercel)

- Connect the repo to Vercel
- Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` in project settings
- Add your production URL to Supabase Auth redirect URLs
