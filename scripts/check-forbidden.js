// CI guard: session-level tenant context and unsafe raw SQL are forbidden.
// Full tenant-context enforcement is added in Phase 2.
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..', 'src');
const FORBIDDEN = [
  { label: 'session-level SET app.', pattern: /\bSET\s+app\./i },
  { label: '$queryRawUnsafe', pattern: /\$queryRawUnsafe\s*\(/ },
];

function* tsFiles(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== 'generated') yield* tsFiles(target);
    } else if (entry.name.endsWith('.ts')) {
      yield target;
    }
  }
}

const violations = [];
for (const file of tsFiles(ROOT)) {
  const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
  lines.forEach((line, index) => {
    for (const { label, pattern } of FORBIDDEN) {
      if (pattern.test(line)) {
        violations.push(`${path.relative(path.join(ROOT, '..'), file)}:${index + 1} ${label}`);
      }
    }
  });
}

if (violations.length > 0) {
  process.stderr.write(`Forbidden patterns found:\n${violations.join('\n')}\n`);
  process.exit(1);
}
process.stdout.write('No forbidden tenant-context or raw-SQL patterns found.\n');
