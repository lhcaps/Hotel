SELECT 
  (SELECT COUNT(*) FROM pricing_policy_versions WHERE status = 'PUBLISHED') as versions,
  (SELECT COUNT(*) FROM pricing_policy_components WHERE policy_version_id = 'f9c8e7d6-b5a4-4321-9876-543210fedcba') as components,
  (SELECT COUNT(*) FROM pricing_policy_component_prices WHERE component_id IN 
    (SELECT id FROM pricing_policy_components WHERE policy_version_id = 'f9c8e7d6-b5a4-4321-9876-543210fedcba')) as prices,
  (SELECT COUNT(*) FROM pricing_policy_component_edges WHERE policy_version_id = 'f9c8e7d6-b5a4-4321-9876-543210fedcba') as edges;
