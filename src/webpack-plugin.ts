/**
 * DotenvxWebpackPlugin — injects resolved env vars into webpack runtime files.
 *
 * At build time, dotenvx has already decrypted the env files and provided the
 * key-value pairs. We serialize them into a compact Object.assign(process.env, {...})
 * snippet and prepend it to the webpack runtime so every value is available before
 * any user module code runs (before Prisma Pool, etc. can evaluate at import time).
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
  /** Resolved env key-value pairs from dotenvx.config() at build time */
  env: Record<string, string>;
}

export class DotenvxWebpackPlugin {
  private readonly options: DotenvxWebpackPluginOptions;

  constructor(options: DotenvxWebpackPluginOptions) {
    this.options = options;
  }

  apply(compiler: WebpackCompiler): void {
    const { env } = this.options;

    // Inline snippet: assign build-time-resolved values into process.env at runtime.
    // Wrapped in an IIFE to avoid any variable leakage into the runtime scope.
    const inlineSnippet = `(function(){if(typeof process!=='undefined'){Object.assign(process.env,${JSON.stringify(env)});}})();`;

    // Use webpack from the compiler's context — same instance Next.js uses
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const webpack = require('webpack') as typeof import('webpack');

    compiler.hooks.thisCompilation.tap(
      PLUGIN_NAME,
      (compilation: WebpackCompilation) => {
        compilation.hooks.processAssets.tap(
          {
            name: PLUGIN_NAME,
            stage: webpack.Compilation.PROCESS_ASSETS_STAGE_ADDITIONS,
          },
          () => {
            // Determine compilation target from compiler options
            const target = compiler.options.target;
            const isEdge = Array.isArray(target)
              ? target.some(
                  (t) => typeof t === 'string' && t.includes('webworker')
                )
              : typeof target === 'string' && target.includes('webworker');

            // Only inject into server-side compilations (not client bundles)
            const runtimeNames = isEdge
              ? EDGE_RUNTIME_ASSETS
              : SERVER_RUNTIME_ASSETS;

            for (const assetName of runtimeNames) {
              if (!compilation.getAsset(assetName)) continue;

              compilation.updateAsset(assetName, (origSource) => {
                const updatedSourceStr = [
                  inlineSnippet,
                  origSource.source().toString(),
                ].join('\n');
                return new webpack.sources.RawSource(updatedSourceStr);
              });
            }
          }
        );
      }
    );
  }
}
