# Current release pipeline after Wave 1

The canonical source path is: immutable application images -> manifest generation/verification -> per-service environment validation/rendering -> isolated governed preflight/deploy -> strict attestation/topology validation -> governed rollback when required.

The production Compose configuration no longer builds application images from the checkout. It requires `WEB_IMAGE`, `API_IMAGE`, `WORKER_IMAGE`, and `PAYMENT_DEMO_IMAGE`; a release renderer must supply immutable image references from the verified manifest.

This document describes tracked source intent only. It is not evidence that the existing production runtime is canonical. The current production state is explicitly divergent in [WAVE0_PRODUCTION_TRUTH.md](../stabilization/WAVE0_PRODUCTION_TRUTH.md).
