# Phase 8D.2 mixed-language report

`pnpm check:i18n-critical` scans 72 critical production Web files and excludes only dictionaries, tests, documentation, generated files and non-rendered stories. It completed with:

```text
DIRECT_VI_COPY_CRITICAL_SOURCE=0
```

The reusable English browser assertion checks the document language and known Vietnamese interface phrases while intentionally not treating customer/catalog/provider data as translated UI. It covered public search, customer profile/bookings, and ADMIN rate plans/coupons/bookings/operational reviews/payments at all four locked viewports.

```text
MIXED_LANGUAGE_CRITICAL_SCREENS=0
LOCALE_PERSISTENCE=PASS
```

Locale persistence was proved through reload, deterministic OAuth navigation, profile save/reload, and logout. Canonical codes, provider names, VND and status identities remain data; only their presentation labels are localized.
