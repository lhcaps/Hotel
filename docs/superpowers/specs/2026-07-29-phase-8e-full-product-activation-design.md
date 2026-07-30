# Phase 8E Design

Activate the existing product vertically rather than introducing new business capabilities. The authoritative public path is availability -> quote -> recommendation/coupon -> HOLD -> guest proof -> payment status. ADMIN remains isolated under `/admin`. Recommendations load against the existing API and only create a new quote after customer selection. OAuth configuration is diagnosable without exposing secrets.
