import {build, context} from 'esbuild';
import {readFileSync, writeFileSync} from 'fs';
import path from 'path';

const isWatch = process.argv.includes('--watch');

const outdir = 'dist';

const shared = {
    bundle: true,
    sourcemap: !isWatch,
    minify: !isWatch,
    target: 'es2017',
    logLevel: 'info'
};

async function buildAll() {
    await build({
        ...shared,
        entryPoints: ['src/plugin.ts'],
        outfile: path.join(outdir, 'plugin.js'),
        platform: 'browser',
        minify: false  // Don't minify plugin code - Figma's parser is strict
    });
    await build({
        ...shared,
        entryPoints: ['src/ui/index.tsx'],
        outfile: path.join(outdir, 'ui.js'),
        platform: 'browser',
        target: 'es2015',  // Lower target for UI to ensure browser compatibility
        write: true  // Write the bundle file
    });

    // Read the generated JS to inline it
    const uiJs = readFileSync(path.join(outdir, 'ui.js'), 'utf8');

    // Inline JavaScript directly in HTML to avoid CSP issues
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<title>FigGit</title>
<style>
${readFileSync('src/ui/styles.css', 'utf8')}
</style>
</head>
<body>
<div id="root"></div>
<script>
window.addEventListener('error', function(e) {
  console.error('Error:', e.message, 'at', e.filename + ':' + e.lineno);
});
</script>
<script>
${uiJs}
</script>
</body>
</html>`;
    writeFileSync(path.join(outdir, 'ui.html'), html, 'utf8');
}

async function run() {
    if (!isWatch) {
        await buildAll();
        return;
    }
    const ctx = await context({
        ...shared,
        entryPoints: ['src/plugin.ts', 'src/ui/index.tsx'],
        outdir,
        platform: 'browser'
    });
    await ctx.watch();
    // Rebuild HTML & CSS on change (simple approach: watch manually not added here)
    console.log('Watching...');
}

run();
