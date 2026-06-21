-- Organization admins can manage event content through RLS, but deployed
-- contract authority must stay backend-owned. Keep service_role writes intact.
revoke update (nft_contract_address, role_admin_address) on events from anon, authenticated;
