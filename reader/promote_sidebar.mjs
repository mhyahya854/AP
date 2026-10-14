// Guarded promotion of the sidebar-wave build.
//
// The old artifact is moved (never deleted) into a dated backup directory, the
// verified staged file is copied to a sibling temp file, that copy is hashed,
// and only then is it renamed over the artifact.  The report records both
// hashes, so the promotion can be re-checked later without trusting this run.
//
// Usage:
//   node reader/promote_sidebar.mjs --source <staged.html> --target <final.html>
//     --expect-source-sha <sha256> --expect-target-sha <sha256>
//     --backup-dir <dir> --report <file>
import { createReadStream, copyFileSync, mkdirSync, renameSync, statSync, writeFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { basename, join, resolve } from 'node:path';

const arg = (name) => { const i = process.argv.indexOf('--' + name); return i >= 0 ? process.argv[i + 1] : null; };
const source = resolve(arg('source'));
const target = resolve(arg('target'));
const backupDir = resolve(arg('backup-dir'));
const reportPath = resolve(arg('report'));
const expectSource = arg('expect-source-sha');
const expectTarget = arg('expect-target-sha');
if (!source || !target || !backupDir || !reportPath || !expectSource || !expectTarget) {
  console.error('missing argument; see the header of this file');
  process.exit(2);
}

async function sha256(path) {
  const h = createHash('sha256');
  for await (const chunk of createReadStream(path)) h.update(chunk);
  return h.digest('hex');
}

const sourceSha = await sha256(source);
const targetSha = await sha256(target);
if (sourceSha !== expectSource) { console.error(`staged hash ${sourceSha} != ${expectSource}`); process.exit(1); }
if (targetSha !== expectTarget) { console.error(`artifact hash ${targetSha} != ${expectTarget}`); process.exit(1); }

mkdirSync(backupDir, { recursive: true });
const backup = join(backupDir, 'prev-final-' + basename(target));
if (!existsSync(backup)) {
  renameSync(target, backup);                     // the previous artifact is preserved, not deleted
} else if (await sha256(backup) !== targetSha) {
  console.error('a different backup already exists: ' + backup);
  process.exit(1);
} else {
  renameSync(target, backup + '.replaced');
}
if (await sha256(backup) !== targetSha) { console.error('backup hash mismatch'); process.exit(1); }

const tmp = target + '.promoting';
copyFileSync(source, tmp);
if (await sha256(tmp) !== sourceSha) { console.error('staged copy does not match'); process.exit(1); }
renameSync(tmp, target);

const finalSha = await sha256(target);
const report = {
  promoted_at_utc: new Date().toISOString(),
  staged: source, staged_sha256: sourceSha,
  previous: backup, previous_sha256: targetSha,
  promoted: target, promoted_sha256: finalSha,
  promoted_bytes: statSync(target).st_size,
  byte_identical_to_staged: finalSha === sourceSha,
};
writeFileSync(reportPath, JSON.stringify(report, null, 1));
console.log(JSON.stringify(report, null, 1));
if (finalSha !== sourceSha) { console.error('promotion hash mismatch'); process.exit(1); }
