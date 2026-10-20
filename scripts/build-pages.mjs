// Builds the web app for GitHub Pages (https://enhow1108.github.io/book-app/) into dist/.
// Pages serves static files under /book-app, so the build is a single-page app with that base path
// rather than the server output app.json asks for (which the ISBN lookup server on EAS Hosting needs).
// app.json is changed only for the build and put back afterwards.
import { execSync } from 'node:child_process';
import { copyFileSync, readFileSync, writeFileSync } from 'node:fs';

const original = readFileSync('app.json', 'utf8');
const config = JSON.parse(original);
config.expo.web.output = 'single';
config.expo.experiments.baseUrl = '/book-app';

writeFileSync('app.json', JSON.stringify(config, null, 2) + '\n');
try {
  execSync('npx expo export --platform web --clear', { stdio: 'inherit' });
} finally {
  writeFileSync('app.json', original);
}
// Pages answers unknown paths (a reload on /book-app/history) with 404.html, so it gets the app too.
copyFileSync('dist/index.html', 'dist/404.html');
writeFileSync('dist/.nojekyll', '');
