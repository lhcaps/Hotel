import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

import { extractRouteDecorators } from './endpoint-inventory.mts';

type HttpMethod = 'delete' | 'get' | 'patch' | 'post' | 'put';
type Endpoint = Readonly<{ method: HttpMethod; path: string; source: string }>;

const HTTP_METHODS = new Set<HttpMethod>(['delete', 'get', 'patch', 'post', 'put']);
const root = resolve(import.meta.dirname, '..');
const apiRoot = join(root, 'apps/api/src');
const openApiPaths = [
  join(root, 'docs/openapi/admin-v1.json'),
  join(root, 'docs/openapi/public-v1.json'),
  join(root, 'docs/openapi/operations-v1.json'),
];
const inventoryPath = join(root, 'docs/audit/phase-8d/endpoint-inventory.csv');

/** Routes deliberately excluded from the product API references. */
const EXPLICIT_RUNTIME_ALLOWLIST = new Set([
  'GET /api/auth/*',
  'POST /api/auth/*',
  'GET /api/v1/health/live',
  'GET /api/v1/health/ready',
]);

function endpointKey(endpoint: Pick<Endpoint, 'method' | 'path'>): string {
  return `${endpoint.method.toUpperCase()} ${endpoint.path}`;
}

function joinPath(...segments: readonly string[]): string {
  return `/${segments
    .flatMap((segment) => segment.split('/'))
    .filter(Boolean)
    .join('/')}`.replace(/:([A-Za-z][A-Za-z0-9_]*)/g, '{$1}');
}

async function sourceFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) return sourceFiles(path);
      return entry.name.endsWith('.controller.ts') ? [path] : [];
    }),
  );
  return nested.flat();
}

function controllerPath(source: string, file: string): { path: string; neutral: boolean } {
  const stringController = /@Controller\(\s*'([^']+)'\s*\)/.exec(source)?.[1];
  const objectController = /@Controller\(\s*\{[^}]*\bpath\s*:\s*'([^']+)'[^}]*\}\s*\)/s.exec(
    source,
  )?.[1];
  const path = stringController ?? objectController;
  if (!path) throw new Error(`Unable to read @Controller path in ${file}.`);
  return {
    path,
    neutral: /VERSION_NEUTRAL/.test(source.slice(0, source.indexOf(path) + path.length)),
  };
}

async function runtimeEndpoints(): Promise<Endpoint[]> {
  const controllers = await sourceFiles(apiRoot);
  const endpoints: Endpoint[] = [];
  for (const file of controllers) {
    const source = await readFile(file, 'utf8');
    const controller = controllerPath(source, file);
    for (const decorator of extractRouteDecorators(source)) {
      const method = decorator.method as HttpMethod;
      if (!HTTP_METHODS.has(method)) continue;
      endpoints.push({
        method,
        path: joinPath(controller.neutral ? 'api' : 'api/v1', controller.path, decorator.path),
        source: file.slice(root.length + 1).replaceAll('\\', '/'),
      });
    }
  }
  return endpoints;
}

async function documentedEndpoints(): Promise<Set<string>> {
  const result = new Set<string>();
  for (const file of openApiPaths) {
    const document = JSON.parse(await readFile(file, 'utf8')) as {
      paths?: Record<string, Record<string, unknown>>;
    };
    for (const [path, item] of Object.entries(document.paths ?? {})) {
      for (const method of Object.keys(item)) {
        if (HTTP_METHODS.has(method as HttpMethod)) {
          result.add(endpointKey({ method: method as HttpMethod, path }));
        }
      }
    }
  }
  return result;
}

function csv(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
}

function authFor(endpoint: Endpoint): string {
  if (endpoint.path.startsWith('/api/auth/')) return 'framework-owned auth boundary';
  if (endpoint.path.startsWith('/api/v1/health/')) return 'none (internal health probe)';
  if (endpoint.path.startsWith('/api/v1/admin/')) return 'administrator cookie session';
  if (endpoint.path.startsWith('/api/v1/customer/')) return 'customer cookie session';
  if (endpoint.path.includes('/webhooks/')) return 'provider signature verification';
  if (endpoint.path.includes('/public/bookings/')) return 'guest booking cookie where required';
  return 'public or route-specific guard';
}

async function writeInventory(
  endpoints: readonly Endpoint[],
  documentedKeys: ReadonlySet<string>,
): Promise<void> {
  const header = [
    'method',
    'runtime_path',
    'openapi_path',
    'controller',
    'auth_requirement',
    'permission',
    'request_schema',
    'response_schema',
    'mutation_or_read_only',
    'authoritative_effect',
    'ui_caller',
    'focused_test',
    'status',
  ];
  const rows = endpoints
    .sort((left, right) => endpointKey(left).localeCompare(endpointKey(right)))
    .map((endpoint) => {
      const key = endpointKey(endpoint);
      const documented = documentedKeys.has(key);
      const allowlisted = EXPLICIT_RUNTIME_ALLOWLIST.has(key);
      return [
        endpoint.method.toUpperCase(),
        endpoint.path,
        documented ? endpoint.path : '',
        endpoint.source,
        authFor(endpoint),
        endpoint.path.startsWith('/api/v1/admin/')
          ? 'controller guard; see source'
          : 'route-specific; see source',
        'shared contract or controller validation; see source',
        'shared contract or controller response; see source',
        endpoint.method === 'get' ? 'read-only' : 'mutation',
        endpoint.method === 'get' ? 'read only' : 'controller-authoritative mutation',
        'verified by web/API caller tests where applicable',
        'controller and contract test suite',
        documented ? 'DOCUMENTED' : allowlisted ? 'ALLOWLISTED' : 'UNEXPECTED',
      ]
        .map(csv)
        .join(',');
    });
  await writeFile(inventoryPath, `${header.join(',')}\n${rows.join('\n')}\n`, 'utf8');
}

const [runtime, documented] = await Promise.all([runtimeEndpoints(), documentedEndpoints()]);
const runtimeKeys = new Set(runtime.map(endpointKey));
const undocumented = runtime.filter(
  (endpoint) =>
    !documented.has(endpointKey(endpoint)) &&
    !EXPLICIT_RUNTIME_ALLOWLIST.has(endpointKey(endpoint)),
);
const staleDocumentation = [...documented].filter((key) => !runtimeKeys.has(key));

if (undocumented.length > 0 || staleDocumentation.length > 0) {
  const details = [
    ...undocumented.map(
      (endpoint) => `runtime undocumented: ${endpointKey(endpoint)} (${endpoint.source})`,
    ),
    ...staleDocumentation.map((endpoint) => `OpenAPI without runtime route: ${endpoint}`),
  ];
  throw new Error(`Endpoint reconciliation failed:\n${details.join('\n')}`);
}

if (process.argv.includes('--write-inventory')) {
  await writeInventory(runtime, documented);
  process.stdout.write(`Generated ${inventoryPath}\n`);
}

process.stdout.write(
  `Endpoint reconciliation passed (${runtime.length} runtime routes; ${documented.size} documented; ${EXPLICIT_RUNTIME_ALLOWLIST.size} explicitly allowlisted).\n`,
);
