-- Database initialization for banner generator

-- Templates table
CREATE TABLE IF NOT EXISTS templates (
    id SERIAL PRIMARY KEY,
    template_name VARCHAR(255) NOT NULL DEFAULT 'New Template',
    direction VARCHAR(50) NOT NULL DEFAULT 'universal',
    template_type VARCHAR(10) NOT NULL DEFAULT 'video',
    client_access BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Template images table (each template can have multiple geo/currency variants)
CREATE TABLE IF NOT EXISTS template_images (
    id SERIAL PRIMARY KEY,
    template_id INTEGER NOT NULL REFERENCES templates(id) ON DELETE CASCADE,
    geo VARCHAR(10),
    currency VARCHAR(10),
    image_url TEXT,
    text_size INTEGER DEFAULT 45,
    skew_angle FLOAT DEFAULT 0,
    text_alignment VARCHAR(10) DEFAULT 'center',
    text_color VARCHAR(20) DEFAULT '#FFFFFF',
    position_x INTEGER DEFAULT 500,
    position_y INTEGER DEFAULT 500,
    promo_start FLOAT DEFAULT 0,
    promo_end FLOAT DEFAULT 0,
    size VARCHAR(10) DEFAULT '1x1',
    created_at TIMESTAMP DEFAULT NOW()
);

-- Country/currency reference table (used by admin autocomplete)
CREATE TABLE IF NOT EXISTS country_currencies (
    id SERIAL PRIMARY KEY,
    country VARCHAR(10) NOT NULL,
    currency VARCHAR(10) NOT NULL,
    UNIQUE(country, currency)
);

-- Geos reference table
CREATE TABLE IF NOT EXISTS geos (
    id SERIAL PRIMARY KEY,
    name VARCHAR(10) NOT NULL UNIQUE
);

-- Seed geo/currency pairs
INSERT INTO country_currencies (country, currency) VALUES
    ('AM', 'AMD'), ('AE', 'AED'), ('AR', 'ARS'), ('AT', 'EUR'),
    ('AU', 'AUD'), ('AZ', 'AZN'), ('BE', 'EUR'), ('BR', 'BRL'),
    ('CA', 'CAD'), ('CH', 'CHF'), ('CL', 'CLP'), ('CO', 'COP'),
    ('CZ', 'CZK'), ('DE', 'EUR'), ('DK', 'DKK'), ('EG', 'EGP'),
    ('ES', 'EUR'), ('FI', 'EUR'), ('FR', 'EUR'), ('GE', 'GEL'),
    ('GR', 'EUR'), ('HU', 'HUF'), ('ID', 'IDR'), ('IN', 'INR'),
    ('IT', 'EUR'), ('JP', 'JPY'), ('KE', 'KES'), ('KR', 'KRW'),
    ('KZ', 'KZT'), ('MX', 'MXN'), ('MY', 'MYR'), ('NG', 'NGN'),
    ('NL', 'EUR'), ('NO', 'NOK'), ('NZ', 'NZD'), ('PE', 'PEN'),
    ('PH', 'PHP'), ('PL', 'PLN'), ('PT', 'EUR'), ('RO', 'RON'),
    ('RU', 'RUB'), ('SA', 'SAR'), ('SE', 'SEK'), ('SG', 'SGD'),
    ('SK', 'EUR'), ('TH', 'THB'), ('TR', 'TRY'), ('UA', 'UAH'),
    ('US', 'USD'), ('VN', 'VND'), ('ZA', 'ZAR')
ON CONFLICT DO NOTHING;

INSERT INTO geos (name) VALUES
    ('AM'), ('AE'), ('AR'), ('AT'), ('AU'), ('AZ'), ('BE'), ('BR'),
    ('CA'), ('CH'), ('CL'), ('CO'), ('CZ'), ('DE'), ('DK'), ('EG'),
    ('ES'), ('FI'), ('FR'), ('GE'), ('GR'), ('HU'), ('ID'), ('IN'),
    ('IT'), ('JP'), ('KE'), ('KR'), ('KZ'), ('MX'), ('MY'), ('NG'),
    ('NL'), ('NO'), ('NZ'), ('PE'), ('PH'), ('PL'), ('PT'), ('RO'),
    ('RU'), ('SA'), ('SE'), ('SG'), ('SK'), ('TH'), ('TR'), ('UA'),
    ('US'), ('VN'), ('ZA')
ON CONFLICT DO NOTHING;

-- Optional: Telegram download log
CREATE TABLE IF NOT EXISTS telegram_download_log (
    id SERIAL PRIMARY KEY,
    telegram_user_id BIGINT NOT NULL,
    template_image_id INTEGER REFERENCES template_images(id),
    promo_text VARCHAR(255),
    download_type VARCHAR(10),
    created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================
-- Migration 001: Directions system (many-to-many)
-- SAFE: Only ADD operations. Idempotent — safe to run multiple times.
-- ============================================================

-- Directions reference table
CREATE TABLE IF NOT EXISTS directions (
    id SERIAL PRIMARY KEY,
    slug VARCHAR(50) NOT NULL UNIQUE,
    label VARCHAR(100) NOT NULL,
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Seed default directions
INSERT INTO directions (slug, label, sort_order) VALUES
    ('casino', 'Casino', 1),
    ('sport', 'Sport', 2),
    ('other', 'Other', 3)
ON CONFLICT (slug) DO NOTHING;

-- Junction table for template <-> direction (many-to-many)
CREATE TABLE IF NOT EXISTS template_directions (
    template_id INTEGER NOT NULL REFERENCES templates(id) ON DELETE CASCADE,
    direction_id INTEGER NOT NULL REFERENCES directions(id) ON DELETE CASCADE,
    PRIMARY KEY (template_id, direction_id)
);

-- Migrate existing data from templates.direction → template_directions
-- Old column is NOT deleted — kept for backward compatibility
INSERT INTO template_directions (template_id, direction_id)
SELECT t.id, d.id
FROM templates t
JOIN directions d ON d.slug = t.direction
WHERE t.direction IS NOT NULL AND t.direction != ''
ON CONFLICT DO NOTHING;

-- Add new columns to download log (safe — IF NOT EXISTS)
ALTER TABLE telegram_download_log ADD COLUMN IF NOT EXISTS download_format VARCHAR(10) DEFAULT 'single';
ALTER TABLE telegram_download_log ADD COLUMN IF NOT EXISTS items_count INTEGER DEFAULT 1;
ALTER TABLE telegram_download_log ADD COLUMN IF NOT EXISTS zip_filename VARCHAR(255);
