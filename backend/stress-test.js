/**
 * Pawmilya Full Application Stress Test
 *
 * Comprehensive stress test covering ALL API endpoints:
 *  - Public endpoints (pets, shelters, rescues, health)
 *  - Authenticated user endpoints (profile, favorites, notifications, adoptions)
 *  - Admin endpoints (dashboard, pets CRUD, users CRUD, adoptions, rescues)
 *  - Shelter manager endpoints
 *  - Auth flow stress (login, register, OTP, password reset)
 *  - Rate limit verification on all limited routes
 *  - Connection stress & sustained load
 *  - Large payload handling
 *  - Database connection pool exhaustion
 *  - Memory leak detection
 *  - Mixed concurrent workload simulation
 *
 * Usage:
 *   node stress-test.js [options]
 *
 * Options:
 *   --base-url=URL     Server URL (default: http://localhost:3000)
 *   --admin-email=E    Admin email for auth tests
 *   --admin-pass=P     Admin password for auth tests
 *   --user-email=E     Regular user email for auth tests
 *   --user-pass=P      Regular user password for auth tests
 *   --quick            Run a shorter version of the test
 *   --skip-auth        Skip authenticated endpoint tests
 */

const http = require('http');
const https = require('https');

// ─── Configuration ───────────────────────────────────────────
function getArg(name, fallback) {
  const flag = process.argv.find(a => a.startsWith(`--${name}=`));
  if (flag) return flag.split('=').slice(1).join('=');
  const idx = process.argv.indexOf(`--${name}`);
  if (idx !== -1 && process.argv[idx + 1] && !process.argv[idx + 1].startsWith('--')) return process.argv[idx + 1];
  return fallback;
}

const BASE_URL          = getArg('base-url', 'http://localhost:3000');
const ADMIN_EMAIL       = getArg('admin-email', '');
const ADMIN_PASS        = getArg('admin-pass', '');
const USER_EMAIL        = getArg('user-email', '');
const USER_PASS         = getArg('user-pass', '');
const QUICK_MODE        = process.argv.includes('--quick');
const SKIP_AUTH         = process.argv.includes('--skip-auth');

const CONCURRENCY_LEVELS = QUICK_MODE ? [10, 50] : [10, 50, 100, 250, 500];
const REQUESTS_PER_USER  = QUICK_MODE ? 3 : 5;
const REQUEST_TIMEOUT_MS = 15000;
const SUSTAINED_DURATION = QUICK_MODE ? 10 : 30;
const SUSTAINED_RPS      = QUICK_MODE ? 15 : 40;

// ─── State ───────────────────────────────────────────────────
let userToken = null;
let adminToken = null;
let testStartTime = null;
const allIssues = [];
const sectionResults = {};

// ─── Helpers ─────────────────────────────────────────────────
const parsedBase = new URL(BASE_URL);
const isHttps = parsedBase.protocol === 'https:';
const httpModule = isHttps ? https : http;

const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  bgRed: '\x1b[41m',
  bgGreen: '\x1b[42m',
  bgYellow: '\x1b[43m',
  bgBlue: '\x1b[44m',
};

function c(color, text) { return `${colors[color]}${text}${colors.reset}`; }

function makeRequest(method, path, body = null, headers = {}) {
  return new Promise((resolve) => {
    const start = Date.now();
    const url = new URL(path, BASE_URL);

    const payload = body ? JSON.stringify(body) : null;

    const options = {
      hostname: url.hostname,
      port: url.port || (isHttps ? 443 : 80),
      path: url.pathname + url.search,
      method,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}),
        ...headers,
      },
      timeout: REQUEST_TIMEOUT_MS,
    };

    const req = httpModule.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        let parsed = null;
        try { parsed = JSON.parse(data); } catch {}
        resolve({
          status: res.statusCode,
          latency: Date.now() - start,
          size: Buffer.byteLength(data),
          data: parsed,
          error: null,
        });
      });
    });

    req.on('error', (err) => {
      resolve({ status: 0, latency: Date.now() - start, size: 0, data: null, error: err.code || err.message });
    });

    req.on('timeout', () => {
      req.destroy();
      resolve({ status: 0, latency: Date.now() - start, size: 0, data: null, error: 'TIMEOUT' });
    });

    if (payload) req.write(payload);
    req.end();
  });
}

