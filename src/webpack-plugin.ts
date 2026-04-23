/**
 * DotenvxWebpackPlugin — injects the dotenvx init bundle into webpack runtime files.
 *
 * We prepend the self-contained init bundle as raw JS so it runs before any
 * module code (before Prisma Pool, etc. can evaluate at import time).
 *
 * The __DOTENVX_FILES__ placeholder in the init source is replaced via direct
 * string substitution before injection — no DefinePlugin needed.
 */

// webpack types come bundled with next — do not add webpack as a separate dep
type WebpackCompiler = import('webpack').Compiler;
type WebpackCompilation = import('webpack').Compilation;

const PLUGIN_NAME = 'DotenvxNextWebpackPlugin';

// These are the webpack runtime asset names where we inject
const SERVER_RUNTIME_ASSETS = [
  'webpack-runtime.js',
  '../webpack-runtime.js',
  'webpack-api-runtime.js',
  '../webpack-api-runtime.js',
];

const EDGE_RUNTIME_ASSETS = [
  'edge-runtime-webpack.js',
  'webpack-runtime.js',
  '../webpack-runtime.js',
];

export interface DotenvxWebpackPluginOptions {
  /** Resolved list of env file paths to pass to dotenvx at runtime */
  files: string[];
  /** Pre-compiled init bundle source (CJS) to prepend into runtime */
  initSource: string;
}

/**
 * Replace the __DOTENVX_FILES__ placeholder in the init bundle with the actual
 * file list. The placeholder is a string literal in the source that gets swapped
 * with a JSON-encoded array string, so JSON.parse() in the init code yields string[].
 */
function substituteFiles(initSource: string, files: string[]): string {
  // The init source contains: const filesJson: string = '__DOTENVX_FILES__';
  // We replace the placeholder string literal with the actual JSON value.
  return initSource.replace(
    /'__DOTENVX_FILES__'/g,
    JSON.stringify(JSON.stringify(files)),
  );
}

export class DotenvxWebpackPlugin {
  private readonly options: DotenvxWebpackPluginOptions;

  constructor(options: DotenvxWebpackPluginOptions) {
    this.options = options;
  }

  apply(compiler: WebpackCompiler): void {
    const { files, initSource } = this.options;

    // Substitute the file list into the init bundle once, before any hooks run
    const patchedInitSource = substituteFiles(initSource, files);

    // Wrap in IIFE to avoid symbol collisions (CJS bundle uses exports.X = ...)
    const wrappedInit = `(function(exports,module){${patchedInitSource}})({},{exports:{}});`;

    // Use webpack from the compiler's context — same instance Next.js uses
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const webpack = require('webpack') as typeof import('webpack');

    compiler.hooks.thisCompilation.tap(PLUGIN_NAME, (compilation: WebpackCompilation) => {
      compilation.hooks.processAssets.tap(
        {
          name: PLUGIN_NAME,
          stage: webpack.Compilation.PROCESS_ASSETS_STAGE_ADDITIONS,
        },
        () => {
          // Determine compilation target from compiler options
          const target = compiler.options.target;
          const isEdge = Array.isArray(target)
            ? target.some((t) => typeof t === 'string' && t.includes('webworker'))
            : typeof target === 'string' && target.includes('webworker');

          // Only inject into server-side compilations (not client bundles)
          const runtimeNames = isEdge ? EDGE_RUNTIME_ASSETS : SERVER_RUNTIME_ASSETS;

          for (const assetName of runtimeNames) {
            if (!compilation.getAsset(assetName)) continue;

            compilation.updateAsset(assetName, (origSource) => {
              const origSourceStr = origSource.source().toString();
              const updatedSourceStr = [wrappedInit, origSourceStr].join('\n');
              return new webpack.sources.RawSource(updatedSourceStr);
            });
          }
        },
      );
    });
  }
}
