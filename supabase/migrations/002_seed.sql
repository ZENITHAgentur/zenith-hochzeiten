-- ─────────────────────────────────────────────────────────
-- Seed: die vier ZENITH-Fotoboxen anlegen
-- ─────────────────────────────────────────────────────────

INSERT INTO boxes (name, subtitle, active) VALUES
  ('Classic Box',  'Klassische Fotobox',   true),
  ('Magic Mirror', 'Spiegel-Fotobox',      true),
  ('360° Box',     '360-Grad-Videobox',    true),
  ('Slim Box',     'Schlanke Schlanklinie', true)
ON CONFLICT DO NOTHING;
