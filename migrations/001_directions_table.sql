-- Migration 001: Add directions system (many-to-many)
-- SAFE: Only ADD operations, no DROP/RENAME. Idempotent — safe to run multiple times.

-- 1. Create directions reference table
CREATE TABLE IF NOT EXISTS directions (
    id SERIAL PRIMARY KEY,
    slug VARCHAR(50) NOT NULL UNIQUE,
    label VARCHAR(100) NOT NULL,
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW()
);

-- 2. Seed default directions (ON CONFLICT = safe to re-run)
INSERT INTO directions (slug, label, sort_order) VALUES
    ('casino', 'Casino', 1),
    ('sport', 'Sport', 2),
    ('other', 'Other', 3)
ON CONFLICT (slug) DO NOTHING;

-- 3. Create junction table for template <-> direction (many-to-many)
CREATE TABLE IF NOT EXISTS template_directions (
    template_id INTEGER NOT NULL REFERENCES templates(id) ON DELETE CASCADE,
    direction_id INTEGER NOT NULL REFERENCES directions(id) ON DELETE CASCADE,
    PRIMARY KEY (template_id, direction_id)
);

-- 4. Migrate existing data: COPY from templates.direction to template_directions
-- The old templates.direction column is NOT deleted — kept for backward compatibility
INSERT INTO template_directions (template_id, direction_id)
SELECT t.id, d.id
FROM templates t
JOIN directions d ON d.slug = t.direction
WHERE t.direction IS NOT NULL AND t.direction != ''
ON CONFLICT DO NOTHING;

-- 5. Add columns to telegram_download_log (safe ADD COLUMN IF NOT EXISTS)
ALTER TABLE telegram_download_log ADD COLUMN IF NOT EXISTS download_format VARCHAR(10) DEFAULT 'single';
ALTER TABLE telegram_download_log ADD COLUMN IF NOT EXISTS items_count INTEGER DEFAULT 1;
ALTER TABLE telegram_download_log ADD COLUMN IF NOT EXISTS zip_filename VARCHAR(255);
