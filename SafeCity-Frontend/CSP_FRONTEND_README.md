# PSCA CM Tehsils frontend CSP remediation — 26 October 2026

## Scope and build integrity
This archive contains the **entire supplied frontend ZIP**, including all original `src/`, `public/`, and `attached_assets/` files, plus the targeted CSP changes. No existing `src/api/*` module, backend, authentication flow, API route, or `src/Routes.tsx` source was changed.

The supplied ZIP **does not include** `package.json`, `vite.config.ts`, `index.html`, dependency lockfiles, or `node_modules`. Accordingly an actual Vite build and a browser regression test cannot be certified using this archive alone. Merge the updated source files into the original full frontend repository, then perform the local/staging tests below **before enabling enforcing CSP**. Security retest signoff must be made by PSCA Information Security / SysAdmin.

## Applied frontend changes

1. `src/components/ui/chart.tsx`: removed the generated `<style>` tag. Chart color custom properties are now set through the DOM style API; light and dark chart palettes remain supported by observing the chart's theme ancestors. Existing ref and user-provided `style` props are preserved.
2. `src/pages/ProjectManagement.tsx`: removed two inline `<style>` animation blocks and replaced the four wizard shimmer strips with `project-wizard-shimmer`. The same gradient, animation rate and positions are defined in `src/index.css`. No project creation/update, finance checkbox, data parsing, upload, or API code changed.
3. `src/components/dashboard/CityMap.tsx`: removed the literal `style` attribute from status marker HTML; marker dimensions/colors are now CSS classes, keeping delayed/pending/progress styling and animations. Project-name popup content is inserted as text rather than parsed HTML.
4. `src/components/dashboard/InstallationMap.tsx`: removed literal HTML `style` from completion markers, preserving size/colors and the thresholds at 40/60/80 percent. Other map functionality is untouched.
5. `src/components/dashboard/GanttChart2.jsx`: extracted the previously runtime-injected Gantt / PDF stylesheet into `src/components/dashboard/ganttChart2.css`, imported as bundled CSS. No Gantt logic or PDF/export logic changed.
6. `src/pages/MilestoneDetailsPanel.tsx` and `src/features/milestones/milestonePanelParts.tsx`: all ten instances of `document.write(...)` HTML image previews now invoke `src/lib/openDelayEvidenceImage.ts`, which opens the same black-background centered image using safe DOM creation and property-based styles, avoiding inline HTML/CSP violations.
7. `src/index.css`: added the wizard, Leaflet status and installation-marker CSS classes. All original CSS was preserved.

## Static checks performed
- All supplied original file paths are retained. Only the eight existing files above were changed; two source/css files and this README were added.
- All original `src/api/*` files and `src/Routes.tsx` are byte-identical to the upload.
- No remaining JSX `<style>` tags, literal marker `style="..."` strings, `document.write` image previews, or runtime `createElement("style")` injections in the supplied frontend source.
- All modified TS/TSX/JSX files parsed using the TypeScript transpilation parser. This checks syntax, **not** end-to-end TypeScript type checking, npm build, browser behavior or third-party library runtime style injections.

## Local staging verification (required)
1. Merge this `src/` into your complete application source, with package.json, vite.config.ts, and full dependencies. Install with the repository lockfile and run its normal build command.
2. Put the intended CSP in **Report-Only** mode *without* `unsafe-inline` in `style-src`, as requested in VULN-04. Configure staging Vite `preview` headers / nginx headers, not application API code. Vite preview port 5000 can proxy `/api`, `/media`, `/static`, and `/captcha` to Django 127.0.0.1:8000 where needed; keep the real project's existing proxy settings. Do **not** deploy report-only as the final CSP fix.
3. Exercise login/CAPTCHA/CSRF, dashboards, finance charts, comparison charts, create/edit project and financial checkboxes, XER/maps, GIS progress/status markers and popups, milestone images, date pickers, dropdowns/dialogs/toasts, document uploads, logout, and Gantt/PDF export. Collect DevTools Console violations with the page and triggering action.
4. Confirm the final `img-src` allows every legitimate image origin, **including ArcGIS World Imagery** (`https://server.arcgisonline.com`) used by `CityMap.tsx`, OSM tile subdomains, same-origin `/media`, data and blob images as applicable. In development, `mediaUrl` can use `http://localhost:8000`; use an appropriate proxy or specific *testing-only* allowance. Other origins must be based on observed requests and approved by security.
5. Third-party UI components (Radix/dialogs/selects, Recharts, Leaflet, toasts, PDF libraries) might dynamically inject styling that a code search cannot establish. Fix legitimate violations, or use a server-generated per-response nonce for runtime styles when required. Re-run under an **enforcing** CSP on staging before production promotion. Avoid permitting `unsafe-inline` as a workaround.
6. `Routes.tsx` defines: `/`, `/comparison`, `/finance`, `/gis`, `/settings`, `/project/:tehsil/:projectId`, `/auth`, `/province-management`, `/division-management`, `/district-management`, `/tehsil-management`, `/stakeholder-management`, `/project-management`, `/project-management/create`, `/project-management/view`, `/project-activity-management`, `/user-management`. `/login` is *not* in this supplied ZIP; agree any production `/login` redirect with SysAdmin. SysAdmin owns the restrictive nginx SPA fallback, enforcing CSP header and Django admin access restrictions.
7. After nginx changes, verify direct navigation and refresh of every legitimate route, HTTP 404 on invalid routes, and HTTP 403 on protected dotfiles. Keep authentication-cookie / CSRF and logout behavior unchanged and reverify in browser.

## Production warning
**Source edits are complete, but full VAPT closure and unchanged runtime UI cannot be guaranteed without compiling the complete repository and verifying the deployed CSP in a real browser.** No production nginx/Django configuration is included or modified here.
