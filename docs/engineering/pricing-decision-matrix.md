# Pricing decision matrix

| Condition in Asia/Ho_Chi_Minh               | Selected base    | Extra                     |
| ------------------------------------------- | ---------------- | ------------------------- |
| duration `>16h` to `24h`                    | DAY_COMBO        | none                      |
| check-in `>=18:00`, duration `>5h` to `16h` | NIGHT_COMBO      | started hours after five  |
| check-in `[11:00,15:00)`, duration `<=16h`  | LUNCH_COMBO      | started hours after three |
| duration `>4h` to `16h`                     | FIVE_HOUR_COMBO  | started hours after five  |
| duration `1h` to `4h`                       | THREE_HOUR_COMBO | started hours after three |

Examples: 3h uses Three; 3h15 and 4h use Three plus one extra; 4h15 and 5h use Five; 5h15 uses Five plus one extra; exactly 16h is not Day; 16h15 is Day. Lunch begins at 11:00 and ends exclusively at 15:00. Integer VND is used throughout.
