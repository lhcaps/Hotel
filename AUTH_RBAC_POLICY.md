# Authentication and RBAC policy

Roles are CUSTOMER, ADMIN and SYSTEM_WORKER. Authentication differs from authorization; permission checks are server-side. Guest booking access requires email OTP. The worker has scoped workload identity and never inherits ADMIN authority. Phase 1 implements no authentication.
