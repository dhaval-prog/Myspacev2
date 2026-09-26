import { useEffect, useRef, useState } from 'react';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import type { Item } from '../types/space';

export type SearchSection = 'home' | 'expenses';

export interface SearchResult {
  id: string;
  section: SearchSection;
  title: string;
  subtitle: string;
}

interface CardRow {
  id: string;
  label: string;
}

const DEBOUNCE_MS = 300;
const LIMIT = 6;

/** Matches Home's items locally, and searches Expenses' budget cards via Supabase (RLS already scopes results to what the signed-in account can see). */
export function useGlobalSearch(query: string, items: Item[]) {
  const [remote, setRemote] = useState<{ expenses: SearchResult[] }>({ expenses: [] });
  const seqRef = useRef(0);

  useEffect(() => {
    const q = query.trim();
    if (!q || !isSupabaseConfigured) {
      setRemote({ expenses: [] });
      return;
    }

    const mySeq = ++seqRef.current;
    const timer = setTimeout(async () => {
      const cardsRes = await supabase.from('budget_cards').select('id,label').ilike('label', `%${q}%`).limit(LIMIT);
      if (mySeq !== seqRef.current) return; // a newer query superseded this one

      setRemote({
        expenses: ((cardsRes.data as CardRow[] | null) ?? []).map((c) => ({
          id: c.id,
          section: 'expenses',
          title: c.label,
          subtitle: 'Budget card',
        })),
      });
    }, DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [query]);

  const q = query.trim().toLowerCase();
  const home: SearchResult[] = !q
    ? []
    : items
        .filter((it) => it.name.toLowerCase().includes(q))
        .slice(0, LIMIT)
        .map((it, i) => ({
          id: `item-${i}-${it.name}`,
          section: 'home' as const,
          title: it.name,
          subtitle: it.room ? `In ${it.room}` : 'Item',
        }));

  return { home, expenses: remote.expenses };
}
