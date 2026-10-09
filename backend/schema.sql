-- ============================================================
-- PO Financing Platform - PostgreSQL Schema
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto"; -- for gen_random_uuid()

-- ------------------------------------------------------------
-- ENUM TYPES
-- ------------------------------------------------------------
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('SUPPLIER', 'ADMIN');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE po_status AS ENUM ('UPLOADED', 'FINANCING_REQUESTED', 'CLOSED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE application_status AS ENUM ('PENDING', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'FUNDED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- ------------------------------------------------------------
-- USERS
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cognito_sub     VARCHAR(128) UNIQUE NOT NULL,
    email           VARCHAR(255) UNIQUE NOT NULL,
    role            user_role NOT NULL DEFAULT 'SUPPLIER',
    company_name    VARCHAR(255) NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_users_cognito_sub ON users(cognito_sub);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- ------------------------------------------------------------
-- PURCHASE ORDERS
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS purchase_orders (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    supplier_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    po_number           VARCHAR(100) NOT NULL,
    buyer_name          VARCHAR(255) NOT NULL,
    total_value         NUMERIC(18, 2) NOT NULL CHECK (total_value > 0),
    currency            VARCHAR(3) NOT NULL DEFAULT 'USD',
    document_s3_key   VARCHAR(512) NOT NULL,
    status              po_status NOT NULL DEFAULT 'UPLOADED',
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_po_supplier_id ON purchase_orders(supplier_id);
CREATE INDEX IF NOT EXISTS idx_po_status ON purchase_orders(status);

-- ------------------------------------------------------------
-- FINANCING APPLICATIONS
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS financing_applications (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    po_id               UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
    supplier_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    requested_amount    NUMERIC(18, 2) NOT NULL CHECK (requested_amount > 0),
    status              application_status NOT NULL DEFAULT 'PENDING',
    admin_notes         TEXT,
    reviewed_by         UUID REFERENCES users(id),
    reviewed_at         TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_apps_supplier_id ON financing_applications(supplier_id);
CREATE INDEX IF NOT EXISTS idx_apps_po_id ON financing_applications(po_id);
CREATE INDEX IF NOT EXISTS idx_apps_status ON financing_applications(status);

-- ------------------------------------------------------------
-- updated_at trigger helper
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_users_updated_at ON users;
CREATE TRIGGER trg_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_po_updated_at ON purchase_orders;
CREATE TRIGGER trg_po_updated_at BEFORE UPDATE ON purchase_orders
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_apps_updated_at ON financing_applications;
CREATE TRIGGER trg_apps_updated_at BEFORE UPDATE ON financing_applications
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
