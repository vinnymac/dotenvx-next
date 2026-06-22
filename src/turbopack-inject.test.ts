import fs, {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const RUNTIME_FILE = '[turbopack]_runtime.js';

describe('injectDotenvxInitIntoTurbopackRuntime', () => {
  let dir: string;

  beforeEach(() => {
    // The module tracks injection in module-level state, so reset between
    // cases to get a fresh `injectedTurbopackRuntime = false`.
    vi.resetModules();
    dir = mkdtempSync(join(tmpdir(), 'dotenvx-turbo-'));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  function load() {
    return import('./turbopack-inject.js');
  }

  it('inserts the env snippet after the last import in an ESM runtime file', async () => {
    const file = join(dir, RUNTIME_FILE);
    writeFileSync(
      file,
      'import a from "a";\nimport b from "b";\nexport const h = () => process.env.SECRET;\n'
    );

    const {
      injectDotenvxInitIntoTurbopackRuntime,
      isInjectedTurbopackRuntime,
    } = await load();
    injectDotenvxInitIntoTurbopackRuntime(dir, { SECRET: 'shh' });

    const out = readFileSync(file, 'utf8');
    expect(out).toContain('Object.assign(process.env,{"SECRET":"shh"})');
    // snippet sits after the imports but before the first real statement
    expect(out.indexOf('Object.assign')).toBeGreaterThan(
      out.lastIndexOf('import ')
    );
    expect(out.indexOf('Object.assign')).toBeLessThan(
      out.indexOf('export const h')
    );
    expect(isInjectedTurbopackRuntime()).toBe(true);
  });

  it('prepends the snippet when there are no top-level imports (CJS)', async () => {
    const file = join(dir, RUNTIME_FILE);
    writeFileSync(file, 'const y = require("y");\nmodule.exports = y;\n');

    const { injectDotenvxInitIntoTurbopackRuntime } = await load();
    injectDotenvxInitIntoTurbopackRuntime(dir, { A: '1' });

    const out = readFileSync(file, 'utf8');
    expect(out.startsWith('(function(){')).toBe(true);
    expect(out).toContain('Object.assign(process.env,{"A":"1"})');
  });

  it('also injects into edge wrapper files when a server runtime is present', async () => {
    writeFileSync(join(dir, RUNTIME_FILE), 'export const s = 1;\n');
    const edge = join(dir, 'route.edge-wrapper.js');
    writeFileSync(edge, 'export const e = 1;\n');

    const { injectDotenvxInitIntoTurbopackRuntime } = await load();
    injectDotenvxInitIntoTurbopackRuntime(dir, { A: '1' });

    expect(readFileSync(edge, 'utf8')).toContain(
      'Object.assign(process.env,{"A":"1"})'
    );
  });

  it('defers (no injection, retryable) when no server runtime file exists yet', async () => {
    const edge = join(dir, 'route.edge-wrapper.js');
    writeFileSync(edge, 'export const e = 1;\n');

    const {
      injectDotenvxInitIntoTurbopackRuntime,
      isInjectedTurbopackRuntime,
    } = await load();
    injectDotenvxInitIntoTurbopackRuntime(dir, { A: '1' });

    expect(readFileSync(edge, 'utf8').includes('Object.assign')).toBe(false);
    expect(isInjectedTurbopackRuntime()).toBe(false);
  });

  it('injects only once across repeated calls', async () => {
    const file = join(dir, RUNTIME_FILE);
    writeFileSync(file, 'export const s = 1;\n');

    const { injectDotenvxInitIntoTurbopackRuntime } = await load();
    injectDotenvxInitIntoTurbopackRuntime(dir, { A: '1' });
    injectDotenvxInitIntoTurbopackRuntime(dir, { A: '1' });

    const out = readFileSync(file, 'utf8');
    expect(out.split('Object.assign(process.env,')).toHaveLength(2);
  });
});

describe('activateTurbopackInjection (fs interception)', () => {
  let dir: string;
  let originalPromisesWriteFile: typeof fs.promises.writeFile;
  let originalWriteFileSync: typeof fs.writeFileSync;

  beforeEach(() => {
    vi.resetModules();
    dir = mkdtempSync(join(tmpdir(), 'dotenvx-turbo-act-'));
    originalPromisesWriteFile = fs.promises.writeFile;
    originalWriteFileSync = fs.writeFileSync;
  });

  afterEach(() => {
    // activateTurbopackInjection patches global fs and never restores it, so
    // undo the patch here to avoid leaking into other tests.
    fs.promises.writeFile = originalPromisesWriteFile;
    fs.writeFileSync = originalWriteFileSync;
    rmSync(dir, { recursive: true, force: true });
  });

  function setupRuntime(): string {
    const nextDir = join(dir, '.next');
    mkdirSync(nextDir, { recursive: true });
    const runtime = join(nextDir, RUNTIME_FILE);
    writeFileSync(runtime, 'export const s = 1;\n');
    return nextDir;
  }

  it('injects when .next/export-detail.json is written via fs.promises.writeFile', async () => {
    const nextDir = setupRuntime();

    const { activateTurbopackInjection } = await import(
      './turbopack-inject.js'
    );
    activateTurbopackInjection({ A: '1' });
    await fs.promises.writeFile(join(nextDir, 'export-detail.json'), '{}');

    expect(readFileSync(join(nextDir, RUNTIME_FILE), 'utf8')).toContain(
      'Object.assign(process.env,{"A":"1"})'
    );
  });

  it('injects when .next/export-detail.json is written via fs.writeFileSync', async () => {
    const nextDir = setupRuntime();

    const { activateTurbopackInjection } = await import(
      './turbopack-inject.js'
    );
    activateTurbopackInjection({ B: '2' });
    fs.writeFileSync(join(nextDir, 'export-detail.json'), '{}');

    expect(readFileSync(join(nextDir, RUNTIME_FILE), 'utf8')).toContain(
      'Object.assign(process.env,{"B":"2"})'
    );
  });

  it('does not inject on unrelated fs writes', async () => {
    const nextDir = setupRuntime();

    const { activateTurbopackInjection, isInjectedTurbopackRuntime } =
      await import('./turbopack-inject.js');
    activateTurbopackInjection({ A: '1' });
    await fs.promises.writeFile(join(nextDir, 'some-other-file.json'), '{}');

    expect(isInjectedTurbopackRuntime()).toBe(false);
    expect(
      readFileSync(join(nextDir, RUNTIME_FILE), 'utf8').includes(
        'Object.assign'
      )
    ).toBe(false);
  });
});
