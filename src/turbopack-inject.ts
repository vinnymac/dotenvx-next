/**
 * Turbopack runtime injection — patches fs.writeFile/fs.writeFileSync to intercept
 * turbopack's build output and prepend the env inline snippet into runtime files.
 *
 * Turbopack writes `[turbopack]_runtime.js` directly (bypassing webpack), so we
 * can't use the processAssets hook. Instead we intercept fs writes and inject when
 * export-detail.json is written (signals compilation is complete).
 */

import fs from 'node:fs';
import path from 'node:path';

function debugLog(...args: unknown[]): void {
  if (!process.env.DEBUG_DOTENVX_NEXT) return;
  console.log('[dotenvx-next]', ...args);
}

let injectedTurbopackRuntime = false;

export function isInjectedTurbopackRuntime(): boolean {
  return injectedTurbopackRuntime;
}

/**
 * Inject the env inline snippet into turbopack runtime files.
 * Called after export-detail.json is written (turbopack compilation complete).
 */
export function injectDotenvxInitIntoTurbopackRuntime(
  nextDirPath: string,
  env: Record<string, string>
): void {
  if (injectedTurbopackRuntime) return;

  const serverRuntimeFiles: string[] = [];
  const edgeWrapperFiles: string[] = [];

  const walkDir = (dir: string): void => {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        walkDir(path.join(dir, entry.name));
      } else if (entry.name === '[turbopack]_runtime.js') {
        serverRuntimeFiles.push(path.join(dir, entry.name));
      } else if (
        entry.name.includes('edge-wrapper') &&
        entry.name.endsWith('.js')
      ) {
        edgeWrapperFiles.push(path.join(dir, entry.name));
      }
    }
  };

  walkDir(nextDirPath);

  debugLog(
    `turbopack runtime injection: found ${serverRuntimeFiles.length} server runtime files,`,
    `${edgeWrapperFiles.length} edge wrapper files`
  );

  if (!serverRuntimeFiles.length) {
    // Runtime files may not exist yet — turbopack (Rust) writes them directly.
    // We'll retry on subsequent fs writes until they appear.
    return;
  }

  // Mark as done so we don't retry
  injectedTurbopackRuntime = true;

  // Inline snippet: assign build-time-resolved values into process.env at runtime.
  const inlineSnippet = `(function(){if(typeof process!=='undefined'){Object.assign(process.env,${JSON.stringify(env)});}})();`;

  /**
   * Insert inlineSnippet into source respecting ESM constraints.
   * ESM files require all top-level `import` declarations to appear before any
   * other statements, so we must insert after the last import line rather than
   * prepending to the file.
   */
  const insertIntoSource = (origSource: string): string => {
    const lines = origSource.split('\n');
    // Find the last line that starts with 'import ' (top-level import declaration)
    let lastImportIdx = -1;
    for (let i = 0; i < lines.length; i++) {
      if (/^import\s/.test(lines[i])) {
        lastImportIdx = i;
      }
    }
    if (lastImportIdx >= 0) {
      // Insert after the last import line
      lines.splice(lastImportIdx + 1, 0, inlineSnippet);
      return lines.join('\n');
    }
    // CJS or no imports — prepend
    return [inlineSnippet, origSource].join('\n');
  };

  for (const runtimeFile of serverRuntimeFiles) {
    const origSource = fs.readFileSync(runtimeFile, 'utf8');
    fs.writeFileSync(runtimeFile, insertIntoSource(origSource));
    debugLog(`injected env into turbopack server runtime: ${runtimeFile}`);
  }

  for (const wrapperFile of edgeWrapperFiles) {
    const origSource = fs.readFileSync(wrapperFile, 'utf8');
    fs.writeFileSync(wrapperFile, insertIntoSource(origSource));
    debugLog(`injected env into turbopack edge wrapper: ${wrapperFile}`);
  }
}

/**
 * Patch global fs methods to detect when turbopack compilation completes,
 * then trigger runtime injection.
 */
export function activateTurbopackInjection(env: Record<string, string>): void {
  debugLog('activating turbopack fs intercept');

  const origWriteFileFn = fs.promises.writeFile;
  fs.promises.writeFile = async function dotenvxPatchedWriteFile(
    ...args: Parameters<typeof fs.promises.writeFile>
  ): ReturnType<typeof fs.promises.writeFile> {
    const filePath = args[0].toString();
    debugLog('fs.promises.writeFile:', filePath);

    if (
      !injectedTurbopackRuntime &&
      filePath.endsWith('/.next/export-detail.json')
    ) {
      const nextDirPath = filePath.substring(0, filePath.lastIndexOf('/'));
      injectDotenvxInitIntoTurbopackRuntime(nextDirPath, env);
    }

    return origWriteFileFn.apply(fs.promises, args);
  };

  const origWriteFileSyncFn = fs.writeFileSync;
  fs.writeFileSync = function dotenvxPatchedWriteFileSync(
    ...args: Parameters<typeof fs.writeFileSync>
  ): void {
    const filePath = args[0].toString();
    debugLog('fs.writeFileSync:', filePath);

    if (
      !injectedTurbopackRuntime &&
      filePath.endsWith('/.next/export-detail.json')
    ) {
      const nextDirPath = filePath.substring(0, filePath.lastIndexOf('/'));
      injectDotenvxInitIntoTurbopackRuntime(nextDirPath, env);
    }

    origWriteFileSyncFn.apply(fs, args);
  };
}
