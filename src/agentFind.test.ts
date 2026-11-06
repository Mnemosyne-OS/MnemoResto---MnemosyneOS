/**
 * A table, a dish or a client named the way a person says it (doc 149).
 *
 * MnemoResto installs no vitest yet: run with a sibling's, from this folder:
 *   ../mnemo-ember/node_modules/.bin/vitest run --root . --dir src
 */
import { describe, expect, it } from 'vitest';
import { findNamed, matchNamed, named, nameWords, type Named } from './agentFind';

const entry = (id: string, name: string): Named<string> => ({ item: id, id, names: [name], label: name });
const TABLES = [entry('t1', 'Table 1'), entry('t4', 'Table 4'), entry('t10', 'Table 10'), entry('tt', 'Terrasse')];
const DISHES = [entry('m1', 'Tiramisu'), entry('m2', 'Soupe à l\'oignon'), entry('m3', 'Soupe de poisson'), entry('m4', 'Bœuf bourguignon')];
const table = { code: 'NO_TABLE', noun: 'table' };
const dish = { code: 'NO_DISH', noun: 'dish', plural: 'dishes' };

describe('a name said the way a person says it', () => {
  it('folds case, accents, fillers and a plural', () => {
    expect(nameWords('la Soupe à l\'OIGNON')).toEqual(['soupe', 'oignon']);
    expect(nameWords('le bœuf')).toEqual(['boeuf']);
    expect(nameWords('les tiramisus')).toEqual(['tiramisu']);
  });

  it('spoken numbers become digits, « une » only after « table »', () => {
    expect(nameWords('la table quatre')).toEqual(['4']);
    expect(nameWords('table une')).toEqual(['1']);
    expect(nameWords('mesa dos')).toEqual(['2']);
    expect(nameWords('une soupe')).toEqual(['soupe']);
  });

  it('an id, the whole name, or every word of it', () => {
    expect(findNamed(TABLES, 't4', table)).toBe('t4');
    expect(findNamed(TABLES, 'la table 4', table)).toBe('t4');
    expect(findNamed(TABLES, 'table quatre', table)).toBe('t4');
    // « Table 1 » is a whole name: it is never taken for Table 10.
    expect(findNamed(TABLES, 'la table une', table)).toBe('t1');
    expect(findNamed(TABLES, 'table dix', table)).toBe('t10');
    expect(findNamed(TABLES, 'la terrasse', table)).toBe('tt');
    expect(findNamed(DISHES, 'la soupe à l\'oignon', dish)).toBe('m2');
    expect(findNamed(DISHES, 'le boeuf', dish)).toBe('m4');
  });

  it('several matches are refused with their names, never the first taken', () => {
    expect(() => findNamed(DISHES, 'la soupe', dish)).toThrow('AMBIGUOUS: "la soupe" names several dishes: Soupe à l\'oignon, Soupe de poisson; say which');
    expect(matchNamed(DISHES, 'soupe')).toMatchObject({ several: [{ id: 'm2' }, { id: 'm3' }] });
  });

  it('no match is refused with the names that exist', () => {
    expect(() => findNamed(TABLES, 'table 7', table)).toThrow('NO_TABLE: no table named "table 7"; tables: Table 1, Table 4, Table 10, Terrasse');
    expect(() => findNamed(TABLES, '', table)).toThrow(/^BAD_ARG/);
    expect(() => findNamed(TABLES, 'la', table)).toThrow(/^NO_TABLE: "la" names no table/);
    expect(() => findNamed([], 'table 1', table)).toThrow('tables: none');
  });

  it('two things with one name get labels that tell them apart, and the label finds one', () => {
    const people = named([{ id: 'c2', name: 'Ana', phone: '0611' }, { id: 'c3', name: 'Ana', phone: '' }, { id: 'c4', name: 'Zoé', phone: '' }], (c) => c.id, (c) => c.name, (c) => c.phone);
    expect(people.map((p) => p.label)).toEqual(['Ana (0611)', 'Ana (c3)', 'Zoé']);
    const kind = { code: 'NO_CLIENT', noun: 'client' };
    expect(() => findNamed(people, 'Ana', kind)).toThrow('AMBIGUOUS: "Ana" names several clients: Ana (0611), Ana (c3); say which');
    expect(findNamed(people, 'Ana (c3)', kind).id).toBe('c3');
    expect(findNamed(people, 'Ana (0611)', kind).id).toBe('c2');
  });

  it('a long list is cut at twelve names and says how many more', () => {
    const many = Array.from({ length: 15 }, (_, i) => entry(`t${i}`, `Salon ${i}`));
    expect(() => findNamed(many, 'cuisine', table)).toThrow(/Salon 11 \(\+3\)$/);
  });
});
