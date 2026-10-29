// LAST SEAT TEST: N youth apply to a 1-seat program at the SAME moment.
// Expected: exactly 1 x 201 Created, (N-1) x 409 "No seats left", availableSeats = 0, never negative.
// Usage:  npm run test:last-seat            (default 20 youth)
//         node scripts/last-seat-test.mjs 25
const BASE = process.env.API_URL ?? 'http://localhost:3001/api';
const N = Math.min(Number(process.argv[2] ?? 20), 30); // seed has 30 youth accounts

async function call(method, path, token, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, body: await res.json().catch(() => null) };
}

const login = async (email, password) => (await call('POST', '/auth/login', null, { email, password })).body.accessToken;

// 1. fresh program with exactly 1 seat (created by a supervisor)
const supToken = await login('supervisor2@sanad.org', 'Super@1234');
const program = (
  await call('POST', '/programs', supToken, {
    title: `Last Seat Race ${new Date().toLocaleTimeString()}`,
    description: 'One seat, many applicants, at the same time.',
    capacity: 1,
  })
).body;
console.log(`\nProgram #${program.id} created with capacity=1\n`);

// 2. log in N different youth (in parallel)
const tokens = await Promise.all(Array.from({ length: N }, (_, i) => login(`youth${i + 1}@sanad.org`, 'Youth@1234')));

// 3. FIRE: all N apply at the same instant
const t0 = Date.now();
const results = await Promise.all(
  tokens.map((t, i) => call('POST', `/programs/${program.id}/applications`, t).then((r) => ({ youth: `youth${i + 1}`, ...r }))),
);
const ms = Date.now() - t0;

// 4. report
const created = results.filter((r) => r.status === 201);
const conflicts = results.filter((r) => r.status === 409);
console.table(results.map((r) => ({ youth: r.youth, status: r.status, message: r.body?.message ?? `application #${r.body?.id}` })));

const after = (await call('GET', `/programs/${program.id}`, supToken)).body;
console.log(`${N} requests in ${ms}ms`);
console.log(`201 Created : ${created.length}   (expected 1)`);
console.log(`409 Conflict: ${conflicts.length}   (expected ${N - 1})`);
console.log(`availableSeats after race: ${after.availableSeats}   (expected 0)`);

const ok = created.length === 1 && conflicts.length === N - 1 && after.availableSeats === 0;
console.log(ok ? '\n✅ PASS - no overbooking, every applicant got a clear answer\n' : '\n❌ FAIL\n');

// 5. bonus: winner cancels -> the seat comes back -> someone else can take it
const winnerToken = tokens[results.indexOf(created[0])];
await call('PATCH', `/applications/${created[0].body.id}/cancel`, winnerToken);
const afterCancel = (await call('GET', `/programs/${program.id}`, supToken)).body;
console.log(`Winner cancelled -> availableSeats = ${afterCancel.availableSeats} (expected 1)`);
process.exit(ok ? 0 : 1);
