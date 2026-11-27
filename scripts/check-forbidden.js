// CI guard for tenant-context rules (ARCHITECTURE §8.3, §29).
// Tenant tables are reachable only through TenantDb with transaction-local
// context; session-level SET, unsafe raw SQL and direct client access are banned.
const fs = require('node:fs');
const path = require('node:path');

const DEFAULT_ROOT = path.join(__dirname, '..', 'src');
const TENANT_DB = 'infrastructure/database/tenant-db.ts';
const DATABASE_DIR = 'infrastructure/database/';
const ERROR_MAPPER = 'common/errors/prisma-error.mapper.ts';

/**
 * Each rule has a regex and an optional file predicate (`allow` = true means
 * the file is exempt). Paths are relative to src with forward slashes.
 */
const RULES = [
  { label: 'session-level SET app.', pattern: /\bSET\s+app\./i },
  { label: '$queryRawUnsafe', pattern: /\$queryRawUnsafe\s*\(/ },
  { label: '$executeRawUnsafe', pattern: /\$executeRawUnsafe\s*\(/ },
  {
    label: 'set_config() outside TenantDb',
    pattern: /\bset_config\s*\(/i,
    allow: (file) => file === TENANT_DB,
  },
  {
    label: 'generated Prisma client import outside the database/error layer',
    pattern: /(?:from\s+['"][^'"]*generated\/prisma|require\(['"][^'"]*generated\/prisma)/,
    allow: (file) => file.startsWith(DATABASE_DIR) || file === ERROR_MAPPER,
  },
  {
    label: 'raw SQL outside the database layer',
    pattern: /\$(queryRaw|executeRaw)\s*[`(<]/,
    allow: (file) => file.startsWith(DATABASE_DIR),
  },
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

function scan(root = DEFAULT_ROOT) {
  const violations = [];
  for (const file of tsFiles(root)) {
    const relative = path.relative(root, file).split(path.sep).join('/');
    const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
    lines.forEach((line, index) => {
      for (const rule of RULES) {
        if (rule.allow?.(relative)) continue;
        if (rule.pattern.test(line)) {
          violations.push(
            `${path.relative(path.join(root, '..'), file)}:${index + 1} ${rule.label}`,
          );
        }
      }
    });
  }
  return violations;
}

module.exports = { scan, RULES };

if (require.main === module) {
  const violations = scan();
  if (violations.length > 0) {
    process.stderr.write(`Forbidden patterns found:\n${violations.join('\n')}\n`);
    process.exit(1);
  }
  process.stdout.write('No forbidden tenant-context or raw-SQL patterns found.\n');
}
