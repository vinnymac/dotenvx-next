import { describe, expect, it } from 'vitest';
import { DotenvxWebpackPlugin } from './webpack-plugin.js';

type FakeAsset = { source: () => string };

const ORIGINAL = 'ORIGINAL_RUNTIME_CODE;';
const SNIPPET_GUARD = "if(typeof process!=='undefined')";

/**
 * Run the plugin against a minimal structural mock of the webpack compiler and
 * return a map of asset name -> final source string. Uses the real `webpack`
 * package (a devDependency) for `sources.RawSource` and the
 * PROCESS_ASSETS_STAGE_ADDITIONS constant the plugin reads.
 */
function runPlugin(
  assetNames: string[],
  env: Record<string, string>
): Map<string, string> {
  const assets = new Map<string, FakeAsset>(
    assetNames.map((name) => [name, { source: () => ORIGINAL }])
  );

  const compilation = {
    hooks: {
      processAssets: {
        tap: (_options: unknown, callback: () => void): void => callback(),
      },
    },
    getAsset: (name: string): FakeAsset | undefined => assets.get(name),
    updateAsset: (
      name: string,
      updater: (source: FakeAsset) => FakeAsset
    ): void => {
      const current = assets.get(name);
      if (!current) return;
      const next = updater(current);
      assets.set(name, { source: () => next.source().toString() });
    },
  };

  const compiler = {
    options: {},
    hooks: {
      thisCompilation: {
        tap: (_name: string, callback: (c: typeof compilation) => void): void =>
          callback(compilation),
      },
    },
  };

  new DotenvxWebpackPlugin({ env }).apply(
    compiler as unknown as import('webpack').Compiler
  );

  return new Map([...assets].map(([name, asset]) => [name, asset.source()]));
}

describe('DotenvxWebpackPlugin', () => {
  it('injects env into the edge runtime asset', () => {
    const src = runPlugin(['edge-runtime-webpack.js'], { SECRET: 'shh' }).get(
      'edge-runtime-webpack.js'
    );
    expect(src).toContain('Object.assign(process.env,{"SECRET":"shh"})');
    expect(src).toContain(SNIPPET_GUARD);
    // snippet is prepended, with the original runtime code preserved after it
    expect(src).toContain(ORIGINAL);
    expect(src?.indexOf('Object.assign')).toBeLessThan(
      src?.indexOf(ORIGINAL) ?? -1
    );
  });

  it('injects env into the server runtime asset', () => {
    expect(runPlugin(['webpack-runtime.js'], { API_KEY: 'k' })).toMatchObject(
      new Map([
        [
          'webpack-runtime.js',
          expect.stringContaining('Object.assign(process.env,{"API_KEY":"k"})'),
        ],
      ])
    );
  });

  it('injects into both server and edge assets when both are emitted', () => {
    const out = runPlugin(['webpack-runtime.js', 'edge-runtime-webpack.js'], {
      A: '1',
    });
    for (const name of ['webpack-runtime.js', 'edge-runtime-webpack.js']) {
      expect(out.get(name)).toContain('Object.assign(process.env,{"A":"1"})');
    }
  });

  it('leaves assets a compilation does not emit untouched (e.g. client bundles)', () => {
    const out = runPlugin(['static/chunks/main-app.js'], { SECRET: 'shh' });
    expect(out.get('static/chunks/main-app.js')).toBe(ORIGINAL);
  });

  it('injects only once even though webpack-runtime.js is a target for both runtimes', () => {
    const src =
      runPlugin(['webpack-runtime.js'], { A: '1' }).get('webpack-runtime.js') ??
      '';
    expect(src.split('Object.assign(process.env,')).toHaveLength(2);
  });

  it('serializes env values safely (quotes and newlines)', () => {
    const value = 'a"b\nc';
    const src = runPlugin(['webpack-runtime.js'], { WEIRD: value }).get(
      'webpack-runtime.js'
    );
    expect(src).toContain(JSON.stringify({ WEIRD: value }));
  });
});
