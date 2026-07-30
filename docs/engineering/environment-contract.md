# Environment contract

| Variable                                      | Owner / consumer                     | Required      | Secret        | Example / validation                                                  |
| --------------------------------------------- | ------------------------------------ | ------------- | ------------- | --------------------------------------------------------------------- |
| NODE_ENV, LOG_LEVEL                           | all processes                        | all           | no            | development/test/production; allowed log level                        |
| WEB_PORT, NEXT_PUBLIC_API_BASE_URL            | web                                  | web           | no            | 3000; absolute API URL                                                |
| API_HOST, API_PORT, WEB_ORIGIN                | API                                  | API           | no            | host/port; absolute allowed origin                                    |
| DATABASE_URL                                  | API/migrator/development seed        | API/migration | yes           | absolute PostgreSQL URL; no production localhost in local tooling     |
| TEST_DATABASE_URL                             | guarded integration/Playwright setup | tests         | yes           | loopback PostgreSQL URL whose database begins `room_management_test_` |
| REDIS_URL                                     | API/worker                           | API/worker    | yes           | absolute Redis URL                                                    |
| MAIL_HOST, MAIL_PORT, MAIL_FROM               | API                                  | API           | no            | Mailpit host/port; valid sender email                                 |
| POSTGRES_USER, POSTGRES_PASSWORD, POSTGRES_DB | Docker Compose                       | local         | password only | local database bootstrap values                                       |

Server variables never use `NEXT_PUBLIC_`. Missing variables fail startup with variable names only; values are never echoed.

`DATABASE_URL` is a connection input, not an authorization to mutate a persistent environment. Only the database package creates pools and each owner closes its pool. `TEST_DATABASE_URL` is validated before a disposable database is created or dropped; it must not point to a production or shared persistent database. Redis has no consistency role and is not a substitute for PostgreSQL transactional checks.
