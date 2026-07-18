import esbuild from 'esbuild';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const result = await esbuild.build({
    entryPoints: [path.join(root, 'scripts', 'embedded-views-regression.ts')],
    bundle: true,
    platform: 'node',
    format: 'cjs',
    write: false,
    plugins: [{ name: 'obsidian-test-stub', setup(build) {
        build.onResolve({ filter: /^obsidian$/ }, () => ({ path: path.join(root, 'scripts', 'obsidian-test-stub.ts') }));
    }}],
});
const require = createRequire(import.meta.url);
const module = { exports: {} };
new Function('require', 'module', 'exports', result.outputFiles[0].text)(require, module, module.exports);

