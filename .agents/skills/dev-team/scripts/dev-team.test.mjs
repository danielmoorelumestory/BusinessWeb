import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { main, selectHarness, resolveOrca, validateStart, validatePlan } from './dev-team.mjs';

const script = fileURLToPath(new URL('./dev-team.mjs', import.meta.url));
const bundle = path.resolve(path.dirname(script), '..');
const template = JSON.parse(fs.readFileSync(path.join(bundle, 'assets/team.config.json')));
const available = Object.fromEntries(Object.keys(template.harnesses).map(k => [k, true]));
const temp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'dev-team-test-'));
const read = p => JSON.parse(fs.readFileSync(p, 'utf8'));
const save = (p, v) => fs.writeFileSync(p, JSON.stringify(v, null, 2));
const invoke = (project, ...args) => main([...args, '--project', project]);

test('primary exhaustion routes to a configured substitute; all unavailable stays blocked', () => {
  assert.equal(selectHarness(template, { codex: { state: 'exhausted' } }, 'backend', available).selected, 'claude');
  const blocked = Object.fromEntries(Object.keys(available).map(k => [k, { state: 'exhausted' }]));
  assert.equal(selectHarness(template, blocked, 'backend', available).selected, null);
  assert.equal(selectHarness(template, {}, 'backend', {}).selected, null);
});
test('known cooldown expires, unknown exhaustion never resets itself', () => {
  assert.equal(selectHarness(template, { codex: { state: 'rate_limited', until: '2026-01-01T00:00:00Z' } }, 'backend', available, null, Date.parse('2026-01-02')).selected, 'codex');
  assert.equal(selectHarness(template, { codex: { state: 'exhausted' } }, 'backend', available, null, Date.parse('2030-01-01')).selected, 'claude');
});
test('review uses a different harness when possible and reports single-harness degradation', () => {
  const r = selectHarness(template, {}, 'reviewer', available, 'claude');
  assert.equal(r.selected, 'codex');
  assert.equal(r.independentHarness, true);
  const single = selectHarness(template, {}, 'reviewer', { claude: true }, 'claude');
  assert.equal(single.selected, 'claude');
  assert.equal(single.independentHarness, false);
  assert.equal(single.quotaVerified, false);
});
test('Linux resolution avoids launching the system screen reader', () => {
  assert.equal(resolveOrca({}, 'linux'), 'orca-ide');
  assert.equal(resolveOrca({ ORCA_WORKTREE_ID: 'managed' }, 'linux'), 'orca');
  assert.equal(resolveOrca({ ORCA_CLI_COMMAND: '/custom/orca' }, 'linux'), '/custom/orca');
});
test('installation into an empty target, repeat init and moving the project preserve links/config', () => {
  const root = temp(), project = path.join(root, 'new project');
  invoke(project, 'init');
  const cp = path.join(project, '.dev-team/config.json'), c = read(cp);
  c.maxParallel = 1; save(cp, c);
  const repeat = spawnSync(process.execPath, [path.join(project, '.agents/skills/dev-team/scripts/dev-team.mjs'), 'init', '--project', project], { encoding: 'utf8' });
  assert.equal(repeat.status, 0, repeat.stderr);
  assert.equal(read(cp).maxParallel, 1);
  assert.equal(fs.readlinkSync(path.join(project, '.claude/skills/dev-team')), '../../.agents/skills/dev-team');
  const moved = path.join(root, 'moved project'); fs.renameSync(project, moved);
  assert.ok(fs.existsSync(path.join(moved, '.claude/skills/dev-team/SKILL.md')));
  const run = spawnSync(process.execPath, [path.join(moved, '.claude/skills/dev-team/scripts/dev-team.mjs'), 'help'], { encoding: 'utf8' });
  assert.equal(run.status, 0); assert.match(run.stdout, /dev-team/);
});
test('installation never overwrites an existing target skill or root instructions', () => {
  const project = temp();
  fs.writeFileSync(path.join(project, 'AGENTS.md'), 'original');
  invoke(project, 'init');
  assert.equal(fs.readFileSync(path.join(project, 'AGENTS.md'), 'utf8'), 'original');
  assert.throws(() => invoke(project, 'init'), /已存在/);
});
test('fullstack plan only includes configured platforms and blocks missing Android scope', () => {
  const project = temp(); invoke(project, 'init');
  const cp = path.join(project, '.dev-team/config.json'), c = read(cp);
  c.paths.frontend = ['web/src']; c.paths.backend = ['services/orders']; save(cp, c);
  const p = invoke(project, 'plan', '--workflow', 'fullstack', '--goal', 'orders', '--id', 'orders');
  assert.deepEqual(p.tasks.map(t => t.key), ['contract', 'frontend', 'backend', 'integration', 'review', 'e2e']);
  assert.deepEqual(p.tasks.find(t => t.key === 'review').deps, ['frontend', 'backend']);
  assert.throws(() => invoke(project, 'plan', '--workflow', 'android', '--goal', 'login'), /paths/);
  assert.throws(() => invoke(project, 'plan', '--goal', 'escape', '--id', '../bad'), /ID/);
});
test('task dependency cycles, duplicate names and escaping ownership fail before native mutation', () => {
  const task = { key: 'a', role: 'backend', deps: [], access: 'write', scope: ['server'] };
  assert.throws(() => validatePlan({ tasks: [{ ...task, deps: ['a'] }] }, template), /依赖/);
  assert.throws(() => validatePlan({ tasks: [task, task] }, template), /重复/);
  assert.throws(() => validatePlan({ tasks: [{ ...task, scope: ['../other'] }] }, template), /非法/);
});
test('ready gate, parallel limit, overlapping writes and unknown start all prevent duplicates', () => {
  const a = { key: 'a', taskId: 'ta', access: 'write', scope: ['src'] };
  const b = { key: 'b', taskId: 'tb', access: 'write', scope: ['src/feature'] };
  const state = { tasks: [a, b], operations: {} };
  assert.throws(() => validateStart(state, template, 'a', [{ id: 'ta', status: 'blocked' }]), /不可启动/);
  assert.throws(() => validateStart(state, template, 'b', [{ id: 'ta', status: 'dispatched' }, { id: 'tb', status: 'ready' }]), /重叠/);
  assert.throws(() => validateStart(state, { ...template, maxParallel: 1 }, 'b', [{ id: 'ta', status: 'dispatched' }, { id: 'tb', status: 'ready' }]), /maxParallel/);
  state.operations['start:a'] = { requestId: 'lost' };
  assert.throws(() => validateStart(state, template, 'a', [{ id: 'ta', status: 'ready' }]), /禁止重复/);
});
test('equivalent paths and symlink aliases cannot create simultaneous writers', () => {
  const project = temp();
  fs.mkdirSync(path.join(project, 'src/orders'), { recursive: true });
  fs.symlinkSync('src/orders', path.join(project, 'orders-link'));
  for (const alias of ['./src/orders', 'src/./orders', 'src//orders', 'orders-link']) {
    const s = { operations: {}, tasks: [
      { key: 'a', role: 'backend', deps: [], taskId: 'ta', access: 'write', scope: ['src/orders'] },
      { key: 'b', role: 'backend', deps: [], taskId: 'tb', access: 'write', scope: [alias] }
    ] };
    validatePlan(s, template, project);
    assert.throws(() => validateStart(s, template, 'b', [{ id: 'ta', status: 'dispatched' }, { id: 'tb', status: 'ready' }], project), /重叠/, alias);
  }
  fs.symlinkSync(os.tmpdir(), path.join(project, 'outside'));
  assert.throws(() => validatePlan({ tasks: [{ key: 'escape', role: 'backend', deps: [], access: 'write', scope: ['outside'] }] }, template, project), /非法/);
});
test('platform plans have different design and acceptance stages; workers load only their platform', () => {
  const project = temp(); invoke(project, 'init');
  const cp = path.join(project, '.dev-team/config.json'), c = read(cp);
  c.paths = { android: ['app/src'], frontend: ['web/src'], backend: ['server'] }; save(cp, c);
  const android = invoke(project, 'plan', '--workflow', 'android', '--goal', '登录', '--id', 'android');
  const web = invoke(project, 'plan', '--workflow', 'frontend', '--goal', '登录', '--id', 'web');
  const backend = invoke(project, 'plan', '--workflow', 'backend', '--goal', '登录', '--id', 'backend');
  assert.ok(android.tasks.some(t => t.key === 'device-check'));
  assert.ok(web.tasks.some(t => t.key === 'browser-check'));
  assert.ok(backend.tasks.some(t => t.key === 'data-design'));
  assert.ok(!backend.tasks.some(t => t.key === 'ui-design'));
  const spec = fs.readFileSync(path.join(project, '.dev-team/runs/android/tasks/android.md'), 'utf8');
  assert.match(spec, /android\.md/);
  assert.doesNotMatch(spec, /frontend\.md|backend\.md|workflows\.md/);
});
test('availability persists locally and uses no provider calls', () => {
  const project = temp(); invoke(project, 'init');
  invoke(project, 'availability', '--harness', 'codex', '--state', 'exhausted', '--reason', 'budget');
  assert.equal(read(path.join(project, '.dev-team/local/availability.json')).codex.state, 'exhausted');
  assert.match(fs.readFileSync(path.join(project, '.dev-team/.gitignore'), 'utf8'), /local\//);
  assert.throws(() => invoke(project, 'availability', '--harness', 'codex', '--state', 'rate_limited', '--until', 'not-a-date'), /ISO/);
});
test('archive excludes project identity/state and can install in another project', () => {
  const project = temp(); invoke(project, 'init');
  const out = path.join(temp(), 'dev-team.zip');
  invoke(project, 'pack', '--output', out);
  const dest = temp();
  const r = spawnSync('python3', ['-c', 'import zipfile,sys; z=zipfile.ZipFile(sys.argv[1]); assert all(n.startswith("dev-team/") and ".dev-team/" not in n for n in z.namelist()); z.extractall(sys.argv[2])', out, dest], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  const target = temp();
  const install = spawnSync(process.execPath, [path.join(dest, 'dev-team/scripts/dev-team.mjs'), 'init', '--project', target], { encoding: 'utf8' });
  assert.equal(install.status, 0, install.stderr);
  assert.ok(fs.existsSync(path.join(target, '.agents/skills/dev-team/references/recovery.md')));
});
