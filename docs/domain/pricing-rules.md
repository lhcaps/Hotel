# Quy tac gia

**Trang thai (Phase 8B.1):** DANG su dung chinh sach
`CHEAPEST_ELIGIBLE_THEN_PRIORITY` cho moi quote moi
(`phase-8b-cheapest-eligible-pricing-v1`). Chinh sach
`PRIORITY_WINS_LEGACY` chi con la audit/legacy fallback cho quote cu co
rule version `phase-7b-data-driven-pricing-v1` hoac cu hon.
**Tien te:** integer VND, khong floating-point (`INV-028`).
**Timezone gia:** `Asia/Ho_Chi_Minh`. Gia la configuration cua price
tier/rate plan, ADMIN co the them rate-plan code moi (vi du
`SIX_HOUR_FLEX`) qua `RatePlanManager` ma khong can code change. Code
phai khop regex `^[A-Z0-9_]{1,64}$`.

## Input, output va precedence

Input gom room type, price tier, `[checkIn, checkOut)`, adults, children va coupon. Output gom base rule, included duration, extra units, gross, discount, final amount va quote expiry. Rule co priority cao nhat phu hop chon base combo; extra la component bo sung cua base combo, khong la base rule canh tranh.

Selection metadata owned by ADMIN through `rate_plans` (one row per rule):

- `is_base_plan` — `false` only for `EXTRA_HOUR`.
- `min_check_in_minute_inclusive` va `max_check_in_minute_exclusive` —
  optional 15-minute window in `Asia/Ho_Chi_Minh`. Both `NULL` means
  no time-of-day restriction. Cross-midnight windows are rejected.
- `min_duration_minutes_inclusive` va
  `max_duration_minutes_inclusive` — required 15-minute grid between
  60 and 1440 for base plans.
- `priority` — safe integer in `[0, 1000]`.

Stage 7B default backfill (mirrors the Phase 0 hardcoded chain):

| Plan              | Priority | Time window           | Duration window           | Included |
|-------------------|---------:|-----------------------|---------------------------|---------:|
| DAY_COMBO         |   100    | none                  | 975..1440                 |   1440   |
| NIGHT_COMBO       |    90    | 1080..1440            | 315..960                  |    300   |
| LUNCH_COMBO       |    80    | 660..900              | 60..960                   |    180   |
| FIVE_HOUR_COMBO   |    70    | none                  | 255..960                  |    300   |
| THREE_HOUR_COMBO  |    60    | none                  | 60..240                   |    180   |
| EXTRA_HOUR        |     -    | n/a (no selection)    | n/a                       |     60   |

**Boundary khoa (15-minute grid only):** check-in `10:45`, `11:00`,
`14:45`, `15:00`, `15:15`, `17:45`, `18:00` la cac moc reachable. `02:59`,
`14:59`, `15:01` chi la mo ta con nguoi cua "truoc 15:00", khong phai
public timestamp hop le. Duration `1h00`, `2h45`, `3h00`, `3h15`,
`4h00`, `4h15`, `5h00`, `5h15`, `16h00`, `16h15`, `24h00` la cac moc
reachable; `2h59`, `3h01`, `4h01`, `5h01`, `16h01` bi tu choi
`InvalidPricingIntervalError`. Booking hon 24h bi tu choi.

**Boundary outcomes (preserved from Phase 0):**

| Case                                  | Selected plan              | Extra units |
|---------------------------------------|----------------------------|------------:|
| 4h00 exact                            | THREE_HOUR_COMBO           | 1           |
| 4h15                                  | FIVE_HOUR_COMBO            | 0           |
| 5h00                                  | FIVE_HOUR_COMBO            | 0           |
| 5h15 before 18:00                     | FIVE_HOUR_COMBO            | 1           |
| 18:00 exactly with 5h00               | FIVE_HOUR_COMBO            | 0           |
| 18:00 with 5h15                       | NIGHT_COMBO                | 1           |
| 16h00                                 | not DAY_COMBO              | n/a         |
| 16h15                                 | DAY_COMBO                  | 0           |
| 24h00                                 | DAY_COMBO                  | 0           |
| 24h15                                 | InvalidPricingIntervalError | n/a        |

## Price catalog va activation

Room type duoc ADMIN gan price tier/rate plan. Initial `LUNCH_COMBO` tiers la TIER_1=359000, TIER_2=419000, TIER_3=489000 VND (S-001/S-002). Tat ca amount khac - `THREE_HOUR_COMBO`, `FIVE_HOUR_COMBO`, `NIGHT_COMBO`, `DAY_COMBO`, `EXTRA_HOUR` - la operational catalog data theo tier/room type. Rule co required amount bi thieu MUST NOT ACTIVE. Mapping room type-tier va non-lunch amount can co truoc production activation, khong chan Phase 0.

Moi record rule dung cho property duy nhat, tat ca weekdays va dates trong MVP, tru khi ADMIN cau hinh date/weekday scope ro rang. Record MUST co rule ID, status ACTIVE/INACTIVE, room type hoac price tier, check-in window, duration condition, capacity condition, base amount, extra amount neu ap dung, currency VND, rounding, priority, stacking/conflict behavior, source evidence va boundary case. Rule khong stacking voi base combo khac; chi `EXTRA_HOUR` duoc cong vao base combo co included duration.

