// Run: node SECURITY_HANDOFF/run_static_checks.cjs
// Source-only checks. Does NOT validate backend, CSP enforcement or nginx behavior.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const load = relative => fs.readFileSync(path.join(root, relative), 'utf8');
const tests = [
  ['Cookie session mode', () => {
    assert.match(load('src/api/client.ts'), /credentials: "include"/);
    for (const file of ['src/api/client.ts','src/api/auth.ts','src/contexts/AuthContext.tsx']) {
      assert.doesNotMatch(load(file), /localStorage\.setItem\s*\(/);
      assert.doesNotMatch(load(file), /sessionStorage\.setItem\s*\(/);
    }
  }],
  ['Single-flight refresh and CSRF', () => {
    assert.match(load('src/api/client.ts'), /let refreshPromise:/);
    assert.match(load('src/api/client.ts'), /await refreshSession\(\)/);
    assert.match(load('src/api/client.ts'), /X-CSRFToken/);
  }],
  ['Logout confirmation and cache clearing', () => {
    assert.match(load('src/contexts/AuthContext.tsx'), /if \(!confirmed\) return false/);
    assert.match(load('src/contexts/AuthContext.tsx'), /queryClient\.clear\(\)/);
  }],
  ['Structured errors from requestRaw', () => {
    assert.match(load('src/api/client.ts'), /throw new ApiError\(message, res.status, isEnvelope \? json.data : json\)/);
  }],
  ['No localhost XER download fallback', () => {
    assert.match(load('src/pages/ProjectManagement.tsx'), /href=\{mediaUrl\(selectedProjectForView\.xer_file\)\}/);
  }],
  ['Leaflet CSS is bundled', () => {
    assert.match(load('src/main.tsx'), /leaflet\/dist\/leaflet\.css/);
    assert.doesNotMatch(load('index.html'), /unpkg\.com\/leaflet/);
  }],
  ['No unreviewed spreadsheets/schedules in Vite public root', () => {
    function walk(dir) {
      for (const item of fs.readdirSync(dir,{withFileTypes:true})) {
        const f=path.join(dir,item.name);
        if(item.isDirectory())walk(f);
        else assert(!/\.(xlsx?|pptx?|xer|zip|bak|db|json)$/i.test(item.name), `Unreviewed public artifact: ${f}`);
      }
    }
    walk(path.join(root,'public'));
  }],
  ['Authoritative route inventory exists', () => {
    const routes=JSON.parse(load('SECURITY_HANDOFF/spa_routes.json')).routes;
    assert(routes.includes('/project-management/create'));
    assert(routes.includes('/project/:tehsil/:projectId'));
  }],
];
let errors=0;
for (const [name,fn] of tests) {
  try { fn();console.log('PASS',name); } catch(e) {errors++;console.error('FAIL',name,e.message);}
}
console.log(`${tests.length-errors}/${tests.length} source checks passed`);
if(errors)process.exitCode=1;
