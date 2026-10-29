import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { readFile, writeFile } from 'node:fs/promises';
const root = path.dirname(fileURLToPath(import.meta.url));
const out = path.resolve(root, '../../assets/live2d-pet');
for (const entry of ['pet', 'runtime']) {
  await build({
    entryPoints: [path.join(root, `${entry}.js`)],
    outfile: path.join(out, `${entry}.js`),
    bundle: true, minify: true, legalComments: 'linked',
    format: entry === 'runtime' ? 'esm' : 'iife', target: ['es2020'],
    loader: {'.css': 'text'},
  });
  // Normalize generated comment/shader whitespace for reviewable Git diffs.
  for(const file of [`${entry}.js`,`${entry}.js.LEGAL.txt`]){
    try {
      const target=path.join(out,file);
      await writeFile(target,(await readFile(target,'utf8')).replace(/[\t ]+$/gm,''));
    }catch(error){if(error.code!=='ENOENT')throw error;}
  }
}