| Rule template | Applicable | Included | Amount | Conflict | Evidence |
|---|---|---:|---|---|---|
| PRC-001 Day | >16h..24h | 24h | configured DAY_COMBO | priority 100 | S-002 |
| PRC-002 Night | >=18:00, >5h..16h | 5h | configured NIGHT + EXTRA | wins over Lunch/Five/Three | S-002 |
| PRC-003 Lunch | 11:00..14:59, <=16h when not Day/Night | 3h | configured tier; initial tiers stated above | wins over duration rules | S-001/S-002 |
| PRC-004 Three | 1h..3h, not Lunch | 3h | configured THREE_HOUR | lower than time rules | S-002 |
| PRC-005 Three + extra | >3h..4h, not Lunch/Night/Day | 3h | THREE_HOUR + 1 EXTRA | deterministic boundary | S-002 |
| PRC-006 Five | >4h..5h, not Night/Day/Lunch | 5h | configured FIVE_HOUR | wins over Three | S-002 |
| PRC-007 Five + extra | >5h..16h, check-in <18:00, not Lunch/Day | 5h | FIVE_HOUR + EXTRA | lower than Lunch | S-002 |

## Rounding, occupancy, tax va snapshot

- Input phai theo increment 15 phut; duration minimum 60 phut. Extra billing unit 60 phut va lam tron len: 1-60 phut=1, 61-120=2, 121-180=3.
- Children chi validate capacity; khong surcharge child, infant hay age model MVP. `adults >=1`, `children >=0`, va capacity room type MUST pass.
- Tax va service fee: MVP price catalog MUST luu ro amount la gia cuoi cung da bao gom cac khoan ap dung; khong co fee/tax formula an. Quote hien thi gross, coupon discount va final amount integer VND.
- Quote het han sau 15 phut. HOLD tai tinh gia server-side va luu snapshot. CONFIRMED booking khong doi lich su khi rule/catalog thay doi (`INV-006`, `INV-029`).

## Boundary examples

| Case | Start | End | Duration | Expected base | Extra |
|---|---|---|---:|---|---:|
| Lunch exact | 11:00 | 14:00 | 3h | Lunch | 0 |
| Lunch before end | 14:59 | 17:59 | 3h | Lunch | 0 |
| Lunch excess | 11:15 | 14:30 | 3h15 | Lunch | 1 |
| Three exact | 15:00 | 18:00 | 3h | Three-hour | 0 |
| Four exact | 15:00 | 19:00 | 4h | Three-hour | 1 |
| Five exact at night | 18:00 | 23:00 | 5h | Five-hour | 0 |
| Night threshold | 18:00 | 23:15 | 5h15 | Night | 1 |
| Day threshold | 08:00 | 00:15 | 16h15 | Day | 0 |
| Cross midnight | 18:00 | 00:15 | 6h15 | Night | 2 |

`PRC-009`: gia client gui len chi dung de so sanh/debug, khong bao gio la authoritative. Coupon duoc ap dung sau gross price, theo [coupon rules](coupon-rules.md).

## Phase 8B — Cheapest-eligible pricing

`PRC-010`: Bat dau Phase 8B, moi quote moi duoc chon theo chinh sach
`CHEAPEST_ELIGIBLE_THEN_PRIORITY` thay vi priority-wins. Lich su quote cu
giu nguyen rule version cu, khong reprice.

- Moi ACTIVE base plan co the cover check-in va duration duoc tinh gross:
  `base_amount + extra_units * extra_unit_price`, moi gia tri la integer VND.
- Candidate co gross nho nhat duoc chon.
- Tie-break theo thu tu: gross nho hon → priority cao hon → extra units it
  hon → stable plan code ordering (`KNOWN_BASE_PLAN_CODES` truoc, sau do
  theo alphabetical).
- Activation validation (`ruleSetValidationFromCatalog`) dam bao moi ACTIVE
  plan co gia integer duong; khong cho phep duration window nghich; neu
  nhieu ACTIVE base plan share cung priority trong cung check-in window
  thi he thong tu choi vi khong con cach chon deterministic. Bang gia
  va gross co the trung nhau qua plan khac nhau (vi du THREE_HOUR 300k
  va LUNCH 359k cung ACTIVE) vi stable plan-code ordering lam tie-break
  quyet dinh.
- `RULE_VERSION_PHASE_8B = 'phase-8b-cheapest-eligible-pricing-v1'` duoc luu
  trong moi quote snapshot; schema Zod `pricingRuleVersionSchema` chap
  nhan dong thoi `phase-4-pricing-availability-v1`, `phase-7b-data-driven-pricing-v1`
  va `phase-8b-cheapest-eligible-pricing-v1` de docs snapshot lich su van
  doc duoc.
- `calculatePricingWithStrategy(input, catalog, strategy)` la bien gioi
  chien luoc: `CHEAPEST_ELIGIBLE_THEN_PRIORITY` (mac dinh moi quote moi) hoac
  `PRIORITY_WINS_LEGACY` (audit va back-fill chi).

## Phase 8B.1 — Admin catalog extensibility + regression closure

`PRC-011`: Bat dau Phase 8B.1, `rate_plans.code` khong con bi gioi han
trong danh sach dong (`THREE_HOUR_COMBO`, `FIVE_HOUR_COMBO`, `LUNCH_COMBO`,
`NIGHT_COMBO`, `DAY_COMBO`, `EXTRA_HOUR`). Check constraint
`rate_plans_code_ck` bi thay boi `rate_plans_code_format_ck` voi regex
`^[A-Z0-9_]{1,64}$` trong migration `0016_phase8b1_admin_catalog_extensibility.sql`.
ADMIN co the luu rate-plan code bat ky khop regex (vi du
`SIX_HOUR_FLEX`) qua `RatePlanManager` ma khong can deploy code moi.
`EXTRA_HOUR` van duoc giu rieng cho `is_base_plan = false` qua check
`rate_plans_is_base_plan_ck`.

