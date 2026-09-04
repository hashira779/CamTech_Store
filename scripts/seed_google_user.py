#!/usr/bin/env python3
import sys
import os
sys.path.insert(0, os.path.dirname(__file__))
import run_remote as r

cmd = """
docker exec -i mystore-postgres psql -U camtech -d camtechStore << 'EOF'
-- Upsert into customers table
INSERT INTO customers (
    id, "organizationId", code, name, email, phone, type,
    "loyaltyPoints", "loyaltyTier", "storeCredit", notes, "isActive", "createdAt", "updatedAt"
) VALUES (
    'cust_toochhoy_google',
    'cmtn25rqc0000vk64wgyfvaov',
    'CUST-CHHOY779',
    'Too Chhoy',
    'hashira.toochhoy@gmail.com',
    '+855 12 345 678',
    'INDIVIDUAL',
    500,
    'Executive Gold',
    0.0,
    'Store Customer via Google OAuth',
    true,
    NOW(),
    NOW()
) ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    email = EXCLUDED.email,
    "loyaltyPoints" = EXCLUDED."loyaltyPoints",
    "loyaltyTier" = EXCLUDED."loyaltyTier",
    "updatedAt" = NOW();

-- Upsert into users table
INSERT INTO users (
    id, "organizationId", email, name, "passwordHash", roles, "isActive", "createdAt", "updatedAt"
) VALUES (
    'usr_toochhoy_google',
    'cmtn25rqc0000vk64wgyfvaov',
    'hashira.toochhoy@gmail.com',
    'Too Chhoy',
    'OAUTH_EXTERNAL_GOOGLE_SSO',
    '["CUSTOMER"]',
    true,
    NOW(),
    NOW()
) ON CONFLICT (email) DO UPDATE SET
    name = EXCLUDED.name,
    roles = EXCLUDED.roles,
    "isActive" = true,
    "updatedAt" = NOW();

SELECT id, email, name, roles FROM users WHERE email = 'hashira.toochhoy@gmail.com';
SELECT id, email, name, code, "loyaltyPoints", "loyaltyTier" FROM customers WHERE email = 'hashira.toochhoy@gmail.com';
EOF
"""
r.exec_remote(cmd)
