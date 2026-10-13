#!/usr/bin/env node
// No dependencies. Orca owns task/dispatch lifecycle; this helper owns portable files.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';

const bundle = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const json = p => JSON.parse(fs.readFileSync(p, 'utf8'));
const exists = p => fs.existsSync(p);
const fail = s => { throw new Error(s); };
function write(p, value, exclusive = false) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  const content = typeof value === 'string' ? value : JSON.stringify(value, null, 2) + '\n';
  if (exclusive) { fs.writeFileSync(p, content, { flag: 'wx' }); return; }
  const temp = p + '.' + randomUUID() + '.tmp';
  fs.writeFileSync(temp, content);
  fs.renameSync(temp, p);
}
function options(args) {
  const out = { _: [] };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (!a.startsWith('--')) { out._.push(a); continue; }
    const key = a.slice(2);
    if (['models', 'help', 'dry-run'].includes(key)) out[key] = true;
    else {
      if (!args[i + 1] || args[i + 1].startsWith('--')) fail(`缺少 ${a} 的值`);
      out[key] = args[++i];
    }
  }
  return out;
}
export function resolveOrca(env = process.env, platform = process.platform) {
  if (env.ORCA_CLI_COMMAND) return env.ORCA_CLI_COMMAND;
  if (env.ORCA_DEV_REPO_ROOT) return 'orca-dev';
  return platform === 'linux' && !env.ORCA_WORKTREE_ID && !env.ORCA_FOLDER_CONTEXT_ID ? 'orca-ide' : 'orca';
}
function executable(name) {
  if (path.isAbsolute(name)) return exists(name) ? name : null;
  const extensions = process.platform === 'win32' ? ['', '.exe', '.cmd', '.bat'] : [''];
  for (const dir of (process.env.PATH || '').split(path.delimiter)) {
    for (const ext of extensions) {
      const p = path.join(dir, name + ext);
      try { fs.accessSync(p, fs.constants.X_OK); return p; } catch { /* next */ }
    }
  }
  return null;
}
function call(command, args, cwd, timeout = 20000) {
  // Never shell-interpolate goals, paths, prompts, or provider configuration.
  const r = spawnSync(command, args, { cwd, encoding: 'utf8', timeout, maxBuffer: 8 * 1024 * 1024, shell: false });
  let data;
  try { data = JSON.parse(r.stdout); } catch { /* keep raw diagnostic */ }
  return { ok: !r.error && r.status === 0 && data?.ok !== false, data, stdout: r.stdout || '', stderr: r.stderr || '', error: r.error?.message, exitCode: r.status };
}
function native(orca, args, project, timeout) {
  const r = call(orca, [...args, '--json'], project, timeout);
  if (!r.ok) fail(JSON.stringify({ command: [orca, ...args], ...r }));
  if (!r.data) fail(`Orca 没有返回 JSON：${r.stdout}`);
  return r.data;
}
function safeId(id) {
  if (!/^[a-z0-9][a-z0-9-]{0,63}$/.test(id || '')) fail('ID 只允许小写字母、数字和连字符，最长 64 字符');
  return id;
}
function relativeScope(scope) {
  if (typeof scope !== 'string' || !scope || path.isAbsolute(scope) || /^[a-z]:/i.test(scope) || scope.includes('\\') || scope.split('/').includes('..')) fail(`非法代码范围：${scope}`);
  const normalized = path.posix.normalize(scope).replace(/\/$/, '') || '.';
  if (normalized === '.dev-team' || normalized.startsWith('.dev-team/')) fail(`非法代码范围：${scope}`);
  return normalized;
}
function physicalScope(project, scope) {
  const normalized = relativeScope(scope);
  if (!project) return normalized;
  let ancestor = path.resolve(project, normalized);
  const suffix = [];
  while (!exists(ancestor)) {
    suffix.unshift(path.basename(ancestor));
    const parent = path.dirname(ancestor);
    if (parent === ancestor) fail(`无法解析代码范围：${scope}`);
    ancestor = parent;
  }
  const real = path.join(fs.realpathSync(ancestor), ...suffix);
  const relative = path.relative(fs.realpathSync(project), real).split(path.sep).join('/') || '.';
  return relativeScope(relative);
}
function load(project) {
  const p = path.join(project, '.dev-team', 'config.json');
  if (!exists(p)) fail('先执行 init --project <项目目录>');
  const c = json(p);
  if (c.version !== 1 || !Number.isInteger(c.maxParallel) || c.maxParallel < 1 || c.maxParallel > 8) fail('config version 或 maxParallel 无效');
  for (const kind of ['android', 'frontend', 'backend']) {
    if (!Array.isArray(c.paths?.[kind]) || !Array.isArray(c.checks?.[kind])) fail(`缺少 paths/checks.${kind}`);
    c.paths[kind] = c.paths[kind].map(s => physicalScope(project, s));
  }
  for (const order of Object.values(c.routing || {})) {
    if (!Array.isArray(order) || order.some(id => !c.harnesses?.[id])) fail('routing 引用了未配置的 harness');
  }
  return c;
}
function health(project) {
  const p = path.join(project, '.dev-team', 'local', 'availability.json');
  return exists(p) ? json(p) : {};
}
export function selectHarness(config, availability, role, installed, avoid, now = Date.now()) {
  const order = config.routing[role];
  if (!order) fail(`未知角色 ${role}`);
  const excluded = [];
  const candidates = order.filter(id => {
    const h = config.harnesses[id], a = availability[id];
    const blocked = a && !['unknown', 'available'].includes(a.state) && (!a.until || Date.parse(a.until) > now);
    const reason = !h.enabled ? 'disabled' : !installed[id] ? 'not_installed' : blocked ? a.state : null;
    if (reason) excluded.push({ id, reason });
    return !reason;
  });
  const selected = candidates.find(id => id !== avoid) || candidates[0];
  return { role, selected: selected || null, alternatives: candidates.filter(id => id !== selected), excluded, independentHarness: !!selected && selected !== avoid, quotaVerified: false };
}
function installed(config) {
  return Object.fromEntries(Object.entries(config.harnesses).map(([id, h]) => [id, !!executable(h.command)]));
}
function linkSkill(project) {
  const source = path.join(project, '.agents', 'skills', 'dev-team');
  for (const dir of ['.claude', '.opencode']) {
    const dest = path.join(project, dir, 'skills', 'dev-team');
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    let stat;
    try { stat = fs.lstatSync(dest); } catch { /* absent */ }
    if (stat) {
      if (fs.realpathSync(dest) === fs.realpathSync(source)) continue;
      fail(`${dest} 已存在且不是本技能的链接；保留原文件，请手动处理`);
    }
    try { fs.symlinkSync(path.relative(path.dirname(dest), source), dest, 'dir'); }
    catch (e) {
      if (process.platform !== 'win32') throw e;
      // Windows junctions must be recreated after moving a project.
      fs.symlinkSync(source, dest, 'junction');
    }
  }
}
function init(project) {
  fs.mkdirSync(project, { recursive: true });
  const dest = path.join(project, '.agents', 'skills', 'dev-team');
  if (path.resolve(bundle) !== path.resolve(dest)) {
    if (exists(dest)) fail(`${dest} 已存在；不会覆盖已有 skill`);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.cpSync(bundle, dest, { recursive: true, dereference: true });
  }
  linkSkill(project);
  const configPath = path.join(project, '.dev-team', 'config.json');
  if (!exists(configPath)) {
    const c = json(path.join(bundle, 'assets', 'team.config.json'));
    const has = p => exists(path.join(project, p));
    if (has('src')) c.paths.frontend = ['src'];
    c.paths.backend = ['server', 'api', 'supabase'].filter(has);
    if (has('gradlew') || has('gradlew.bat')) {
      c.paths.android = fs.readdirSync(project, { withFileTypes: true }).filter(d => d.isDirectory() && has(`${d.name}/src/main/AndroidManifest.xml`)).map(d => `${d.name}/src`);
    }
    if (has('package.json')) {
      const scripts = json(path.join(project, 'package.json')).scripts || {};
      c.checks.frontend = ['typecheck', 'test', 'build'].filter(k => scripts[k]).map(k => `npm run ${k}`);
      c.checks.backend = Object.keys(scripts).filter(k => /^test:.*(server|knowledge|api)/.test(k)).map(k => `npm run ${k}`);
    }
    write(configPath, c, true);
  }
  const ignore = path.join(project, '.dev-team', '.gitignore');
  if (!exists(ignore)) write(ignore, 'local/\nruns/\n.lock\n*.tmp\n', true);
  const context = path.join(project, '.dev-team', 'PROJECT.md');
  if (!exists(context)) write(context, '# 开发上下文\n\n由 manager 开工时补全：目标、技术栈、模块路径、入口、项目约束、API 契约位置、构建/测试命令、可用模拟器/设备、发布方式。\n\n`.dev-team/config.json` 的 paths/checks 是探测候选，派工前按任务核对。既有 AGENTS.md/CLAUDE.md 仍是项目约束来源。本文件不存账号、密钥或剩余额度。\n', true);
  return { initialized: project, skill: dest, config: configPath, manager: '当前会话；输入 $dev-team <开发目标>', note: '没有启动额外常驻 agent，也没有修改项目根说明或全局权限' };
}
function withLock(project, fn) {
  const p = path.join(project, '.dev-team', '.lock');
  let fd;
  try { fd = fs.openSync(p, 'wx'); } catch { fail('另一个 manager 正在修改状态，或上次异常退出留下 .dev-team/.lock。确认旧进程已退出后再删除锁。'); }
  fs.writeSync(fd, `${process.pid}\n`);
  try { return fn(); } finally { fs.closeSync(fd); fs.unlinkSync(p); }
}
function plan(project, c, o) {
  if (!o.goal?.trim()) fail('plan 需要 --goal');
  const wf = o.workflow || 'frontend';
  if (!['android', 'frontend', 'backend', 'fullstack'].includes(wf)) fail('workflow: android|frontend|backend|fullstack');
  const kinds = wf === 'fullstack' ? ['android', 'frontend', 'backend'].filter(k => c.paths[k].length) : [wf];
  if (!kinds.length || kinds.some(k => !c.paths[k].length)) fail('先在 config.json 中设置目标平台 paths；不猜测业务模块');
  const id = safeId(o.id || `dev-${new Date().toISOString().replace(/[-:]/g, '').slice(0, 15).toLowerCase()}`);
  const dir = path.join(project, '.dev-team', 'runs', id);
  if (exists(dir)) fail(`计划 ${id} 已存在`);
  const tasks = [];
  const add = (key, role, deps, title, acceptance, kind) => tasks.push({ key, role, deps, title, acceptance, access: kinds.includes(role) ? 'write' : 'read', scope: kind ? c.paths[kind] : kinds.flatMap(k => c.paths[k]), context: kind || wf });
  if (wf === 'android' || wf === 'frontend') {
    add('requirements', 'architect', [], wf === 'android' ? 'Android 系统、权限与生命周期需求' : 'Web 用户路径与浏览器需求', wf === 'android' ? '明确屏幕状态、权限版本差异、旋转/前后台/进程恢复、离线行为及验收' : '明确页面/组件、浏览器、响应式断点、数据/错误与交互验收');
    add('ui-design', 'designer', ['requirements'], wf === 'android' ? 'Android 原生 UI、导航与状态设计' : 'Web UI、交互状态与可访问性设计', wf === 'android' ? '沿用 Compose/Views，说明 UiState、导航、数据流、主题/字体/TalkBack 与 owner' : '说明布局、组件/令牌、完整交互状态、响应式和键盘/焦点/a11y 行为');
    add(wf, wf, ['ui-design'], `${wf} 实施`, '实现目标，保持既有框架与分层，记录相关检查与未解决问题', wf);
    add('review', 'reviewer', [wf], '独立审查实现与风险', '逐项报告有证据的问题、严重度与文件位置；无问题也说明范围');
    if (wf === 'android') {
      add('android-tests', 'qa', ['android'], 'Android 静态、构建与 JVM 验证', '核对真实 Gradle 模块/variant，执行适用 lint、编译与 JVM 测试，记录退出码');
      add('device-check', 'qa', ['android-tests', 'review'], 'Android 设备、生命周期与权限验收', '有设备才运行仪器/UI/旋转/权限场景；缺设备明确未验证，不能用 JVM 通过代替');
    } else add('browser-check', 'qa', ['frontend', 'review'], 'Web 浏览器、交互与视觉验收', '执行适用静态/组件检查，核对真实浏览器、窄/宽屏、交互/错误态和 a11y；未执行项明确说明');
  } else if (wf === 'backend') {
    add('contract', 'architect', [], '后端业务规则、接口与失败契约', '明确端点/字段/状态码、鉴权、幂等、分页、错误与兼容性；无需 UI 阶段');
    add('data-design', 'architect', ['contract'], '后端数据、迁移与回滚设计', '说明模型/索引、并发/事务、expand-contract、回滚边界与验证方法；不需要数据库变更时说明');
    add('backend', 'backend', ['data-design'], '后端业务、数据与授权实现', '按契约实现服务、校验/对象授权、幂等、迁移与可观测性，并记录相关检查', 'backend');
    add('review', 'reviewer', ['backend'], '独立审查业务与服务风险', '核对真实 diff 的契约、事务、越权、重试与兼容性，报告有证据的问题');
    add('api-tests', 'qa', ['backend', 'review'], '后端接口、授权与迁移验收', '执行实际请求/响应、负向授权/非法输入/重复提交及适用集成/迁移检查；无 DB 标未演练');
  } else {
    add('contract', 'architect', [], '跨端需求、共享契约与所有权', '冻结 API/错误/鉴权/共享模型及 mock 示例，列每端验收与共享 owner');
    for (const kind of kinds) add(kind, kind, ['contract'], `${kind} 实施`, '按自己平台流程与冻结契约实现，mock/fake 与契约同构，记录真实验证', kind);
    add('integration', 'qa', kinds, '真实服务与客户端联调', '跨端核对真实请求/响应的成功、空、错误、鉴权过期、慢响应；按证据分类偏差');
    add('review', 'reviewer', kinds, '跨端独立审查与兼容性核对', '报告真实 diff 问题，检查旧客户端兼容与契约一致性');
    add('e2e', 'qa', ['integration', 'review'], '跨端端到端验收', '核心用户路径在真实后端与客户端走通；mock/环境缺失分开标记，各端汇总证据');
  }
  const state = { version: 1, id, workflow: wf, goal: o.goal, createdAt: new Date().toISOString(), tasks, operations: {}, runId: null, runtimeId: null };
  for (const t of tasks) {
    const report = `.dev-team/runs/${id}/reports/${t.key}.md`;
    const spec = [
      `# ${t.title}`, `Target: ${t.scope.join(', ')}`, `Change: ${o.goal}`, `Role: ${t.role}`,
      `Context: 先读项目适用的 AGENTS.md/CLAUDE.md、.dev-team/PROJECT.md、.agents/skills/dev-team/references/common.md、roles.md 和 ${t.context}.md。只读本任务相关平台，跨端全貌从依赖报告获取。`,
      `Dependencies: ${t.deps.length ? t.deps.map(d => `.dev-team/runs/${id}/reports/${d}.md`).join(', ') : '无'}`,
      `Ownership: ${t.access === 'write' ? `只允许修改 ${t.scope.join(', ')} 内与目标有关的源码和测试` : '代码只读，可运行必要检查'}；报告只写 ${report}。跨范围、依赖清单、锁文件、共享契约由 manager 明确分配后才能修改。`,
      'Constraints: 保留用户已有改动，不提交/合并/推送/部署，不启动子 agent。报告任务状态、变更、实际测试命令与退出码、未测项、下一步；不能用主观完成代替验收。',
      `Observable acceptance: ${t.acceptance}。${t.access === 'read' ? '代码只读；报告是交付产物。' : ''}`,
      `Candidate checks (按栈/变更核实后再运行): ${(kinds.includes(t.context) ? c.checks[t.context] : kinds.flatMap(k => c.checks[k])).join('; ') || 'manager 补全真实命令，禁止编造模块或命令'}`,
      `Output: ${report}；先建立报告并在阶段边界更新，额度耗尽时留下 checkpoint。`,
      'Lifecycle: 只使用本次 Orca 注入 preamble 的 Task/Dispatch/handle。问题走 preamble ask，完成前 check；worker_done 必须带 succeeded/failed 与真实 report-path。完成报告仅表示该阶段结束，最终交付由 manager 验收。'
    ].join('\n\n') + '\n';
    write(path.join(dir, 'tasks', `${t.key}.md`), spec, true);
  }
  write(path.join(dir, 'state.json'), state, true);
  write(path.join(dir, 'MANAGER.md'), '# 管理者交接\n\n目标：' + o.goal + '\n\n当前阶段：尚未派工。\n\n决策、已验收证据、未解决问题、下一条命令：由 manager 在每次派工/验收/切换前更新。Orca run/Task/Dispatch 的权威状态以运行时为准，state.json 只记录回执，不可手改成完成。\n', true);
  return { id, workflow: wf, tasks: tasks.map(t => ({ key: t.key, role: t.role, deps: t.deps, scope: t.scope })), next: 'manager 核对并编辑任务卡，然后 register --id <id>；start 一次派一项' };
}
function stateFile(project, id) { return path.join(project, '.dev-team', 'runs', safeId(id), 'state.json'); }
export function validatePlan(s, c, project) {
  if (!Array.isArray(s.tasks) || !s.tasks.length) fail('计划必须包含任务');
  const seen = new Set();
  for (const t of s.tasks) {
    safeId(t.key);
    if (seen.has(t.key)) fail(`重复 task key：${t.key}`);
    if (!c.routing[t.role]) fail(`未知角色：${t.role}`);
    if (!['read', 'write'].includes(t.access) || !Array.isArray(t.scope) || !t.scope.length) fail(`无效所有权：${t.key}`);
    t.scope = t.scope.map(scope => physicalScope(project, scope));
    if (!Array.isArray(t.deps) || t.deps.some(d => !seen.has(d))) fail(`任务 ${t.key} 的依赖必须在它之前，不能自引用或成环`);
    seen.add(t.key);
  }
}
function runtime(orca, project) {
  const r = native(orca, ['status'], project);
  if (r.result?.runtime?.state !== 'ready') fail('Orca runtime 未就绪；请先启动 Orca');
  if (!r._meta?.runtimeId) fail('缺少 Orca runtime ID，无法确认派工目标');
  return r._meta.runtimeId;
}
function ensureRuntime(state, orca, project) {
  const id = runtime(orca, project);
  if (state.runtimeId && state.runtimeId !== id) fail('Orca runtime 已变化；先按 recovery 文档核对 Run/Dispatch 和终端，不能盲目重放');
  return id;
}
function workspace(orca, project) {
  // Exact path lookup prevents inherited Orca environment from targeting another checkout.
  const r = native(orca, ['worktree', 'show', '--worktree', `path:${project}`], project);
  const w = r.result?.worktree;
  if (!w?.id || !w.path || fs.realpathSync(w.path) !== fs.realpathSync(project)) fail('项目没有匹配的 Orca 工作区；先在 Orca 打开/注册目标项目，再从其会话派工');
  return w.id;
}
function mutate(state, key, args, orca, project, save) {
  let op = state.operations[key];
  if (op?.receipt) {
    if (!op.ok) fail(`操作 ${key} 的原回执失败，先按 recovery 文档处理`);
    return op.receipt;
  }
  if (op) fail(`操作 ${key} 回执未知。先运行 ${orca} orchestration request-show --request ${op.requestId} --json，并按 recovery 文档核实；禁止直接重试`);
  op = state.operations[key] = { requestId: randomUUID(), args, startedAt: new Date().toISOString() };
  save();
  const r = call(orca, [...args, '--retry-request', op.requestId, '--json'], project, 75000);
  op.receipt = r.data || null;
  op.ok = r.ok;
  op.diagnostic = r.data ? undefined : { error: r.error, exitCode: r.exitCode, stderr: r.stderr.slice(-3000) };
  save();
  if (!r.ok || !r.data) fail(`操作 ${key} 未被证实成功，已保存 requestId/回执。先检查 state.json 和 Orca recovery 指令，禁止自动重发。`);
  return r.data;
}
function register(project, orca, o) {
  const p = stateFile(project, o.id), s = json(p), save = () => write(p, s);
  validatePlan(s, load(project), project);
  s.runtimeId = ensureRuntime(s, orca, project); save();
  const wid = workspace(orca, project);
  if (s.workspaceId && s.workspaceId !== wid) fail('工作区身份已变化，先核对原 Run/Dispatch');
  s.workspaceId = wid; save();
  if (!s.runId) {
    const r = mutate(s, 'run', ['orchestration', 'run-create', '--objective', s.goal], orca, project, save);
    s.runId = r.result?.run?.id || fail('缺少 run id'); save();
  }
  for (const t of s.tasks) {
    if (t.taskId) continue;
    const deps = t.deps.map(key => s.tasks.find(d => d.key === key)?.taskId || fail(`依赖 ${key} 尚未注册`));
    const spec = fs.readFileSync(path.join(path.dirname(p), 'tasks', `${t.key}.md`), 'utf8');
    const args = ['orchestration', 'task-create', '--run', s.runId, '--task-title', t.title, '--spec', spec, '--deps', JSON.stringify(deps)];
    const r = mutate(s, `task:${t.key}`, args, orca, project, save);
    t.taskId = r.result?.task?.id || r.result?.taskId || fail('缺少 task id'); save();
  }
  return { id: s.id, runId: s.runId, tasks: s.tasks.map(t => ({ key: t.key, taskId: t.taskId })) };
}
function taskRows(receipt) {
  const r = receipt.result;
  return Array.isArray(r?.tasks) ? r.tasks : Array.isArray(r) ? r : fail('无法解析 Orca task-list；保留状态，按当前版本文档检查');
}
export function validateStart(s, c, key, rows, project) {
  const t = s.tasks.find(t => t.key === key) || fail('计划中没有该 task');
  if (!t.taskId) fail('先 register');
  if (s.operations[`start:${key}`]) fail('本任务已有启动记录；检查回执，续接或按 recovery --retry-of，禁止重复派工');
  const own = rows.find(r => r.id === t.taskId);
  if (own?.status !== 'ready') fail(`Task 尚不可启动：${own?.status || 'unknown'}`);
  const active = s.tasks.filter(x => rows.find(r => r.id === x.taskId)?.status === 'dispatched');
  if (active.length >= c.maxParallel) fail('已达到 maxParallel');
  const overlap = (a, b) => a === b || a === '.' || b === '.' || a.startsWith(b + '/') || b.startsWith(a + '/');
  const conflicting = active.some(x => x.access === 'write' && x.scope.some(a =>
    t.scope.some(b => overlap(physicalScope(project, a), physicalScope(project, b)))));
  if (t.access === 'write' && conflicting) fail('与运行中的写任务范围重叠；串行执行或显式隔离工作区');
  return t;
}
function start(project, c, orca, o) {
  const p = stateFile(project, o.id), s = json(p), save = () => write(p, s);
  validatePlan(s, c, project);
  if (!s.runId) fail('先 register');
  ensureRuntime(s, orca, project);
  const wid = workspace(orca, project);
  if (s.workspaceId && s.workspaceId !== wid) fail('工作区身份已变化，先核对原 Run/Dispatch');
  const rows = taskRows(native(orca, ['orchestration', 'task-list', '--run', s.runId], project));
  const t = validateStart(s, c, o.task, rows, project);
  const route = selectHarness(c, health(project), t.role, installed(c), o.avoid);
  const chosen = o.harness || route.selected;
  if (!chosen || ![route.selected, ...route.alternatives].includes(chosen)) fail('没有可用执行器；保留计划并恢复登录/额度，不新增收费账号');
  const h = c.harnesses[chosen];
  if (h.launchMode === 'terminal' && !o.terminal) fail('该 harness 使用自定义模型启动：先按 operations.md 用 Orca 创建明确模型的终端、确认模型与就绪，再传 --terminal <handle>。尚未创建 Dispatch。');
  const args = ['orchestration', 'worker-start', '--run', s.runId, '--task', t.taskId, '--worktree', `id:${wid}`];
  if (o.terminal) {
    const terminal = native(orca, ['terminal', 'show', '--terminal', o.terminal], project).result?.terminal;
    if (terminal?.agentIdentity !== h.agent || terminal?.worktreeId !== wid || !terminal.connected) fail('终端执行器或工作区不匹配，不能派工');
    const ready = native(orca, ['terminal', 'wait', '--terminal', o.terminal, '--for', 'tui-idle', '--timeout-ms', '1000'], project);
    if (!ready.result?.wait?.satisfied) fail('终端未就绪，保留原终端继续检查，不重复创建');
    if (h.model) {
      const screen = native(orca, ['terminal', 'read', '--terminal', o.terminal], project).result?.terminal?.tail?.join('\n') || '';
      const modelName = h.model.split('/').at(-1);
      if (!screen.includes(modelName)) fail(`未从终端确认指定模型 ${modelName}；先核对真实模型，再派工`);
      t.modelEvidence = { requested: h.model, source: 'terminal-screen', observedAt: new Date().toISOString() };
    }
    args.push('--terminal', o.terminal);
  } else args.push('--agent', h.agent);
  if (h.model) {
    const models = call(h.command, ['models'], project);
    if (!models.ok || !models.stdout.split(/\r?\n/).map(x => x.trim()).includes(h.model)) fail(`模型 ${h.model} 未被该主机确认可用；运行 doctor --models，或选择其他 harness`);
    if (!o.terminal) args.push('--model', h.model);
  }
  // Dry-run performs reads only and never creates an authoritative attempt.
  if (o['dry-run']) return { command: [orca, ...args, '--json'], routing: route };
  const r = mutate(s, `start:${t.key}`, args, orca, project, save);
  t.harness = chosen;
  t.dispatchId = r.result?.dispatchId;
  t.launch = r.result?.launch;
  save();
  return r;
}
function doctor(project, c, orca, o) {
  const r = call(orca, ['status', '--json'], project);
  const h = Object.entries(c.harnesses).map(([id, h]) => ({ id, executable: executable(h.command), agent: h.agent, requestedModel: h.model || null, quota: health(project)[id] || { state: 'unknown' } }));
  let models;
  if (o.models) {
    const modelCommand = c.harnesses['opencode-m3']?.command;
    const r = modelCommand ? call(modelCommand, ['models'], project) : { ok: false, stderr: '未配置 opencode-m3' };
    models = r.ok ? r.stdout.trim().split(/\r?\n/) : { error: r.error || r.stderr };
  }
  return { platform: os.platform(), node: process.version, orca: { executable: orca, ok: r.ok, runtime: r.data?.result?.runtime?.state, version: r.data?.result?.runtime?.appVersion, error: r.ok ? undefined : r.error || r.stderr }, harnesses: h, models, paths: c.paths, checks: c.checks, note: '命令存在/模型列出都不证明已登录或有额度；不做付费模型探活，不读取凭据。Windows 请使用 Node 可直接执行的 Orca 可执行文件。' };
}
const help = `dev-team (Node >= 20, no npm install)
  init --project PATH                      安装技能链接并生成项目配置，不覆盖已有配置
  doctor [--models]                         检查 Orca、命令、模型；不消耗模型 token
  route --role ROLE [--avoid HARNESS]        按角色和额度标记选择执行器
  availability --harness ID --state STATE [--until ISO] [--reason TEXT]
  plan --workflow android|frontend|backend|fullstack --goal TEXT [--id NAME]
  register --id NAME                        将任务依赖登记到真实 Orca Run
  start --id NAME --task KEY [--harness ID] [--avoid ID] [--terminal HANDLE] [--dry-run]
  status --id NAME                          查看本地回执 + Orca Tasks/Workers（不消费消息）
  pack --output FILE.zip                    只打包技能，不含 .dev-team 运行记录或凭据
All commands accept --project PATH (default cwd).
Manager: 当前 agent 输入 $dev-team <目标>；使用原生 Orca check/reply/release 完成验收。
`;
export function main(args = process.argv.slice(2)) {
  const o = options(args), command = o._[0];
  if (!command || command === 'help' || o.help) return { help };
  const target = path.resolve(o.project || process.cwd());
  const project = exists(target) ? fs.realpathSync(target) : target;
  const orca = resolveOrca();
  if (command === 'init') return init(project);
  if (command === 'pack') {
    const out = path.resolve(o.output || path.join(project, 'dev-team.zip'));
    if (out === bundle || out.startsWith(bundle + path.sep)) fail('ZIP 输出不能放在 skill 内');
    fs.mkdirSync(path.dirname(out), { recursive: true });
    const r = call('python3', [path.join(bundle, 'scripts', 'package.py'), bundle, out], project);
    if (!r.ok) fail(r.error || r.stderr);
    return { archive: out };
  }
  const c = load(project);
  if (command === 'doctor') return doctor(project, c, orca, o);
  if (command === 'route') return selectHarness(c, health(project), o.role || 'manager', installed(c), o.avoid);
  if (command === 'status') {
    const s = json(stateFile(project, o.id));
    if (!s.runId) return s;
    ensureRuntime(s, orca, project);
    return { local: s, tasks: native(orca, ['orchestration', 'task-list', '--run', s.runId, '--brief'], project), workers: native(orca, ['orchestration', 'worker-list', '--run', s.runId, '--include-remote'], project) };
  }
  return withLock(project, () => {
    if (command === 'availability') {
      if (!c.harnesses[o.harness]) fail('未知 harness');
      if (!['unknown', 'available', 'exhausted', 'rate_limited', 'auth_required', 'disabled'].includes(o.state)) fail('无效 availability state');
      if (o.until && (!Number.isFinite(Date.parse(o.until)) || Date.parse(o.until) <= Date.now())) fail('--until 必须是未来的 ISO 时间');
      const a = health(project);
      a[o.harness] = { state: o.state, until: o.until || null, reason: o.reason || '', observedAt: new Date().toISOString() };
      write(path.join(project, '.dev-team', 'local', 'availability.json'), a);
      return a[o.harness];
    }
    if (command === 'plan') return plan(project, c, o);
    if (command === 'register') return register(project, orca, o);
    if (command === 'start') return start(project, c, orca, o);
    fail(`未知命令 ${command}`);
  });
}
if (process.argv[1] && fs.realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { const r = main(); process.stdout.write(r.help || JSON.stringify(r, null, 2) + '\n'); }
  catch (e) { process.stderr.write(e.message + '\n'); process.exitCode = 1; }
}
