import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  deleteDcfRecord,
  findDcfRecord,
  isDcfRecord,
  loadDcfRecords,
  makeDcfKey,
  makeDcfRecord,
  saveDcfRecord,
} from "./storage.ts";
import { calculateSheetDcf } from "./engine.ts";
import { calculateWacc } from "./wacc.ts";
import { calculateMultiples } from "./multiples.ts";
import { sampleInput } from "./fixtures.ts";

function record(overrides: Record<string, unknown> = {}, savedAt = "2026-10-07T00:00:00.000Z") {
  const input = sampleInput(overrides);
  return makeDcfRecord(
    input,
    {
      result: calculateSheetDcf(input),
      wacc: calculateWacc(input),
      multiples: calculateMultiples(input),
    },
    savedAt,
  );
}

describe("makeDcfKey", () => {
  it("按市场+代码+名称唯一标识一家公司", () => {
    expect(makeDcfKey(sampleInput())).toBe("dcf|cn|600519|样例公司");
    expect(makeDcfKey(sampleInput({ code: " 600519 ", company: "样例 公司" }))).toBe(
      makeDcfKey(sampleInput()),
    );
    expect(makeDcfKey(sampleInput({ market: "hk" }))).not.toBe(
      makeDcfKey(sampleInput()),
    );
  });

  it("代码与名称都为空时落在「未命名」", () => {
    expect(makeDcfKey(sampleInput({ code: "", company: "  " }))).toBe("未命名");
  });
});

describe("dcf 记录持久化", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("同一家公司再次保存时覆盖上一次的记录", () => {
    saveDcfRecord(record({ currentPrice: 15 }, "2026-10-01T00:00:00.000Z"));
    saveDcfRecord(record({ currentPrice: 30 }, "2026-10-07T00:00:00.000Z"));
    const all = loadDcfRecords();
    expect(all).toHaveLength(1);
    expect(all[0].savedAt).toBe("2026-10-07T00:00:00.000Z");
    expect(all[0].result.mos).toBeCloseTo((129.621189 - 30) / 30, 5);
  });

  it("不同公司各存一条，新的置顶", () => {
    saveDcfRecord(record({ code: "600519" }));
    saveDcfRecord(record({ code: "000001", company: "平安银行" }));
    const all = loadDcfRecords();
    expect(all).toHaveLength(2);
    expect(all[0].code).toBe("000001");
  });

  it("最多保留 20 条", () => {
    for (let i = 0; i < 25; i++)
      saveDcfRecord(record({ code: "C" + i, company: "公司" + i }));
    expect(loadDcfRecords()).toHaveLength(20);
  });

  it("写入失败时返回失败而不抛错", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("quota");
    });
    const r = saveDcfRecord(record());
    expect(r.ok).toBe(false);
    expect(r.error).toContain("未保存");
  });

  it("读取时丢弃脏数据", () => {
    localStorage.setItem(
      "businessweb.dcf.v1",
      JSON.stringify([{ nope: true }, record(), null, 42]),
    );
    expect(loadDcfRecords()).toHaveLength(1);
  });

  it("按 key 查找与删除", () => {
    const r = record();
    saveDcfRecord(r);
    expect(findDcfRecord(r.key)?.key).toBe(r.key);
    expect(deleteDcfRecord(r.key).ok).toBe(true);
    expect(loadDcfRecords()).toHaveLength(0);
    expect(findDcfRecord(r.key)).toBeNull();
  });

  it("isDcfRecord 拒绝结构不完整的记录", () => {
    expect(isDcfRecord(record())).toBe(true);
    expect(isDcfRecord({ ...record(), schemaVersion: 2 })).toBe(false);
    expect(isDcfRecord({ ...record(), input: null })).toBe(false);
    expect(
      isDcfRecord({ ...record(), result: { status: "calculated" } }),
    ).toBe(false);
  });
});
