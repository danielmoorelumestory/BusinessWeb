import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import Dcf from "./Dcf";
import { loadDcfRecords } from "../features/dcf";

function fill(label: string, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}
function fillRequired(overrides: Record<string, string> = {}) {
  const data: Record<string, string> = {
    公司名称: "贵州茅台",
    股票代码: "600519",
    起始自由现金流: "100",
    流通股数: "10",
    当前股价: "15",
    ...overrides,
  };
  for (const [label, value] of Object.entries(data)) fill(label, value);
}

describe("现金流折现估值页", () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => cleanup());

  it("填入必要项后给出合理价与买卖结论", () => {
    render(<Dcf />);
    expect(screen.getByText(/请填写起始自由现金流/)).toBeTruthy();
    fillRequired();
    // 100 亿起始 FCF / 10 亿股 → 合理价 144.62，远高于现价 15
    expect(screen.getAllByText("¥144.62").length).toBeGreaterThan(0);
    expect(screen.getByText("BUY")).toBeTruthy();
  });

  it("有结果时显示 5×5 敏感性矩阵，数据不全时不显示", () => {
    render(<Dcf />);
    expect(screen.queryByRole("table", { name: "DCF 敏感性矩阵" })).toBeNull();
    fillRequired();
    const table = screen.getByRole("table", { name: "DCF 敏感性矩阵" });
    // 表头 1 行 + 5 行折现率；每行 1 个行标题 + 5 个格子
    expect(table.querySelectorAll("tbody tr")).toHaveLength(5);
    expect(table.querySelectorAll("tbody tr:first-child td")).toHaveLength(6);
    expect(table.querySelector(".dcf-sens__center")?.textContent).toBe("¥144.62");
  });

  it("从公司研究页带参数打开时预填名称、市场、币种和当前价", () => {
    window.history.pushState({}, "", "/dcf?company=%E8%85%BE%E8%AE%AF%E6%8E%A7%E8%82%A1&code=0700&market=hk&currency=HKD&price=512.5");
    try {
      render(<Dcf />);
      expect((screen.getByLabelText("公司名称") as HTMLInputElement).value).toBe("腾讯控股");
      expect((screen.getByLabelText("股票代码") as HTMLInputElement).value).toBe("0700");
      expect((screen.getByLabelText("当前股价") as HTMLInputElement).value).toBe("512.5");
      expect((screen.getByLabelText("市场") as HTMLSelectElement).value).toBe("hk");
      expect((screen.getByLabelText("币种") as HTMLSelectElement).value).toBe("HKD");
      expect(screen.getByText(/已从公司研究页带入 腾讯控股/)).toBeTruthy();
    } finally {
      window.history.pushState({}, "", "/");
    }
  });

  it("保存后再次分析同一家公司会覆盖上一次的记录", () => {
    render(<Dcf />);
    fillRequired();
    fireEvent.click(screen.getByRole("button", { name: /保存本次分析/ }));
    expect(screen.getByText(/已保存 贵州茅台/)).toBeTruthy();
    expect(loadDcfRecords()).toHaveLength(1);

    fill("当前股价", "300");
    fireEvent.click(screen.getByRole("button", { name: /保存并覆盖 贵州茅台/ }));
    expect(screen.getByText(/已覆盖 贵州茅台/)).toBeTruthy();

    const records = loadDcfRecords();
    expect(records).toHaveLength(1);
    expect(records[0].input.currentPrice).toBe(300);
  });

  it("不同公司各存一条，可从列表载入", () => {
    render(<Dcf />);
    fillRequired();
    fireEvent.click(screen.getByRole("button", { name: /保存本次分析/ }));
    fillRequired({ 公司名称: "腾讯控股", 股票代码: "0700" });
    fireEvent.click(screen.getByRole("button", { name: /保存本次分析/ }));
    expect(loadDcfRecords()).toHaveLength(2);

    // 载入第一条后表单被覆盖，再次保存仍是两家
    fireEvent.click(screen.getAllByRole("button", { name: "载入" })[1]);
    expect(screen.getByText(/已载入/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /保存并覆盖/ }));
    expect(loadDcfRecords()).toHaveLength(2);
  });

  it("WACC 可回填为折现率", () => {
    render(<Dcf />);
    fillRequired();
    fill("市值", "1000");
    fill("总负债", "200");
    fill("β 值", "1.2");
    fill("利息支出", "10");
    fill("税前收入", "300");
    fill("所得税", "75");
    fill("无风险利率 (%)", "3");
    fill("市场预期回报 (%)", "8");
    expect(screen.getByText(/WACC 8\.13%/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "用 WACC 作为折现率" }));
    expect((screen.getByLabelText("期望折现率 (%)") as HTMLInputElement).value).toBe(
      "8.13",
    );
  });
});
