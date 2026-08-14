import type { Locale, MessageKey } from './i18n/messages';
import { translate } from './i18n/messages';
import type { FieldErrorState } from './form-error';

type KeyByCode = Readonly<Record<string, MessageKey>>;

const VI_KEY_BY_CODE: KeyByCode = {
  ADMIN_EMAIL_CONFLICT: 'admin.errors.emailConflict',
  ADMIN_ACCOUNT_NOT_FOUND: 'admin.errors.accountNotFound',
  AUTH_ACCOUNT_CREATION_UNAVAILABLE: 'admin.errors.authUnavailable',
  AUTH_ACCOUNT_CREATION_FAILED: 'admin.errors.authUnavailable',
  DEPARTMENT_NOT_FOUND: 'admin.errors.departmentNotFound',
  PROPERTY_NOT_FOUND: 'admin.errors.propertyNotFound',
  PROPERTY_SCOPE_REQUIRED: 'admin.errors.propertyScopeRequired',
  SUPER_ADMIN_PROPERTY_SCOPE_IMPLICIT: 'admin.errors.superAdminPropertyImplicit',
  SUPER_ADMIN_REQUIRED: 'admin.errors.superAdminRequired',
  SUPER_ADMIN_TARGET_FORBIDDEN: 'admin.errors.superAdminTargetForbidden',
  STAFF_MANAGER_PROFILE_NOT_DELEGABLE: 'admin.errors.staffManagerNotDelegable',
  STAFF_MANAGER_PROPERTY_SCOPE_VIOLATION: 'admin.errors.staffManagerScopeViolation',
  STAFF_MANAGER_SUPER_ADMIN_FORBIDDEN: 'admin.errors.staffManagerSuperAdminForbidden',
  STAFF_MANAGER_GRANT_SELF_FORBIDDEN: 'admin.errors.staffManagerGrantSelf',
  STAFF_MANAGER_ESCALATION_FORBIDDEN: 'admin.errors.staffManagerEscalationForbidden',
  STAFF_MANAGER_PROPERTY_GRANT_FORBIDDEN: 'admin.errors.staffManagerPropertyGrant',
  SELF_DISABLE_FORBIDDEN: 'admin.errors.selfDisableForbidden',
  SELF_PROFILE_CHANGE_FORBIDDEN: 'admin.errors.selfProfileChangeForbidden',
  SELF_MEMBERSHIP_CHANGE_FORBIDDEN: 'admin.errors.selfMembershipChangeForbidden',
  SELF_PROPERTY_SCOPE_CHANGE_FORBIDDEN: 'admin.errors.selfPropertyScopeChangeForbidden',
  LAST_SUPER_ADMIN_FORBIDDEN: 'admin.errors.lastSuperAdminForbidden',
  ADMIN_PROFILE_REQUIRED: 'admin.errors.adminProfileRequired',
  DEPARTMENT_REQUIRED: 'admin.errors.departmentRequired',
  INVALID_DEPARTMENT_ID: 'admin.errors.invalidDepartmentId',
  CUSTOMER_ACCOUNT_NOT_FOUND: 'admin.errors.customerAccountNotFound',
  CUSTOMER_SESSIONS_REVOKED: 'admin.errors.sessionsRevoked',
  VALIDATION_ERROR: 'admin.errors.validationError',
};

const EN_KEY_BY_CODE: KeyByCode = {
  ...VI_KEY_BY_CODE,
};

export function localizeProblemCode(locale: Locale, code: string | undefined): string | undefined {
  if (code === undefined) return undefined;
  const table = locale === 'vi' ? VI_KEY_BY_CODE : EN_KEY_BY_CODE;
  const key = table[code];
  if (key !== undefined) return translate(locale, key);
  return undefined;
}

export interface MappedFieldError extends FieldErrorState {
  readonly formError?: string;
  readonly requestId?: string;
}

export function mapProblemDetails(
  locale: Locale,
  code: string | undefined,
  requestId: string | undefined,
  fallbackKey: MessageKey,
): { formError: string; requestId?: string } {
  const localized = localizeProblemCode(locale, code);
  if (localized !== undefined) {
    return { formError: localized, ...(requestId !== undefined ? { requestId } : {}) };
  }
  const suffix =
    requestId === undefined
      ? ''
      : ` ${translate(locale, 'admin.errors.requestIdSuffix', { id: requestId })}`;
  return {
    formError: `${translate(locale, fallbackKey)}${suffix}`,
    ...(requestId !== undefined ? { requestId } : {}),
  };
}
