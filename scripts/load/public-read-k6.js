import http from 'k6/http';
import { check } from 'k6';

const baseUrl = __ENV.BASE_URL;
if (!baseUrl || !baseUrl.startsWith('https://')) {
  throw new Error('BASE_URL must be a deployed HTTPS origin.');
}

export const options = {
  scenarios: {
    read_only_catalog: {
      executor: 'constant-vus',
      vus: 100,
      duration: __ENV.DURATION ?? '2m',
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<1500'],
  },
};

export default function () {
  const response = http.get(`${baseUrl}/api/v1/public/room-types`, {
    tags: { endpoint: 'public-room-types' },
  });
  check(response, { 'room-types HTTP 200': (item) => item.status === 200 });
}
