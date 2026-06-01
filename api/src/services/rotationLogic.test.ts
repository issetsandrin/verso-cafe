import { describe, expect, it } from "vitest";
import { chunkIntoPairs, planRound, seededRng, shuffle } from "./rotationLogic.js";
import { dateFromYmd, nextCoffeeDates, toYmd } from "../lib/dates.js";

describe("chunkIntoPairs", () => {
  it("agrupa lista par em duplas", () => {
    expect(chunkIntoPairs(["a", "b", "c", "d"])).toEqual([
      ["a", "b"],
      ["c", "d"],
    ]);
  });

  it("deixa o último sozinho quando ímpar", () => {
    expect(chunkIntoPairs(["a", "b", "c"])).toEqual([["a", "b"], ["c"]]);
  });

  it("lista vazia vira nenhum grupo", () => {
    expect(chunkIntoPairs([])).toEqual([]);
  });
});

describe("shuffle", () => {
  it("preserva todos os elementos (é uma permutação)", () => {
    const input = ["a", "b", "c", "d", "e"];
    const out = shuffle(input, seededRng(42));
    expect([...out].sort()).toEqual([...input].sort());
    expect(out).toHaveLength(input.length);
  });

  it("é determinístico com a mesma semente", () => {
    expect(shuffle(["a", "b", "c", "d"], seededRng(7))).toEqual(
      shuffle(["a", "b", "c", "d"], seededRng(7)),
    );
  });

  it("não muta a entrada original", () => {
    const input = ["a", "b", "c"];
    shuffle(input, seededRng(1));
    expect(input).toEqual(["a", "b", "c"]);
  });
});

describe("planRound", () => {
  it("cada elegível aparece exatamente uma vez no round", () => {
    const ids = ["u1", "u2", "u3", "u4", "u5", "u6"];
    const round = planRound(ids, seededRng(123));
    const flat = round.flat();
    expect(flat).toHaveLength(ids.length);
    expect(new Set(flat)).toEqual(new Set(ids));
  });

  it("ninguém repete dentro do round", () => {
    const ids = Array.from({ length: 9 }, (_, i) => `u${i}`);
    const round = planRound(ids, seededRng(99));
    const flat = round.flat();
    expect(new Set(flat).size).toBe(flat.length); // sem duplicatas
  });

  it("número ímpar gera um dia solo no fim", () => {
    const ids = ["a", "b", "c", "d", "e"];
    const round = planRound(ids, seededRng(5));
    expect(round).toHaveLength(3);
    expect(round[round.length - 1]).toHaveLength(1);
  });

  it("lista vazia gera round vazio", () => {
    expect(planRound([], seededRng(1))).toEqual([]);
  });
});

describe("nextCoffeeDates (seg-qui)", () => {
  const weekdays = [1, 2, 3, 4]; // seg, ter, qua, qui

  it("pula sexta/sábado/domingo", () => {
    // 2026-05-28 é uma quinta-feira
    const from = dateFromYmd("2026-05-28");
    const dates = nextCoffeeDates(from, weekdays, 3).map(toYmd);
    expect(dates).toEqual([
      "2026-05-28", // qui
      "2026-06-01", // seg (pula 29-sex, 30-sáb, 31-dom)
      "2026-06-02", // ter
    ]);
  });

  it("inclui o próprio dia se for dia de café", () => {
    const from = dateFromYmd("2026-06-01"); // segunda
    const [first] = nextCoffeeDates(from, weekdays, 1).map(toYmd);
    expect(first).toBe("2026-06-01");
  });

  it("avança quando from cai em dia sem café", () => {
    const from = dateFromYmd("2026-05-30"); // sábado
    const [first] = nextCoffeeDates(from, weekdays, 1).map(toYmd);
    expect(first).toBe("2026-06-01"); // segunda
  });

  it("count zero retorna vazio", () => {
    expect(nextCoffeeDates(dateFromYmd("2026-06-01"), weekdays, 0)).toEqual([]);
  });
});
