SELECT id, version_number, status, applicability_basis, timezone_snapshot, effective_from, effective_until
FROM pricing_policy_versions 
WHERE status = 'PUBLISHED' 
ORDER BY version_number DESC 
LIMIT 1;

SELECT id, policy_version_id, component_code, billing_model, boundary_position
FROM pricing_policy_components
WHERE policy_version_id = (SELECT id FROM pricing_policy_versions WHERE status = 'PUBLISHED' ORDER BY version_number DESC LIMIT 1)
ORDER BY component_code;

SELECT id, component_id, price_tier_id, amount_vnd
FROM pricing_policy_component_prices
WHERE component_id IN (
  SELECT id FROM pricing_policy_components 
  WHERE policy_version_id = (SELECT id FROM pricing_policy_versions WHERE status = 'PUBLISHED' ORDER BY version_number DESC LIMIT 1)
)
ORDER BY component_id, price_tier_id;

SELECT id, policy_version_id, predecessor_component_id, successor_component_id
FROM pricing_policy_component_edges
WHERE policy_version_id = (SELECT id FROM pricing_policy_versions WHERE status = 'PUBLISHED' ORDER BY version_number DESC LIMIT 1)
ORDER BY id;
