-- ─────────────────────────────────────────────────────────
-- ZENITH Fotobox-Dashboard – Initiales Schema
-- Ausführen als Supabase-Admin (SQL Editor oder CLI)
-- ─────────────────────────────────────────────────────────

-- ── TABELLEN ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS boxes (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name      text NOT NULL,
  subtitle  text,
  active    boolean DEFAULT true
);

CREATE TABLE IF NOT EXISTS customers (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company          text NOT NULL,
  contact          text,
  street           text,
  zip              text,
  city             text,
  email            text,
  phone            text,
  vat_id           text,
  moco_company_id  integer,
  created_at       timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS bookings (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  box_id           uuid REFERENCES boxes(id) NOT NULL,
  customer_id      uuid REFERENCES customers(id),
  title            text NOT NULL,
  location         text,
  start_date       date NOT NULL,
  end_date         date NOT NULL,
  logistics        text NOT NULL CHECK (logistics IN ('aufbau', 'abholung')),
  media_packages   integer DEFAULT 1,
  price_net        numeric(10,2),
  status           text DEFAULT 'option' CHECK (status IN ('option', 'bestaetigt', 'storniert')),
  moco_invoice_id  integer,
  invoice_status   text DEFAULT 'keine' CHECK (invoice_status IN ('keine', 'entwurf', 'bezahlt')),
  notes            text,
  created_at       timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS profiles (
  id    uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name  text,
  role  text DEFAULT 'team' CHECK (role IN ('team', 'buchhaltung', 'admin'))
);

-- ── ROW LEVEL SECURITY ───────────────────────────────────

ALTER TABLE boxes      ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers  ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings   ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles   ENABLE ROW LEVEL SECURITY;

-- boxes: alle Auth-Nutzer dürfen lesen; kein direktes Schreiben aus dem Client nötig
CREATE POLICY "boxes_select" ON boxes
  FOR SELECT TO authenticated USING (true);

-- customers: Auth-Nutzer dürfen lesen und schreiben
CREATE POLICY "customers_select" ON customers
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "customers_insert" ON customers
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "customers_update" ON customers
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- bookings: Auth-Nutzer dürfen lesen und schreiben (außer Rechnungsfelder → nur via Service-Role)
CREATE POLICY "bookings_select" ON bookings
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "bookings_insert" ON bookings
  FOR INSERT TO authenticated
  WITH CHECK (moco_invoice_id IS NULL AND invoice_status = 'keine');

CREATE POLICY "bookings_update" ON bookings
  FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (
    -- Rechnungsfelder darf der Client nicht selbst ändern
    moco_invoice_id IS NOT DISTINCT FROM (SELECT moco_invoice_id FROM bookings WHERE id = bookings.id)
    AND invoice_status IS NOT DISTINCT FROM (SELECT invoice_status FROM bookings WHERE id = bookings.id)
  );

-- Service-Role (Edge Function) darf alles – keine Policy nötig, da SECURITY DEFINER / service_role bypass

-- profiles: jeder sieht nur sein eigenes Profil
CREATE POLICY "profiles_select_own" ON profiles
  FOR SELECT TO authenticated USING (auth.uid() = id);

CREATE POLICY "profiles_insert_own" ON profiles
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

CREATE POLICY "profiles_update_own" ON profiles
  FOR UPDATE TO authenticated USING (auth.uid() = id);

-- ── AUTO-PROFIL BEI NEUEM USER ───────────────────────────

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, name, role)
  VALUES (new.id, new.raw_user_meta_data->>'name', 'team')
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
