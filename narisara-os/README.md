# Narisara OS

A calm, Notion-inspired operating system for an artist's practice — built for
Narisara (@pgnarisara), printmaker.

The core idea: deciding *when* to do things is harder than doing them. So you
tell Narisara OS what a good week holds, and every Monday it hands you a week
that's already arranged — one gradient card at a time, Spotify-wrapped style.
If a time truly doesn't work you can ask for another, but you only get three.
Three strikes and the task sits the week out (with a suitably disappointed
animation). The friction is the feature.

## The five tabs

- **This Week** — the main calendar. Weekly "rhythms" (recurring tasks with a
  name, colour and duration) are auto-placed at concrete times, spread across
  the week, deterministic per week. Add new rhythms mid-week and the same
  reveal flow proposes a slot. Mark blocks done, remove them, or stop them
  repeating.
- **Month** — the wider horizon. Add real-world events in natural language
  ("Private view at Bankside next Friday 6pm"). Uses OpenAI (gpt-4o-mini) when
  `VITE_OPENAI_API_KEY` is set, and a capable built-in parser otherwise.
- **Content Studio** — a swipe deck of 48 content ideas personalised to an
  etching/photo-etching practice, bilingual English/Thai. Keep or pass; kept
  ideas become the menu for content-creation blocks.
- **Open Calls** — 28 researched printmaking opportunities (UK, East Asia,
  worldwide) with deadlines, fees, requirements and links, sorted by deadline.
  Firm dates get countdown chips; estimated annual cycles are marked `~`.
- **Growth** — 50 outreach and revenue ideas, bilingual English/Thai, each
  tagged by channel, cost band and effort, with an explicit revenue angle.
  Track them idea → doing → done.

Everything persists in `localStorage`. First launch runs a warm onboarding
that suggests a printmaker's week (planning hour, deep print day, content
session, posting, open-call research, outreach hour) before revealing week one.

## Run it

```bash
npm install
npm run dev        # dev server
npm run build      # type-check + production build
npm run preview    # serve the production build
```

Optional AI parsing: copy `.env.example` to `.env` and add your OpenAI key.

## Stack

Vite · React 18 · TypeScript · framer-motion. No UI framework — the design
system is hand-rolled CSS (native font stack, quiet grays, hairline borders)
in `src/styles/global.css`.
