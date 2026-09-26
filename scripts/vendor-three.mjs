// 把網站需要的 three.js 檔案複製到 vendor/，讓整個資料夾可直接放上任何靜態網站主機。
// 更新 three.js 版本後執行：npm run vendor
import fs from 'node:fs';
import path from 'node:path';

const src = 'node_modules/three';
const out = 'vendor/three';
const files = [
  ['build/three.module.min.js', 'three.module.js'],
  ...['EffectComposer', 'RenderPass', 'UnrealBloomPass', 'ShaderPass', 'OutputPass', 'Pass', 'MaskPass']
    .map(n => [`examples/jsm/postprocessing/${n}.js`, `addons/postprocessing/${n}.js`]),
  ...['CopyShader', 'LuminosityHighPassShader', 'OutputShader', 'HorizontalTiltShiftShader', 'VerticalTiltShiftShader']
    .map(n => [`examples/jsm/shaders/${n}.js`, `addons/shaders/${n}.js`]),
];
fs.rmSync(out, { recursive: true, force: true });
for (const [from, to] of files) {
  fs.mkdirSync(path.dirname(path.join(out, to)), { recursive: true });
  fs.copyFileSync(path.join(src, from), path.join(out, to));
}
fs.copyFileSync(path.join(src, 'LICENSE'), path.join(out, 'LICENSE'));
console.log(`copied ${files.length} files to ${out}`);
