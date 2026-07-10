import type { CalEvent } from './types'
import { uid } from './types'
import { toISO } from './dates'
import { parseNaturalEvent, parsedToEvent } from './nlparse'

// ── AI event parsing ───────────────────────────────────────────────
// If VITE_OPENAI_API_KEY is set, natural-language event entry is parsed
// by a cheap OpenAI model. Otherwise we fall back to the built-in
// parser in nlparse.ts, which covers common phrasings offline.

const API_KEY: string = (import.meta.env.VITE_OPENAI_API_KEY as string | undefined) ?? ''

export const aiAvailable = () => API_KEY.length > 0

export async function parseEventWithAI(input: string): Promise<CalEvent | null> {
  if (!aiAvailable()) {
    const p = parseNaturalEvent(input)
    return p ? parsedToEvent(p) : null
  }
  try {
    const today = toISO(new Date())
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${API_KEY}` },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        temperature: 0,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content:
              `You convert one natural-language calendar note into JSON. Today is ${today} (week starts Monday). ` +
              'Reply with {"title": string, "date": "YYYY-MM-DD", "start": number|null, "duration": number|null} ' +
              'where start is minutes from midnight and duration is minutes. The note may be in English or Thai. ' +
              'If no time is given, start is null. If you cannot find a date, use the most plausible upcoming date.',
          },
          { role: 'user', content: input },
        ],
      }),
    })
    if (!res.ok) throw new Error(`OpenAI ${res.status}`)
    const data = await res.json()
    const parsed = JSON.parse(data.choices[0].message.content)
    if (!parsed?.date) throw new Error('no date')
    return {
      id: uid(),
      title: String(parsed.title || 'Event'),
      date: String(parsed.date),
      start: typeof parsed.start === 'number' ? parsed.start : undefined,
      duration: typeof parsed.duration === 'number' ? parsed.duration : undefined,
      color: 'indigo',
      source: 'ai',
    }
  } catch {
    const p = parseNaturalEvent(input)
    return p ? parsedToEvent(p) : null
  }
}
