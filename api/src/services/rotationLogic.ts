/**
 * Lógica pura do rodízio de café (sem dependência de banco) — fácil de testar.
 *
 * Regra: a cada dia, 2 pessoas fazem café. Ninguém repete até que todos os
 * demais elegíveis já tenham passado. Isso é modelado em "rounds": dentro de
 * um round, cada elegível aparece exatamente uma vez. Quando o número é ímpar,
 * a última pessoa do round faz café sozinha naquele dia.
 */

/** Embaralhamento Fisher-Yates com gerador injetável (determinístico em teste). */
export function shuffle<T>(input: readonly T[], rng: () => number = Math.random): T[] {
  const arr = [...input];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/** Agrupa uma lista ordenada em pares; o último grupo pode ter 1 (dia solo). */
export function chunkIntoPairs<T>(ordered: readonly T[]): T[][] {
  const groups: T[][] = [];
  for (let i = 0; i < ordered.length; i += 2) {
    groups.push(ordered.slice(i, i + 2));
  }
  return groups;
}

/**
 * Planeja um round: recebe os ids elegíveis, embaralha e devolve a sequência
 * de duplas (uma por dia de café). Cada id aparece exatamente uma vez.
 */
export function planRound(eligibleIds: readonly string[], rng: () => number = Math.random): string[][] {
  if (eligibleIds.length === 0) return [];
  return chunkIntoPairs(shuffle(eligibleIds, rng));
}

/**
 * Gerador pseudoaleatório determinístico (mulberry32) — útil quando se quer
 * um round reproduzível a partir de uma semente (ex.: número do round).
 */
export function seededRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
