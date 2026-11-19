// Opt-in live check: creates two temporary test accounts and one staff knowledge entry.
// Uses only the selected Supabase project, makes no Koha/AI requests, and cleans up in finally.
// Run with npm run smoke:knowledge after setting the existing server .env variables.
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { ConfigService } = require('@nestjs/config');
const { KnowledgeService } = require('../dist/knowledge/knowledge.service.js');
const { LibrarianGuard } = require('../dist/shared/librarian.guard.js');
const url = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const temporaryUsers = [];
const temporaryEntries = [];
const temporaryEntryOwners = [];
let failed = false;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

// Error messages deliberately exclude credentials, response bodies and personal records.
async function call(path, { token = key, method = 'GET', body, prefer } = {}) {
  let response;
  try {
    response = await fetch(url + path, {
      method, signal: AbortSignal.timeout(15000),
      headers: { apikey: key, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json',
        ...(prefer ? { Prefer: prefer } : {}) },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
  } catch (error) {
    throw new Error(`Supabase connection failed (${error.cause?.code || error.name}).`);
  }
  const text = await response.text();
  let data = null;
  if (text) {
    try { data = JSON.parse(text); } catch { throw new Error(`Supabase returned a non-JSON response (HTTP ${response.status}).`); }
  }
  return { ok: response.ok, status: response.status, data };
}

async function successfulCall(path, options) {
  const result = await call(path, options);
  assert(result.ok, `Supabase operation failed (HTTP ${result.status}).`);
  return result.data;
}

async function testAccount(label) {
  const email = `lira-smoke-${label}-${randomUUID()}@example.invalid`;
  const password = `Lira-smoke-${randomUUID()}-A1!`;
  const user = await successfulCall('/auth/v1/admin/users', { method: 'POST', body: {
    email, password, email_confirm: true,
    user_metadata: { full_name: 'LIRA Smoke Test', first_name: 'LIRA', last_name: 'Smoke Test', school: 'TEST ONLY' },
  } });
  assert(user?.id, 'Temporary account creation did not return an ID.');
  temporaryUsers.push(user.id);
  if (label === 'librarian') {
    const profiles = await successfulCall(`/rest/v1/profiles?id=eq.${user.id}&select=role`, {
      method: 'PATCH', body: { role: 'librarian' }, prefer: 'return=representation',
    });
    assert(profiles?.[0]?.role === 'librarian', 'Could not assign the temporary librarian role.');
  }
  const session = await successfulCall('/auth/v1/token?grant_type=password', { method: 'POST', body: { email, password } });
  assert(session?.access_token, 'Temporary account sign-in failed.');
  return { id: user.id, token: session.access_token };
}

function context(token) {
  const request = { headers: token ? { authorization: `Bearer ${token}` } : {} };
  return { request, execution: { switchToHttp: () => ({ getRequest: () => request }) } };
}

async function expectStatus(action, expected, message) {
  try { await action(); } catch (error) {
    assert(error.getStatus?.() === expected, message);
    return;
  }
  throw new Error(message);
}

async function main() {
  assert(url && key, 'Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the ignored backend .env file first.');
  const parsed = new URL(url);
  assert(parsed.protocol === 'https:' && !parsed.username && !parsed.password, 'SUPABASE_URL must be an HTTPS URL without credentials.');
  assert(parsed.pathname === '/' && !parsed.search && !parsed.hash, 'SUPABASE_URL must be a project origin.');

  // Check schema connectivity before creating test data.
  await successfulCall('/rest/v1/librarian_knowledge_entries?select=id,kind,category,title,content,source_url,created_at,updated_at&limit=0');
  console.log('PASS knowledge schema reachable');

  const config = new ConfigService({ app: { semantic: { supabaseUrl: url, supabaseServiceRoleKey: key } } });
  const guard = new LibrarianGuard(config);
  const storage = new KnowledgeService(config);
  const student = await testAccount('student');
  const librarian = await testAccount('librarian');

  const elevation = await call(`/rest/v1/profiles?id=eq.${student.id}`, {
    token: student.token, method: 'PATCH', body: { role: 'librarian' },
  });
  // Restore even if the protection is missing; only this newly created account is touched.
  if (elevation.ok) await successfulCall(`/rest/v1/profiles?id=eq.${student.id}`, { method: 'PATCH', body: { role: 'student' } });
  assert(elevation.status === 403 && elevation.data?.code === '42501', 'Profile role protection failed: expected permission denied.');
  const profile = await successfulCall(`/rest/v1/profiles?id=eq.${student.id}&select=role`, { token: student.token });
  assert(profile?.[0]?.role === 'student', 'The student role changed unexpectedly.');
  console.log('PASS authenticated users cannot elevate their profile role');

  for (const account of [student, librarian]) {
    const direct = await call('/rest/v1/librarian_knowledge_entries?select=id&limit=0', { token: account.token });
    assert(direct.status === 403, 'A browser role has direct knowledge-table access.');
  }
  console.log('PASS direct knowledge-table access is denied to browser roles');

  await expectStatus(() => guard.canActivate(context().execution), 401, 'Missing sessions were not rejected.');
  await expectStatus(() => guard.canActivate(context(student.token).execution), 403, 'Student access was not rejected.');
  const staff = context(librarian.token);
  assert(await guard.canActivate(staff.execution), 'Librarian authorization failed.');
  assert(staff.request.librarianUser?.id === librarian.id, 'Librarian attribution was not verified.');
  console.log('PASS actual librarian guard with real Supabase sessions');

  const input = { kind: 'faq', category: 'hours', title: `TEST ONLY: FAQ smoke ${randomUUID()}`,
    content: 'Temporary automated verification. This is not library guidance.', sourceUrl: null };
  temporaryEntryOwners.push(librarian.id);
  const created = await storage.create(input, librarian.id);
  temporaryEntries.push(created.id);
  assert(created.title === input.title && created.content === input.content, 'Created content did not match.');
  const attribution = await successfulCall(`/rest/v1/librarian_knowledge_entries?id=eq.${created.id}&select=created_by,updated_by`);
  assert(attribution?.[0]?.created_by === librarian.id && attribution[0].updated_by === librarian.id, 'Stored attribution did not match the verified librarian.');
  const firstRead = await storage.list(1, 100);
  assert(firstRead.items.some((entry) => entry.id === created.id), 'Created entry was not found on readback.');
  console.log('PASS FAQ create, attribution and persisted readback');

  const edited = await storage.update(created.id, { ...input, kind: 'policy', category: 'rules',
    content: 'Temporary edited policy used only for verification.', expectedUpdatedAt: created.updatedAt }, librarian.id);
  assert(edited.updatedAt !== created.updatedAt, 'The update timestamp trigger did not advance.');
  assert(edited.createdAt === created.createdAt, 'Editing unexpectedly changed the creation timestamp.');
  const secondRead = await storage.list(1, 100);
  const persisted = secondRead.items.find((entry) => entry.id === created.id);
  assert(persisted?.content === edited.content && persisted.kind === 'policy' && persisted.category === 'rules', 'Edited policy did not persist.');
  console.log('PASS policy edit, update trigger and persisted readback');

  await expectStatus(() => storage.update(created.id, { ...input, expectedUpdatedAt: created.updatedAt }, librarian.id), 409, 'A stale edit was not rejected.');
  console.log('PASS stale edits are rejected');
}

try { await main(); } catch (error) {
  failed = true;
  console.error(`FAIL ${error.message}`);
} finally {
  // Recover a write whose response was lost, scoped only to this run's new test accounts.
  for (const ownerId of temporaryEntryOwners) {
    try {
      const rows = await successfulCall(`/rest/v1/librarian_knowledge_entries?created_by=eq.${ownerId}&select=id`);
      for (const row of rows) if (!temporaryEntries.includes(row.id)) temporaryEntries.push(row.id);
    } catch (error) { failed = true; console.error(`CLEANUP DISCOVERY FAILED for temporary account ${ownerId}: ${error.message}`); }
  }
  // Delete exact IDs only, never unrelated library data or pre-existing accounts.
  for (const id of temporaryEntries) {
    try {
      await successfulCall(`/rest/v1/librarian_knowledge_entries?id=eq.${id}`, { method: 'DELETE' });
      const remaining = await successfulCall(`/rest/v1/librarian_knowledge_entries?id=eq.${id}&select=id`);
      assert(remaining?.length === 0, 'The temporary entry remains after cleanup.');
    } catch (error) { failed = true; console.error(`CLEANUP FAILED for temporary entry ${id}: ${error.message}`); }
  }
  for (const id of temporaryUsers.reverse()) {
    try { await successfulCall(`/auth/v1/admin/users/${id}`, { method: 'DELETE' }); }
    catch (error) { failed = true; console.error(`CLEANUP FAILED for temporary account ${id}: ${error.message}`); }
  }
}
if (temporaryEntries.length || temporaryUsers.length) console.log(failed ? 'Review any cleanup errors above.' : 'PASS temporary accounts and entry cleaned up');
if (!failed) console.log('PASS live storage/role smoke check; browser rendering and HTTP routing require separate checks.');
process.exitCode = failed ? 1 : 0;
