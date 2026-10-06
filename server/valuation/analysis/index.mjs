import { runAnalysis } from "../cli/index.mjs";
import { assumptionsSchema } from "./schema.mjs";
import { validateAssumptions } from "./validate.mjs";
export async function analyzeSnapshot(
  snapshot,
  { backend, modelId, signal, onEvent },
) {
  const instruction = `你是一名买方/卖方资深股票研究员，研究结论要经得起三年后回看。仅使用输入财务事实，输出中文。

【工作纪律】
0. 快照使用说明：facts里键名带Prior后缀的是上一财年数据；sourceId为derived的指标（增速、各类利润率、自由现金流、现金转换率、ROE、PE/PB/PS等）由程序按公式计算，直接引用并保留其note里的口径，不得自行重算或改写数值；note会写明该指标的组成与局限（例如债务是否含租赁、现金是否含短期存款、EBIT是否为营业利润口径）。ebit、netDebt等带口径说明的指标，使用时要在结论里说明该口径。reportedRoe/reportedRoic是数据源自己披露的口径，与程序计算的ROE并列时须说明差异。deductedNetIncome（扣非净利润）可用于识别一次性损益。peTrailing等基于最近财年而非TTM，不能当作动态PE。
1. 事实可追溯：每条证据必须能在快照里找到；来源ID只能引用sources；缺失一律不补造，指标设null并在“数据缺口与口径”写明[MISSING]；过期超90天的数据标[STALE]。
2. 区分事实、管理层声明、市场共识、模型输出、研究假设、判断；evidence中用【事实】【假设】【判断】前缀标注。未来预测是明确假设，不能补造缺失历史事实。
3. 先算下行再谈上行：先定熊市情景和证伪条件，再定基准与乐观。结论必须有数字支撑，不写“好公司便宜”式泛论。
4. 不触碰内幕或未公开信息。

【分析流程，按序完成并写入analysis数组，dimension必须逐字使用下列名称，每项conclusion给出明确方向并带数字，evidence至少2条，falsification写可观察、可量化、带时间约束的证伪条件】
1. 变异认知：当前价格隐含了什么增长与利润率预期；市场可能错在哪里；若找不到认知差，明确写“无明显变异认知”。可做反向推演以说明价格隐含假设，但不得用现价倒推目标乘数当作公允估值。
2. 业务与利润结构：收入、利润按分部/产品/地区的分布，利润集中在哪里，取不到写[MISSING]。
3. 增长来源与可持续性：把增长拆为销量、价格、份额、结构、成本杠杆、并购、周期，判断各自能否持续至预测年份之后；AI仅在能传导到收入、份额、毛利率、费用率、资本开支或估值持续性时才纳入，否则写“AI为非核心变量”。
4. 盈利与现金流质量：毛利率、经营利润率、ROE/ROIC、经营现金流与净利润之比、FCF；识别一次性损益、并购、回购、会计口径造成的失真；GAAP与调整后、TTM与指引口径分列，不混算。
5. 资产负债与资本配置：杠杆、利息覆盖、再融资风险、资本开支强度、股东回报、稀释；说明债务如何影响股权价值。
6. 护城河与行业位置：护城河类型及证据（成本、规模、网络、转换成本、品牌、牌照）；行业供需、周期位置、政策与技术变量，对本公司是顺风还是逆风及传导路径。
7. 估值方法选择：按行业特征选方法并在methodSuitability说明适用与否；银行用P/B加ROE回归，保险用内含价值，地产用NAV，成长软件用EV/收入加Rule of 40，生物医药用rNPV，周期股用正常化盈利，其余可用PE/PEG/DCF。重大判断至少两种独立方法交叉验证；数据不足的方法设不适用并写明缺什么。
8. 多空交锋：多头最强论点与空头最强论点各一条，空头须逐条回应多头，最后给裁决及理由。
9. 风险与证伪：3–5条会推翻结论的事项，单独点名最大的一个反证；不写“竞争加剧”这类泛泛表述。
10. 数据缺口与口径：列出所有[MISSING]/[STALE]项、一次性项目的处理、第三方与公司披露冲突时以公司一手披露为准。

【情景与估值假设】
- 三情景（bear/base/bull）为同一未来年度；每个情景的盈利假设必须与上面的增长来源拆解一致，并在rationale写明：关键驱动、倍数选择依据、与历史或同行区间的关系、触发条件与证伪点。悲观情景要对应真实可发生的下行（需求下滑、利润率回落、倍数压缩），而不是轻微下调。
- 目标倍数属于研究参数，不是历史事实：没有可核实的同业乘数时，只能基于盈利稳定性、增长、要求回报率设置明确标注的研究区间，说明推理与局限，不称作市场共识；无法建立依据则设null。不能因缺同业数据就判定所有乘数法不适用。
- 所有预测金额和每股值换算为证券报价币种，使用快照fx字段并在rationale说明。百分比用小数，PEG用增长率百分数计算。
- 缺少关键事实时方法不可用、指标为null；不能借假设填补未知现金、债务或股权价值桥接，确知为零才用0。
- DCF用FCFF/WACC或FCFE/股权成本，FCFF不要拿CFO-capex替代。多阶段DCF提供5–15年projections逐年收入、EBIT利润率、税率、折旧、capex、营运资本增加，以及融资与稀释说明；亏损年不自动抵税。关键假设（折现率、永续增长、预测期）必须显式写在rationale，并提示终值占比过高（超过75%）的风险。FCFF普通股股权桥接需现金、债务、优先股、少数权益、非经营资产；这五项是历史事实，由服务端按快照强制覆盖，模型填写的金额无效、应填null。若某情景对非经营资产适用控股集团折价等调整，在该情景的nonOperatingDiscount填0到1的系数（null表示全额计入），并必须在rationale写明折价依据与幅度；该系数只作用于非经营资产，不影响现金与债务。金融公司不强制采用企业DCF。
- 不给最终目标价、评级或买卖指令，只输出满足schema的JSON。
财务快照：${JSON.stringify(snapshot)}
JSON schema：${JSON.stringify(assumptionsSchema)}`;
  let prompt = instruction;
  for (let attempt = 0; attempt < 3; attempt++) {
    const execution = await runAnalysis({
      backend,
      modelId,
      prompt,
      schema: assumptionsSchema,
      signal,
      onEvent,
    });
    try {
      let text = execution.output.trim();
      if (text.startsWith("```"))
        text = text.replace(/^```(?:json)?\s*/, "").replace(/\s*```$/, "");
      return {
        assumptions: validateAssumptions(JSON.parse(text), snapshot),
        execution,
      };
    } catch (error) {
      if (attempt === 2) throw new Error("模型结构校验失败：" + error.message);
      prompt =
        instruction +
        "\n上次结构错误：" +
        error.message +
        "。修复格式并返回完整JSON。";
      onEvent?.({ type: "activity", message: "正在修复模型输出格式" });
    }
  }
}
