/**
 * agentFind — a table, a dish, a client or a waiter named the way a person
 * says it (doc 149). The orb plans a spoken sentence in ONE model call and
 * never reads MnemoResto first, so « montre la table 4 » reaches an action
 * with the words « la table 4 », never an id. An id still works (other agents
 * read `tables`, `menu` and `clients` first).
 *
 * 🚨 Several matches are REFUSED with their names (AMBIGUOUS), never the first
 *    one taken: the refusal is what the orb's second planner call reads to
 *    pick the right one. No match is refused with the names that exist.
 *
 * Copied from Vitrine Studio's data/agentFind (cartridges never import each
 * other), with the restaurant's filler words and spoken numbers.
 */

/** Lower case, accents off, œ/æ spelled out. */
export function fold(s: string): string {
  return s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/œ/g, 'oe').replace(/æ/g, 'ae');
}

/**
 * Words that carry no name: articles and the words a sentence wraps a name in.
 * 🪤 Matched BEFORE the accents come off: folded, « thé » is « the ».
 */
const FILLER = new Set([
  'le', 'la', 'les', 'l', 'un', 'une', 'des', 'de', 'du', 'd', 'mon', 'ma', 'mes', 'son', 'sa', 'ses', 'ce', 'cette', 'ces', 'et', 'en', 'au', 'aux', 'à',
  'the', 'a', 'an', 'of', 'my', 'and', 'el', 'los', 'las', 'del', 'mi', 'y',
  'table', 'tables', 'mesa', 'mesas', 'numéro', 'numero', 'number', 'n°', 'no',
  'plat', 'plats', 'dish', 'dishes', 'plato', 'platos', 'recette', 'recettes', 'recipe', 'recipes', 'receta',
  'client', 'clients', 'cliente', 'clientes', 'serveur', 'serveuse', 'server', 'waiter', 'waitress', 'camarero', 'camarera',
]);

/** Words that introduce a number: after them « une » is 1, not an article (« la table une »). */
const NUMBER_CUE = new Set(['table', 'tables', 'mesa', 'numéro', 'numero', 'number', 'n°', 'no']);

/** Spoken numbers up to twenty, FR / EN / ES. The article-like ones only count after a cue. */
const NUMBERS: Record<string, number> = {
  deux: 2, trois: 3, quatre: 4, cinq: 5, six: 6, sept: 7, huit: 8, neuf: 9, dix: 10, onze: 11, douze: 12, treize: 13, quatorze: 14, quinze: 15, seize: 16, 'dix-sept': 17, 'dix-huit': 18, 'dix-neuf': 19, vingt: 20,
  two: 2, three: 3, four: 4, five: 5, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20,
  dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10, once: 11, doce: 12, trece: 13, catorce: 14, quince: 15, dieciséis: 16, diecisiete: 17, dieciocho: 18, diecinueve: 19, veinte: 20,
};
const ARTICLE_NUMBERS: Record<string, number> = { un: 1, une: 1, one: 1, uno: 1, una: 1 };

/** The words of a name, folded, fillers out, spoken numbers as digits, a plural « s »/« x » off. */
export function nameWords(s: string): string[] {
  const raw = s.normalize('NFC').toLowerCase().split(/[^\p{L}\p{N}°-]+/u).flatMap((w) => (NUMBERS[w] ? [w] : w.split('-'))).filter(Boolean);
  const out: string[] = [];
  raw.forEach((w, i) => {
    const cued = i > 0 && NUMBER_CUE.has(raw[i - 1]!);
    const n = NUMBERS[w] ?? (cued ? ARTICLE_NUMBERS[w] : undefined);
    if (n !== undefined) { out.push(String(n)); return; }
    if (FILLER.has(w)) return;
    const f = fold(w);
    out.push(f.length > 3 ? f.replace(/[sx]$/, '') : f);
  });
  return out;
}

export interface Named<T> { item: T; id: string; names: string[]; label: string }

const LIST_MAX = 12;
const listed = (labels: string[]) => {
  const unique = [...new Set(labels)];
  return unique.length > LIST_MAX ? `${unique.slice(0, LIST_MAX).join(', ')} (+${unique.length - LIST_MAX})` : unique.join(', ');
};

/**
 * Labels that tell same-named things apart: a name worn by one thing is its
 * label; a name worn by several gets its `hint` (a phone, else the id). The
 * label is also one of the entry's names, so the orb's repair call can say
 * « Ana (06 12 34) » back and land on that one.
 */
export function named<T>(items: readonly T[], id: (t: T) => string, name: (t: T) => string, hint: (t: T) => string = id): Array<Named<T>> {
  const count = new Map<string, number>();
  for (const t of items) count.set(fold(name(t)), (count.get(fold(name(t))) ?? 0) + 1);
  return items.map((t) => {
    const label = (count.get(fold(name(t))) ?? 0) > 1 ? `${name(t)} (${hint(t) || id(t)})` : name(t);
    return { item: t, id: id(t), names: label === name(t) ? [name(t)] : [name(t), label], label };
  });
}

/** What `ref` names, without refusing: one item, several, or none. */
export function matchNamed<T>(entries: ReadonlyArray<Named<T>>, ref: string): { one: T } | { several: Array<Named<T>> } | { none: true } {
  const raw = ref.trim();
  const byId = entries.find((e) => e.id === raw);
  if (byId) return { one: byId.item };
  const asked = nameWords(raw);
  if (!asked.length) return { none: true };
  // The whole name said as written wins over a partial match (« Table 1 » against « Table 1 » and « Table 10 »).
  const whole = entries.filter((e) => e.names.some((n) => nameWords(n).join(' ') === asked.join(' ')));
  if (whole.length === 1) return { one: whole[0]!.item };
  const hits = entries.filter((e) => {
    const have = new Set(e.names.flatMap(nameWords));
    return asked.every((w) => have.has(w));
  });
  if (hits.length === 1) return { one: hits[0]!.item };
  if (hits.length > 1) return { several: hits };
  return { none: true };
}

/**
 * The one item `ref` names: its id; else the item whose words hold every word
 * of `ref`. `kind` names the error (NO_TABLE, NO_DISH…) and the noun said.
 */
export function findNamed<T>(entries: ReadonlyArray<Named<T>>, ref: string, kind: { code: string; noun: string; plural?: string }): T {
  const nouns = kind.plural ?? `${kind.noun}s`;
  const raw = ref.trim();
  if (!raw) throw new Error(`BAD_ARG: name the ${kind.noun}`);
  const all = entries.map((e) => e.label);
  const m = matchNamed(entries, raw);
  if ('one' in m) return m.one;
  if ('several' in m) throw new Error(`AMBIGUOUS: "${raw}" names several ${nouns}: ${listed(m.several.map((e) => e.label))}; say which`);
  if (!nameWords(raw).length) throw new Error(`${kind.code}: "${raw}" names no ${kind.noun}; ${nouns}: ${listed(all) || 'none'}`);
  throw new Error(`${kind.code}: no ${kind.noun} named "${raw}"; ${nouns}: ${listed(all) || 'none'}`);
}