function authHeaders(token) {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// ─── Stats Calculator ────────────────────────────────────────
function calculateStats(results) {
  if (!results || results.length === 0) return null;

  const latencies = results.map(r => r.latency).sort((a, b) => a - b);
  const statuses = {};
  let errors = 0;
  let totalSize = 0;

  for (const r of results) {
    if (r.error) errors++;
    const key = r.status || 'ERR';
    statuses[key] = (statuses[key] || 0) + 1;
    totalSize += r.size;
  }

  const total = results.length;
  return {
    total,
    errors,
    errorRate: ((errors / total) * 100).toFixed(1) + '%',
    successRate: (((total - errors) / total) * 100).toFixed(1) + '%',
    statuses,
    latency: {
      min: latencies[0],
      max: latencies[latencies.length - 1],
      mean: Math.round(latencies.reduce((a, b) => a + b, 0) / total),
      median: latencies[Math.floor(total / 2)],
      p90: latencies[Math.floor(total * 0.90)],
      p95: latencies[Math.floor(total * 0.95)],
      p99: latencies[Math.floor(total * 0.99)],
    },
    throughput: {
      totalBytes: totalSize,
      avgBytesPerReq: Math.round(totalSize / total),
      reqPerSec: total > 0 ? Math.round(total / (latencies[latencies.length - 1] / 1000) * 10) / 10 : 0,
    },
  };
}

function formatStatusLine(name, stats, nameWidth = 40) {
  const s = stats;
  const statusStr = Object.entries(s.statuses).map(([k, v]) => `${k}:${v}`).join(' ');
  return (
    `  ${name.padEnd(nameWidth)} | ` +
    `${String(s.total).padStart(5)} reqs | ` +
    `${String(s.latency.mean).padStart(5)}ms avg | ` +
    `${String(s.latency.p95).padStart(5)}ms p95 | ` +
    `${String(s.latency.max).padStart(5)}ms max | ` +
    `err ${s.errorRate.padStart(5)} | ${statusStr}`
  );
}

function sectionHeader(title) {
  console.log(`\n${c('cyan', '═'.repeat(80))}`);
  console.log(`  ${c('bold', title)}`);
  console.log(c('cyan', '═'.repeat(80)));
}

function subsectionHeader(title) {
  console.log(`\n  ${c('dim', '─── ' + title + ' ───')}`);
}

// ─── Endpoint Definitions ────────────────────────────────────
const PUBLIC_ENDPOINTS = [
  // Pets
  { method: 'GET', path: '/api/pets',                       name: 'GET /api/pets' },
  { method: 'GET', path: '/api/pets?limit=50&offset=0',     name: 'GET /api/pets (paginated)' },
  { method: 'GET', path: '/api/pets?category=1',            name: 'GET /api/pets (by category)' },
  { method: 'GET', path: '/api/pets?gender=male&size=medium', name: 'GET /api/pets (filtered)' },
  { method: 'GET', path: '/api/pets/featured',              name: 'GET /api/pets/featured' },
  { method: 'GET', path: '/api/pets/categories',            name: 'GET /api/pets/categories' },
  { method: 'GET', path: '/api/pets/breeds/1',              name: 'GET /api/pets/breeds/:catId' },
  { method: 'GET', path: '/api/pets/search?name=dog',       name: 'GET /api/pets/search (name)' },
  { method: 'GET', path: '/api/pets/search?category=1&size=small', name: 'GET /api/pets/search (multi)' },
  // Shelters
  { method: 'GET', path: '/api/shelters',                   name: 'GET /api/shelters' },
  { method: 'GET', path: '/api/shelters?limit=50',          name: 'GET /api/shelters (paginated)' },
  { method: 'GET', path: '/api/shelters/nearby?latitude=14.5995&longitude=120.9842&radius=25', name: 'GET /api/shelters/nearby' },
  // Rescues
  { method: 'GET', path: '/api/rescue-reports',             name: 'GET /api/rescue-reports' },
  { method: 'GET', path: '/api/rescue-reports?status=pending', name: 'GET /api/rescue-reports (status)' },
  { method: 'GET', path: '/api/rescue-reports?urgency=high', name: 'GET /api/rescue-reports (urgency)' },
  { method: 'GET', path: '/api/rescue-reports/stats',       name: 'GET /api/rescue-reports/stats' },
  // Health
  { method: 'GET', path: '/api/health',                     name: 'GET /api/health' },
  { method: 'GET', path: '/api/health/detailed',            name: 'GET /api/health/detailed' },
  { method: 'GET', path: '/api/health/ready',               name: 'GET /api/health/ready' },
  { method: 'GET', path: '/api/health/live',                name: 'GET /api/health/live' },
  { method: 'GET', path: '/api/health/stats',               name: 'GET /api/health/stats' },
  { method: 'GET', path: '/api/health/metrics',             name: 'GET /api/health/metrics' },
  // Root
  { method: 'GET', path: '/',                               name: 'GET / (root)' },
];

const USER_ENDPOINTS = [
  { method: 'GET',  path: '/api/users/profile',                       name: 'GET /users/profile' },
  { method: 'GET',  path: '/api/users/status',                        name: 'GET /users/status' },
  { method: 'GET',  path: '/api/users/favorites',                     name: 'GET /users/favorites' },
  { method: 'GET',  path: '/api/users/applications',                  name: 'GET /users/applications' },
  { method: 'GET',  path: '/api/users/notifications',                 name: 'GET /users/notifications' },
  { method: 'GET',  path: '/api/users/notifications/unread-count',    name: 'GET /users/unread-count' },
  { method: 'GET',  path: '/api/adoptions/my-applications',           name: 'GET /adoptions/my-apps' },
  { method: 'GET',  path: '/api/rescue-reports/rescuer/my-rescues',   name: 'GET /rescues/my-rescues' },
  { method: 'GET',  path: '/api/rescue-reports/my-active-mission',    name: 'GET /rescues/active-mission' },
  { method: 'GET',  path: '/api/shelter-transfers/my-requests',       name: 'GET /transfers/my-requests' },
  { method: 'GET',  path: '/api/rescuer-applications/my-application', name: 'GET /rescuer-apps/mine' },
  { method: 'GET',  path: '/api/shelter-applications/my-application', name: 'GET /shelter-apps/mine' },
  { method: 'GET',  path: '/api/shelter-manager/status',              name: 'GET /shelter-mgr/status' },
  { method: 'GET',  path: '/api/ai/context',                          name: 'GET /ai/context' },
];

const ADMIN_ENDPOINTS = [
  { method: 'GET', path: '/api/admin/dashboard/stats',                name: 'GET /admin/dashboard/stats' },
  { method: 'GET', path: '/api/admin/pet-categories',                 name: 'GET /admin/pet-categories' },
  { method: 'GET', path: '/api/admin/pets',                           name: 'GET /admin/pets' },
  { method: 'GET', path: '/api/admin/pets?limit=50&offset=0',         name: 'GET /admin/pets (paginated)' },
  { method: 'GET', path: '/api/admin/pets?status=available',          name: 'GET /admin/pets (status)' },
  { method: 'GET', path: '/api/admin/pets?search=dog',                name: 'GET /admin/pets (search)' },
  { method: 'GET', path: '/api/admin/users',                          name: 'GET /admin/users' },
  { method: 'GET', path: '/api/admin/users?limit=50',                 name: 'GET /admin/users (paginated)' },
  { method: 'GET', path: '/api/admin/users?status=active',            name: 'GET /admin/users (status)' },
  { method: 'GET', path: '/api/admin/adoptions',                      name: 'GET /admin/adoptions' },
  { method: 'GET', path: '/api/admin/adoptions?status=pending',       name: 'GET /admin/adoptions (status)' },
  { method: 'GET', path: '/api/admin/rescues',                        name: 'GET /admin/rescues' },
  { method: 'GET', path: '/api/admin/rescues?status=pending',         name: 'GET /admin/rescues (status)' },
  { method: 'GET', path: '/api/admin/rescues/pending-verification',   name: 'GET /admin/pending-verify' },
  { method: 'GET', path: '/api/shelter-transfers/admin/all',          name: 'GET /transfers/admin/all' },
  { method: 'GET', path: '/api/rescuer-applications',                 name: 'GET /rescuer-applications' },
  { method: 'GET', path: '/api/shelter-applications',                 name: 'GET /shelter-applications' },
  { method: 'GET', path: '/api/users/all',                            name: 'GET /users/all (admin)' },
];

const WRITE_ENDPOINTS_PUBLIC = [
  {
    method: 'POST', path: '/api/rescue-reports',
    name: 'POST /rescue-reports (guest)',
    body: {
      title: 'Stress Test Report',
      description: 'Automated stress test — ignore this report',
      animal_type: 'dog',
      condition: 'injured',
      urgency: 'low',
      location_description: 'Test location',
      address: '123 Test St',
      city: 'Test City',
      reporter_name: 'Stress Tester',
      reporter_phone: '09000000000',
      reporter_email: 'stresstest@test.com',
    },
  },
];

const AUTH_FLOW_ENDPOINTS = [
  {
    method: 'POST', path: '/api/auth/login',
    name: 'POST /auth/login (invalid creds)',
    body: { email: 'stresstest_nonexistent@fake.com', password: 'wrong_password_123!' },
  },
  {
    method: 'POST', path: '/api/auth/register',
    name: 'POST /auth/register (invalid)',
    body: { email: 'bad-email', password: '1', full_name: '', phone: '' },
  },
  {
    method: 'POST', path: '/api/auth/forgot-password',
    name: 'POST /auth/forgot-password (invalid)',
    body: { email: 'nonexistent_stress@test.com' },
  },
  {
    method: 'POST', path: '/api/auth/verify-otp',
    name: 'POST /auth/verify-otp (invalid)',
    body: { tempToken: 'invalid-token', otp: '000000' },
  },
  {
    method: 'POST', path: '/api/auth/refresh',
    name: 'POST /auth/refresh (invalid)',
    body: { refreshToken: 'invalid-refresh-token' },
  },
];

// ─── Test Runners ────────────────────────────────────────────
async function runEndpointTest(endpoint, concurrency, requestsPerUser, token = null) {
  const promises = [];
  const hdrs = authHeaders(token);

  for (let user = 0; user < concurrency; user++) {
    for (let req = 0; req < requestsPerUser; req++) {
      promises.push(makeRequest(endpoint.method, endpoint.path, endpoint.body || null, hdrs));
    }
  }

  const results = await Promise.all(promises);
  return calculateStats(results);
}

async function runEndpointGroup(endpoints, concurrency, reqsPerUser, label, token = null) {
  sectionHeader(`${label} — ${concurrency} concurrent × ${reqsPerUser} reqs each`);

  const phaseResults = [];

  for (const ep of endpoints) {
    const stats = await runEndpointTest(ep, concurrency, reqsPerUser, token);
    phaseResults.push({ endpoint: ep.name, stats });
    console.log(formatStatusLine(ep.name, stats));
  }

  return phaseResults;
}

// ─── Phase 0: Authentication ─────────────────────────────────
async function obtainTokens() {
  sectionHeader('PHASE 0: AUTHENTICATION — Obtaining test tokens');

  // Try user login
  if (USER_EMAIL && USER_PASS) {
    console.log(`  Logging in as user: ${USER_EMAIL}`);
    const res = await makeRequest('POST', '/api/auth/login', { email: USER_EMAIL, password: USER_PASS });
    if (res.data?.token) {
      userToken = res.data.token;
      console.log(c('green', `  ✓ User token obtained (HTTP ${res.status}, ${res.latency}ms)`));
    } else if (res.data?.tempToken) {
      console.log(c('yellow', `  ⚠ User has 2FA enabled — need OTP. Skipping user auth tests.`));
    } else {
      console.log(c('red', `  ✗ User login failed: HTTP ${res.status} — ${JSON.stringify(res.data?.error || res.error)}`));
    }
  } else {
    console.log(c('yellow', '  ⚠ No --user-email/--user-pass provided. Skipping user-auth tests.'));
  }

  // Try admin login
  if (ADMIN_EMAIL && ADMIN_PASS) {
    console.log(`  Logging in as admin: ${ADMIN_EMAIL}`);
    const res = await makeRequest('POST', '/api/auth/admin/login', { email: ADMIN_EMAIL, password: ADMIN_PASS });
    if (res.data?.token) {
      adminToken = res.data.token;
      console.log(c('green', `  ✓ Admin token obtained (HTTP ${res.status}, ${res.latency}ms)`));
    } else {
      console.log(c('red', `  ✗ Admin login failed: HTTP ${res.status} — ${JSON.stringify(res.data?.error || res.error)}`));
    }
  } else {
    console.log(c('yellow', '  ⚠ No --admin-email/--admin-pass provided. Skipping admin-auth tests.'));
  }

  console.log('');
}

// ─── Phase 1: Public Endpoint Concurrency Scaling ────────────
async function runPublicConcurrencyScaling() {
  const results = [];
  for (const concurrency of CONCURRENCY_LEVELS) {
    const r = await runEndpointGroup(PUBLIC_ENDPOINTS, concurrency, REQUESTS_PER_USER, `PHASE 1: PUBLIC ENDPOINTS (${concurrency} users)`);
    results.push({ concurrency, results: r });
  }
  sectionResults['publicScaling'] = results;
  return results;
}

// ─── Phase 2: Authenticated User Endpoints ───────────────────
async function runUserEndpointTests() {
  if (!userToken) {
    sectionHeader('PHASE 2: USER ENDPOINTS — SKIPPED (no token)');
    return null;
  }

  const concurrency = QUICK_MODE ? 10 : 25;
  const results = await runEndpointGroup(USER_ENDPOINTS, concurrency, REQUESTS_PER_USER, `PHASE 2: AUTHENTICATED USER ENDPOINTS (${concurrency} users)`, userToken);
  sectionResults['userEndpoints'] = results;

  // Also test user write operations at low concurrency
  subsectionHeader('User Write Operations (concurrency=3)');
  const writeOps = [
    { method: 'PUT', path: '/api/users/notifications/read-all', name: 'PUT /users/read-all-notifs', body: {} },
  ];
  for (const ep of writeOps) {
    const stats = await runEndpointTest(ep, 3, 2, userToken);
    console.log(formatStatusLine(ep.name, stats));
  }

  return results;
}

// ─── Phase 3: Admin Endpoints ────────────────────────────────
async function runAdminEndpointTests() {
  if (!adminToken) {
    sectionHeader('PHASE 3: ADMIN ENDPOINTS — SKIPPED (no token)');
    return null;
  }

  const concurrency = QUICK_MODE ? 5 : 15;
  const results = await runEndpointGroup(ADMIN_ENDPOINTS, concurrency, REQUESTS_PER_USER, `PHASE 3: ADMIN ENDPOINTS (${concurrency} users)`, adminToken);
  sectionResults['adminEndpoints'] = results;
  return results;
}

// ─── Phase 4: Auth Flow Stress ───────────────────────────────
async function runAuthFlowStress() {
  const concurrency = QUICK_MODE ? 3 : 5;
  const results = await runEndpointGroup(AUTH_FLOW_ENDPOINTS, concurrency, 2, `PHASE 4: AUTH FLOW STRESS (${concurrency} concurrent, invalid payloads)`);
  sectionResults['authFlow'] = results;
  return results;
}

// ─── Phase 5: Write Endpoint Stress ──────────────────────────
async function runWriteEndpointStress() {
  const concurrency = QUICK_MODE ? 3 : 8;
  const results = await runEndpointGroup(WRITE_ENDPOINTS_PUBLIC, concurrency, 2, `PHASE 5: WRITE ENDPOINTS (${concurrency} concurrent)`);
  sectionResults['writeEndpoints'] = results;
  return results;
}

// ─── Phase 6: 404 & Error Handling Stress ────────────────────
async function runErrorHandlingStress() {
  sectionHeader('PHASE 6: ERROR HANDLING STRESS — Invalid routes & methods');

  const errorEndpoints = [
    { method: 'GET',    path: '/api/nonexistent',              name: 'GET /api/nonexistent (404)' },
    { method: 'GET',    path: '/api/pets/99999999',            name: 'GET /api/pets/99999999 (not found)' },
    { method: 'DELETE', path: '/api/pets/99999999',            name: 'DELETE /api/pets/99999999 (no auth)' },
    { method: 'POST',   path: '/api/auth/login',              name: 'POST /auth/login (empty body)', body: {} },
    { method: 'POST',   path: '/api/auth/login',              name: 'POST /auth/login (malformed)', body: { email: 12345, password: null } },
    { method: 'GET',    path: '/api/admin/dashboard/stats',   name: 'GET /admin/stats (no auth)' },
    { method: 'GET',    path: '/api/users/profile',           name: 'GET /users/profile (no auth)' },
    { method: 'POST',   path: '/api/adoptions',               name: 'POST /adoptions (no auth)' },
    { method: 'GET',    path: '/api/pets/search?name=' + 'x'.repeat(500), name: 'GET /pets/search (long query)' },
    { method: 'POST',   path: '/api/auth/login',              name: 'POST /auth/login (SQL inject)', body: { email: "' OR 1=1 --", password: "' OR ''='" } },
    { method: 'GET',    path: '/api/pets?limit=-1&offset=-999', name: 'GET /api/pets (negative params)' },
    { method: 'GET',    path: '/api/pets?limit=999999',        name: 'GET /api/pets (huge limit)' },
  ];

  const concurrency = QUICK_MODE ? 5 : 15;
  const results = [];

  for (const ep of errorEndpoints) {
    const stats = await runEndpointTest(ep, concurrency, 2);
    results.push({ endpoint: ep.name, stats });
    console.log(formatStatusLine(ep.name, stats));
  }

  sectionResults['errorHandling'] = results;
  return results;
}

// ─── Phase 7: Rate Limit Verification ────────────────────────
async function runRateLimitTests() {
  sectionHeader('PHASE 7: RATE LIMIT VERIFICATION');

  const rateLimitTargets = [
    { method: 'POST', path: '/api/auth/login',       name: 'Auth: /login',       limit: 10, body: { email: 'rl@test.com', password: 'test' } },
    { method: 'POST', path: '/api/auth/register',    name: 'Auth: /register',    limit: 10, body: { email: 'rl@test.com', password: 'test', full_name: 'RL', phone: '0900' } },
    { method: 'POST', path: '/api/auth/email-signin', name: 'Auth: /email-signin', limit: 10, body: { email: 'rl@test.com' } },
  ];

  const rateLimitResults = {};

  for (const target of rateLimitTargets) {
    const batchSize = target.limit + 10; // Send more than the limit
    const promises = [];
    for (let i = 0; i < batchSize; i++) {
      promises.push(makeRequest(target.method, target.path, target.body));
    }
    const results = await Promise.all(promises);
    const stats = calculateStats(results);
    const rateLimited = results.filter(r => r.status === 429).length;
    const allowed = results.filter(r => r.status !== 429 && r.status !== 0).length;

    rateLimitResults[target.name] = { rateLimited, allowed, total: batchSize };

    const status = rateLimited > 0 ? c('green', '✓ ACTIVE') : c('yellow', '⚠ NOT TRIGGERED');
    console.log(`  ${target.name.padEnd(30)} | sent ${batchSize} | blocked ${rateLimited} | allowed ${allowed} | ${status}`);
  }

  // General API rate limit test (500 req / 15 min)
  subsectionHeader('General API Rate Limit (500/15min window)');
  console.log('  Sending burst of 100 requests to /api/pets...');
  const burstPromises = [];
  for (let i = 0; i < 100; i++) {
    burstPromises.push(makeRequest('GET', '/api/pets'));
  }
  const burstResults = await Promise.all(burstPromises);
  const burstStats = calculateStats(burstResults);
  const burstRateLimited = burstResults.filter(r => r.status === 429).length;
  console.log(`  ${burstStats.total} requests: ${burstRateLimited} rate-limited | avg ${burstStats.latency.mean}ms | p95 ${burstStats.latency.p95}ms`);

  sectionResults['rateLimiting'] = rateLimitResults;
  return rateLimitResults;
}

// ─── Phase 8: Sustained Load Test ────────────────────────────
async function runSustainedLoadTest() {
  sectionHeader(`PHASE 8: SUSTAINED LOAD — ${SUSTAINED_RPS} req/s for ${SUSTAINED_DURATION}s`);

  const endpoints = PUBLIC_ENDPOINTS.slice(0, 6); // Use first 6 public endpoints
  const intervalMs = 1000 / SUSTAINED_RPS;
  const endTime = Date.now() + SUSTAINED_DURATION * 1000;

  const promises = [];
  let reqCount = 0;
  const startTime = Date.now();

  while (Date.now() < endTime) {
    const ep = endpoints[reqCount % endpoints.length];
    promises.push(
      makeRequest(ep.method, ep.path).then(r => ({ ...r, sentAt: Date.now() - startTime }))
    );
    reqCount++;
    await new Promise(r => setTimeout(r, intervalMs));
  }

  const allResults = await Promise.all(promises);
  const stats = calculateStats(allResults);

  // Per-second throughput analysis
  const perSecond = {};
  for (const r of allResults) {
    const sec = Math.floor(r.sentAt / 1000);
    if (!perSecond[sec]) perSecond[sec] = { count: 0, errors: 0, totalLatency: 0 };
    perSecond[sec].count++;
    if (r.error) perSecond[sec].errors++;
    perSecond[sec].totalLatency += r.latency;
  }

  console.log(`  Total requests:    ${stats.total}`);
  console.log(`  Duration:          ${SUSTAINED_DURATION}s`);
  console.log(`  Actual throughput: ${(stats.total / SUSTAINED_DURATION).toFixed(1)} req/s`);
  console.log(`  Errors:            ${stats.errors} (${stats.errorRate})`);
  console.log(`  Avg latency:       ${stats.latency.mean}ms`);
  console.log(`  P90 latency:       ${stats.latency.p90}ms`);
  console.log(`  P95 latency:       ${stats.latency.p95}ms`);
  console.log(`  P99 latency:       ${stats.latency.p99}ms`);
  console.log(`  Max latency:       ${stats.latency.max}ms`);
  console.log(`  Status codes:      ${Object.entries(stats.statuses).map(([k, v]) => `${k}:${v}`).join(' ')}`);

  // Show throughput stability
  subsectionHeader('Per-Second Throughput');
  const seconds = Object.keys(perSecond).sort((a, b) => a - b);
  const throughputs = seconds.map(s => perSecond[s].count);
  const minThroughput = Math.min(...throughputs);
  const maxThroughput = Math.max(...throughputs);
  console.log(`  Min: ${minThroughput} req/s | Max: ${maxThroughput} req/s | Variance: ${maxThroughput - minThroughput}`);

  if (stats.latency.p95 > 3000) allIssues.push(`Sustained load: P95 latency is ${stats.latency.p95}ms (>3000ms)`);

  sectionResults['sustainedLoad'] = stats;
  return stats;
}

// ─── Phase 9: Connection Stress ──────────────────────────────
async function runConnectionStressTest() {
  const connectionCounts = QUICK_MODE ? [100, 300] : [100, 300, 500];

  for (const count of connectionCounts) {
    sectionHeader(`PHASE 9: CONNECTION STRESS — ${count} simultaneous connections`);

    const promises = [];
    for (let i = 0; i < count; i++) {
      const ep = PUBLIC_ENDPOINTS[i % PUBLIC_ENDPOINTS.length];
      promises.push(makeRequest(ep.method, ep.path));
    }

    const results = await Promise.all(promises);
    const stats = calculateStats(results);

    console.log(`  Total requests:  ${stats.total}`);
    console.log(`  Successful:      ${stats.total - stats.errors}`);
    console.log(`  Failed:          ${stats.errors} (${stats.errorRate})`);
    console.log(`  Avg latency:     ${stats.latency.mean}ms`);
    console.log(`  P95 latency:     ${stats.latency.p95}ms`);
    console.log(`  Max latency:     ${stats.latency.max}ms`);
    console.log(`  Status codes:    ${Object.entries(stats.statuses).map(([k, v]) => `${k}:${v}`).join(' ')}`);

    if (stats.errors > count * 0.1) {
      allIssues.push(`${stats.errors}/${count} connection failures at ${count} simultaneous`);
    }

    sectionResults[`connections_${count}`] = stats;
  }
}

// ─── Phase 10: Large Payload Test ────────────────────────────
async function runLargePayloadTest() {
  sectionHeader('PHASE 10: LARGE PAYLOAD HANDLING');

  const payloads = [
    { label: '100KB',  size: 100 * 1024 },
    { label: '1MB',    size: 1024 * 1024 },
    { label: '5MB',    size: 5 * 1024 * 1024 },
    { label: '10MB',   size: 10 * 1024 * 1024 },
    { label: '25MB',   size: 25 * 1024 * 1024 },
  ];

  const results = [];
  for (const p of payloads) {
    const body = { data: 'x'.repeat(p.size) };
    const result = await makeRequest('POST', '/api/rescue-reports', body);
    const verdict = result.status === 413 ? c('green', 'REJECTED (413)')
                  : result.status === 400 ? c('green', 'REJECTED (400)')
                  : result.error === 'TIMEOUT' ? c('yellow', 'TIMEOUT')
                  : result.error ? c('red', `ERROR: ${result.error}`)
                  : `HTTP ${result.status}`;
    console.log(`  ${p.label.padEnd(8)} payload: ${verdict} — ${result.latency}ms`);
    results.push({ size: p.label, ...result });
  }

  sectionResults['largePayload'] = results;
  return results;
}

// ─── Phase 11: Database Connection Pool Stress ───────────────
async function runDatabasePoolStress() {
  sectionHeader('PHASE 11: DATABASE POOL STRESS — Exhausting DB connections');

  // Fire many DB-heavy requests simultaneously
  const dbHeavyEndpoints = [
    { method: 'GET', path: '/api/pets?limit=50' },
    { method: 'GET', path: '/api/shelters?limit=50' },
    { method: 'GET', path: '/api/rescue-reports?limit=50' },
    { method: 'GET', path: '/api/health/detailed' },
    { method: 'GET', path: '/api/health/stats' },
    { method: 'GET', path: '/api/pets/search?name=a' },
    { method: 'GET', path: '/api/pets/featured' },
    { method: 'GET', path: '/api/pets/categories' },
  ];

  const concurrentCount = QUICK_MODE ? 50 : 100;
  console.log(`  Sending ${concurrentCount} simultaneous DB-heavy requests...`);

  const promises = [];
  for (let i = 0; i < concurrentCount; i++) {
    const ep = dbHeavyEndpoints[i % dbHeavyEndpoints.length];
    promises.push(makeRequest(ep.method, ep.path));
  }

  const results = await Promise.all(promises);
  const stats = calculateStats(results);

  console.log(`  Total:       ${stats.total}`);
  console.log(`  Successful:  ${stats.total - stats.errors} (${stats.successRate})`);
  console.log(`  Errors:      ${stats.errors} (${stats.errorRate})`);
  console.log(`  Avg latency: ${stats.latency.mean}ms`);
  console.log(`  P95 latency: ${stats.latency.p95}ms`);
  console.log(`  Max latency: ${stats.latency.max}ms`);

  // Check health after pool stress
  const healthAfter = await makeRequest('GET', '/api/health/detailed');
  if (healthAfter.data?.checks?.pool) {
    const pool = healthAfter.data.checks.pool;
    console.log(`\n  DB Pool After Stress:`);
    console.log(`    Total:    ${pool.total || 'N/A'}`);
    console.log(`    Idle:     ${pool.idle || 'N/A'}`);
    console.log(`    Waiting:  ${pool.waiting || 'N/A'}`);
  }

  if (stats.errors > concurrentCount * 0.2) {
    allIssues.push(`DB pool stress: ${stats.errors}/${concurrentCount} failures`);
  }

  sectionResults['dbPoolStress'] = stats;
  return stats;
}

// ─── Phase 12: Memory Leak Detection ─────────────────────────
async function runMemoryLeakTest() {
  sectionHeader('PHASE 12: MEMORY LEAK DETECTION — Monitoring heap over time');

  const snapshots = [];
  const iterations = QUICK_MODE ? 3 : 5;
  const batchSize = QUICK_MODE ? 50 : 100;

  for (let i = 0; i < iterations; i++) {
    // Get memory before batch
    const healthBefore = await makeRequest('GET', '/api/health/detailed');
    const memBefore = healthBefore.data?.checks?.memory;

    // Fire batch of requests
    const promises = [];
    for (let j = 0; j < batchSize; j++) {
      const ep = PUBLIC_ENDPOINTS[j % PUBLIC_ENDPOINTS.length];
      promises.push(makeRequest(ep.method, ep.path));
    }
    await Promise.all(promises);

    // Get memory after
    const healthAfter = await makeRequest('GET', '/api/health/detailed');
    const memAfter = healthAfter.data?.checks?.memory;

    snapshots.push({
      iteration: i + 1,
      heapUsedBefore: memBefore?.heapUsed || memBefore?.heap_used || 'N/A',
      heapUsedAfter: memAfter?.heapUsed || memAfter?.heap_used || 'N/A',
      rss: memAfter?.rss || 'N/A',
    });

    const heapMB = memAfter?.heapUsed
      ? (memAfter.heapUsed / 1024 / 1024).toFixed(1)
      : memAfter?.heap_used
        ? (memAfter.heap_used / 1024 / 1024).toFixed(1)
        : '?';
    console.log(`  Iteration ${i + 1}/${iterations}: ${batchSize} requests → Heap: ${heapMB}MB`);

    // Small delay between iterations
    await new Promise(r => setTimeout(r, 1000));
  }

  // Check for consistent growth
  const heaps = snapshots
    .map(s => typeof s.heapUsedAfter === 'number' ? s.heapUsedAfter : null)
    .filter(h => h !== null);

  if (heaps.length >= 3) {
    const growth = heaps[heaps.length - 1] - heaps[0];
    const growthMB = (growth / 1024 / 1024).toFixed(1);
    const avgGrowthPerIter = (growth / heaps.length / 1024 / 1024).toFixed(2);
    console.log(`\n  Total heap growth:  ${growthMB}MB over ${heaps.length} iterations`);
    console.log(`  Avg growth/iter:    ${avgGrowthPerIter}MB`);

    if (growth > 50 * 1024 * 1024) {
      allIssues.push(`Potential memory leak: heap grew ${growthMB}MB during test`);
      console.log(c('red', `  ⚠ POTENTIAL MEMORY LEAK DETECTED`));
    } else {
      console.log(c('green', `  ✓ Memory usage appears stable`));
    }
  } else {
    console.log(c('yellow', '  ⚠ Could not read memory stats from /api/health/detailed'));
  }

  sectionResults['memoryLeak'] = snapshots;
  return snapshots;
}

// ─── Phase 13: Mixed Concurrent Workload ─────────────────────
async function runMixedWorkloadTest() {
  sectionHeader('PHASE 13: MIXED WORKLOAD — Simulating real traffic patterns');

  // Simulate realistic mixed traffic: 70% reads, 20% auth, 10% writes
  const totalRequests = QUICK_MODE ? 150 : 500;
  const promises = [];

  for (let i = 0; i < totalRequests; i++) {
    const rand = Math.random();

    if (rand < 0.55) {
      // Public read
      const ep = PUBLIC_ENDPOINTS[Math.floor(Math.random() * PUBLIC_ENDPOINTS.length)];
      promises.push(makeRequest(ep.method, ep.path).then(r => ({ ...r, type: 'public-read' })));
    } else if (rand < 0.75 && userToken) {
      // Authenticated read
      const ep = USER_ENDPOINTS[Math.floor(Math.random() * USER_ENDPOINTS.length)];
      promises.push(makeRequest(ep.method, ep.path, null, authHeaders(userToken)).then(r => ({ ...r, type: 'user-read' })));
    } else if (rand < 0.88 && adminToken) {
      // Admin read
      const ep = ADMIN_ENDPOINTS[Math.floor(Math.random() * ADMIN_ENDPOINTS.length)];
      promises.push(makeRequest(ep.method, ep.path, null, authHeaders(adminToken)).then(r => ({ ...r, type: 'admin-read' })));
    } else if (rand < 0.95) {
      // Auth flow (invalid)
      const ep = AUTH_FLOW_ENDPOINTS[Math.floor(Math.random() * AUTH_FLOW_ENDPOINTS.length)];
      promises.push(makeRequest(ep.method, ep.path, ep.body).then(r => ({ ...r, type: 'auth-flow' })));
    } else {
      // Health check
      promises.push(makeRequest('GET', '/api/health').then(r => ({ ...r, type: 'health' })));
    }
  }

  const results = await Promise.all(promises);
  const stats = calculateStats(results);

  // Breakdown by type
  const types = {};
  for (const r of results) {
    if (!types[r.type]) types[r.type] = [];
    types[r.type].push(r);
  }

  console.log(`\n  Overall: ${stats.total} requests | avg ${stats.latency.mean}ms | p95 ${stats.latency.p95}ms | errors ${stats.errorRate}`);
  console.log(`\n  By type:`);
  for (const [type, reqs] of Object.entries(types)) {
    const typeStats = calculateStats(reqs);
    console.log(`    ${type.padEnd(15)} | ${String(typeStats.total).padStart(4)} reqs | avg ${String(typeStats.latency.mean).padStart(4)}ms | p95 ${String(typeStats.latency.p95).padStart(4)}ms | err ${typeStats.errorRate}`);
  }

  sectionResults['mixedWorkload'] = { stats, types: Object.fromEntries(Object.entries(types).map(([k, v]) => [k, calculateStats(v)])) };
  return stats;
}

// ─── Phase 14: Rapid Sequential Requests (Pipeline) ─────────
async function runPipelineTest() {
  sectionHeader('PHASE 14: RAPID SEQUENTIAL — Single-client burst test');

  const iterations = QUICK_MODE ? 50 : 100;
  const results = [];
  const endpoints = [...PUBLIC_ENDPOINTS.slice(0, 6)];

  console.log(`  Sending ${iterations} rapid sequential requests...`);

  for (let i = 0; i < iterations; i++) {
    const ep = endpoints[i % endpoints.length];
    const result = await makeRequest(ep.method, ep.path);
    results.push(result);
  }

  const stats = calculateStats(results);
  console.log(`  Total:       ${stats.total}`);
  console.log(`  Errors:      ${stats.errors} (${stats.errorRate})`);
  console.log(`  Avg latency: ${stats.latency.mean}ms`);
  console.log(`  P95 latency: ${stats.latency.p95}ms`);
  console.log(`  Max latency: ${stats.latency.max}ms`);
  console.log(`  Throughput:  ~${(1000 / stats.latency.mean).toFixed(1)} req/s (sequential)`);

  sectionResults['pipeline'] = stats;
  return stats;
}

// ─── Final Summary Report ────────────────────────────────────
function printFinalSummary() {
  const elapsed = ((Date.now() - testStartTime) / 1000).toFixed(1);

  console.log(`\n\n${c('bold', '█'.repeat(80))}`);
  console.log(`  ${c('bold', 'PAWMILYA FULL APPLICATION STRESS TEST — FINAL REPORT')}`);
  console.log(c('bold', '█'.repeat(80)));

  console.log(`\n  Target:   ${BASE_URL}`);
  console.log(`  Date:     ${new Date().toISOString()}`);
  console.log(`  Duration: ${elapsed}s`);
  console.log(`  Mode:     ${QUICK_MODE ? 'Quick' : 'Full'}`);
  console.log(`  Auth:     User=${userToken ? '✓' : '✗'} | Admin=${adminToken ? '✓' : '✗'}`);

  // ── Concurrency Scaling
  if (sectionResults.publicScaling) {
    console.log(`\n  ${c('bold', '── CONCURRENCY SCALING (Public Endpoints) ──')}`);
    for (const { concurrency, results } of sectionResults.publicScaling) {
      const avgLatency = Math.round(results.reduce((s, r) => s + r.stats.latency.mean, 0) / results.length);
      const maxLatency = Math.max(...results.map(r => r.stats.latency.max));
      const totalErrors = results.reduce((s, r) => s + r.stats.errors, 0);
      const totalReqs = results.reduce((s, r) => s + r.stats.total, 0);
      const errPct = ((totalErrors / totalReqs) * 100).toFixed(1);

      const color = errPct > 5 ? 'red' : errPct > 1 ? 'yellow' : 'green';
      console.log(`    ${String(concurrency).padStart(4)} users: avg ${String(avgLatency).padStart(5)}ms | max ${String(maxLatency).padStart(5)}ms | ${c(color, `${totalErrors}/${totalReqs} errors (${errPct}%)`)}`);

      if (avgLatency > 2000) allIssues.push(`High avg latency at ${concurrency} concurrent users: ${avgLatency}ms`);
      if (totalErrors / totalReqs > 0.05) allIssues.push(`>${5}% error rate at ${concurrency} concurrent users`);
    }
  }

  // ── User Endpoints
  if (sectionResults.userEndpoints) {
    console.log(`\n  ${c('bold', '── AUTHENTICATED USER ENDPOINTS ──')}`);
    const results = sectionResults.userEndpoints;
    const avgLatency = Math.round(results.reduce((s, r) => s + r.stats.latency.mean, 0) / results.length);
    const totalErrors = results.reduce((s, r) => s + r.stats.errors, 0);
    const totalReqs = results.reduce((s, r) => s + r.stats.total, 0);
    console.log(`    ${results.length} endpoints | avg ${avgLatency}ms | ${totalErrors}/${totalReqs} errors`);
  }

  // ── Admin Endpoints
  if (sectionResults.adminEndpoints) {
    console.log(`\n  ${c('bold', '── ADMIN ENDPOINTS ──')}`);
    const results = sectionResults.adminEndpoints;
    const avgLatency = Math.round(results.reduce((s, r) => s + r.stats.latency.mean, 0) / results.length);
    const totalErrors = results.reduce((s, r) => s + r.stats.errors, 0);
    const totalReqs = results.reduce((s, r) => s + r.stats.total, 0);
    console.log(`    ${results.length} endpoints | avg ${avgLatency}ms | ${totalErrors}/${totalReqs} errors`);
  }

  // ── Sustained Load
  if (sectionResults.sustainedLoad) {
    const s = sectionResults.sustainedLoad;
    console.log(`\n  ${c('bold', '── SUSTAINED LOAD ──')}`);
    console.log(`    ${SUSTAINED_RPS} req/s for ${SUSTAINED_DURATION}s | avg ${s.latency.mean}ms | p95 ${s.latency.p95}ms | errors ${s.errorRate}`);
  }

  // ── Rate Limiting
  if (sectionResults.rateLimiting) {
    console.log(`\n  ${c('bold', '── RATE LIMITING ──')}`);
    for (const [name, data] of Object.entries(sectionResults.rateLimiting)) {
      const status = data.rateLimited > 0 ? c('green', '✓ Active') : c('yellow', '⚠ Not triggered');
      console.log(`    ${name.padEnd(25)} | ${status} (${data.rateLimited}/${data.total} blocked)`);
    }
  }

  // ── Connection Handling
  const connKeys = Object.keys(sectionResults).filter(k => k.startsWith('connections_'));
  if (connKeys.length > 0) {
    console.log(`\n  ${c('bold', '── CONNECTION HANDLING ──')}`);
    for (const key of connKeys) {
      const s = sectionResults[key];
      const count = key.split('_')[1];
      const successPct = s.successRate;
      console.log(`    ${count} simultaneous: ${s.total - s.errors}/${s.total} succeeded (${successPct}) | avg ${s.latency.mean}ms | max ${s.latency.max}ms`);
    }
  }

  // ── DB Pool Stress
  if (sectionResults.dbPoolStress) {
    const s = sectionResults.dbPoolStress;
    console.log(`\n  ${c('bold', '── DATABASE POOL STRESS ──')}`);
    console.log(`    ${s.successRate} success | avg ${s.latency.mean}ms | p95 ${s.latency.p95}ms | errors ${s.errorRate}`);
  }

  // ── Memory
  if (sectionResults.memoryLeak) {
    const snaps = sectionResults.memoryLeak;
    const heaps = snaps.map(s => typeof s.heapUsedAfter === 'number' ? s.heapUsedAfter : null).filter(Boolean);
    console.log(`\n  ${c('bold', '── MEMORY ──')}`);
    if (heaps.length >= 2) {
      const growthMB = ((heaps[heaps.length - 1] - heaps[0]) / 1024 / 1024).toFixed(1);
      const status = Math.abs(parseFloat(growthMB)) > 50 ? c('red', '⚠ LEAK SUSPECTED') : c('green', '✓ Stable');
      console.log(`    Heap growth: ${growthMB}MB over ${heaps.length} iterations | ${status}`);
    } else {
      console.log(`    Could not measure (health endpoint may not expose memory stats)`);
    }
  }

  // ── Mixed Workload
  if (sectionResults.mixedWorkload) {
    const s = sectionResults.mixedWorkload.stats;
    console.log(`\n  ${c('bold', '── MIXED WORKLOAD (Real Traffic Simulation) ──')}`);
    console.log(`    ${s.total} requests | avg ${s.latency.mean}ms | p95 ${s.latency.p95}ms | errors ${s.errorRate}`);
  }

  // ── Pipeline
  if (sectionResults.pipeline) {
    const s = sectionResults.pipeline;
    console.log(`\n  ${c('bold', '── SEQUENTIAL PIPELINE ──')}`);
    console.log(`    ${s.total} requests | avg ${s.latency.mean}ms | ~${(1000 / s.latency.mean).toFixed(1)} req/s sequential`);
  }

  // ── Error Handling
  if (sectionResults.errorHandling) {
    console.log(`\n  ${c('bold', '── ERROR HANDLING ──')}`);
    let allHandled = true;
    for (const { endpoint, stats } of sectionResults.errorHandling) {
      if (stats.errors > 0) {
        allHandled = false;
        console.log(`    ${c('red', '✗')} ${endpoint}: ${stats.errors} connection errors`);
      }
    }
    if (allHandled) console.log(`    ${c('green', '✓')} All error cases handled gracefully (no connection drops)`);
  }

  // ══════════════════════════════════════════════════════════
  //  VERDICT
  // ══════════════════════════════════════════════════════════
  console.log(`\n  ${'═'.repeat(60)}`);
  console.log(`  ${c('bold', 'VERDICT')}`);
  console.log(`  ${'═'.repeat(60)}`);

  if (allIssues.length === 0) {
    console.log(`\n  ${c('green', '✓ ALL TESTS PASSED')} — Server handled stress well across all endpoints.`);
  } else {
    console.log(`\n  ${c('red', `⚠ ${allIssues.length} ISSUE(S) FOUND:`)}`);
    allIssues.forEach((issue, i) => console.log(`    ${i + 1}. ${issue}`));
  }

  // Recommendations
  console.log(`\n  ${c('bold', 'RECOMMENDATIONS:')}`);
  const recs = [];

  if (sectionResults.publicScaling) {
    const last = sectionResults.publicScaling[sectionResults.publicScaling.length - 1];
    const avgLatency = Math.round(last.results.reduce((s, r) => s + r.stats.latency.mean, 0) / last.results.length);
    if (avgLatency > 500) recs.push('Consider adding Redis caching for frequently-read public endpoints (pets, shelters)');
    if (avgLatency > 1000) recs.push('Database query optimization needed — add indexes or reduce query complexity');
  }

  if (sectionResults.sustainedLoad && sectionResults.sustainedLoad.latency.p95 > 2000) {
    recs.push('P95 latency is high under sustained load — consider connection pooling tuning or horizontal scaling');
  }

  if (sectionResults.dbPoolStress && sectionResults.dbPoolStress.errors > 5) {
    recs.push('Increase DB_POOL_MAX in environment to handle more concurrent DB connections');
  }

  if (sectionResults.rateLimiting) {
    const untriggered = Object.values(sectionResults.rateLimiting).filter(r => r.rateLimited === 0);
    if (untriggered.length > 0) recs.push('Some rate limiters did not trigger — verify they are configured correctly');
  }

  if (!userToken && !SKIP_AUTH) recs.push('Provide --user-email and --user-pass to test all authenticated endpoints');
  if (!adminToken && !SKIP_AUTH) recs.push('Provide --admin-email and --admin-pass to test all admin endpoints');

  if (recs.length === 0) {
    recs.push('Server is performing well under current test parameters');
    if (!QUICK_MODE) recs.push('Consider running with even higher concurrency or against a production-like environment');
  }

  recs.forEach((rec, i) => console.log(`    ${i + 1}. ${rec}`));

  console.log(`\n${c('bold', '█'.repeat(80))}\n`);
}

// ─── Main ────────────────────────────────────────────────────
async function main() {
  testStartTime = Date.now();

  console.log(`\n${c('bold', '█'.repeat(80))}`);
  console.log(`  ${c('bold', 'PAWMILYA FULL APPLICATION STRESS TEST')}`);
  console.log(`  Target:   ${BASE_URL}`);
  console.log(`  Mode:     ${QUICK_MODE ? 'Quick' : 'Full'}`);
  console.log(`  Started:  ${new Date().toISOString()}`);
  console.log(c('bold', '█'.repeat(80)));

  // Pre-flight check
  console.log(`\n  Checking server availability...`);
  const healthCheck = await makeRequest('GET', '/api/health');
  if (healthCheck.error) {
    console.error(`\n  ${c('red', '✗ Server not reachable at ' + BASE_URL)}`);
    console.error(`    Error: ${healthCheck.error}`);
    console.error(`    Make sure the server is running: cd backend && npm start\n`);
    process.exit(1);
  }
  console.log(`  ${c('green', '✓')} Server responding (HTTP ${healthCheck.status}, ${healthCheck.latency}ms)`);

  // Detailed health info
  const detailedHealth = await makeRequest('GET', '/api/health/detailed');
  if (detailedHealth.data) {
    const d = detailedHealth.data;
    if (d.checks?.memory) {
      const mem = d.checks.memory;
      const heapMB = mem.heapUsed ? (mem.heapUsed / 1024 / 1024).toFixed(0) : mem.heap_used ? (mem.heap_used / 1024 / 1024).toFixed(0) : '?';
      console.log(`  Memory:  ~${heapMB}MB heap used`);
    }
    if (d.checks?.pool) {
      console.log(`  DB Pool: total=${d.checks.pool.total || '?'} idle=${d.checks.pool.idle || '?'} waiting=${d.checks.pool.waiting || '?'}`);
    }
  }

  // Phase 0: Obtain tokens
  if (!SKIP_AUTH) {
    await obtainTokens();
  }

  // Phase 1: Public endpoint concurrency scaling
  await runPublicConcurrencyScaling();

  // Phase 2: Authenticated user endpoints
  if (!SKIP_AUTH) await runUserEndpointTests();

  // Phase 3: Admin endpoints
  if (!SKIP_AUTH) await runAdminEndpointTests();

  // Phase 4: Auth flow stress
  await runAuthFlowStress();

  // Phase 5: Write endpoint stress
  await runWriteEndpointStress();

  // Phase 6: Error handling
  await runErrorHandlingStress();

  // Phase 7: Rate limit tests
  await runRateLimitTests();

  // Phase 8: Sustained load
  await runSustainedLoadTest();

  // Phase 9: Connection stress
  await runConnectionStressTest();

  // Phase 10: Large payload
  await runLargePayloadTest();

  // Phase 11: DB pool stress
  await runDatabasePoolStress();

  // Phase 12: Memory leak detection
  await runMemoryLeakTest();

  // Phase 13: Mixed workload
  await runMixedWorkloadTest();

  // Phase 14: Sequential pipeline
  await runPipelineTest();

  // Final report
  printFinalSummary();
}

main().catch((err) => {
  console.error('Stress test failed:', err);
  process.exit(1);
});
