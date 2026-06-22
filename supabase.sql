-- SQL Setup untuk Supabase POS Cafe

-- 1. Tabel Products
CREATE TABLE products (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  price NUMERIC NOT NULL,
  category TEXT NOT NULL,
  stock INT NOT NULL DEFAULT 0,
  description TEXT,
  image TEXT,
  isPopular BOOLEAN DEFAULT false,
  isPromo BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Tabel Orders
CREATE TABLE orders (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  short_id TEXT,
  customer_name TEXT,
  table_number TEXT,
  items JSONB NOT NULL,
  subtotal NUMERIC,
  waitress_fee NUMERIC,
  discount NUMERIC,
  grand_total NUMERIC NOT NULL,
  payment_method TEXT,
  payment_status TEXT DEFAULT 'Waiting Payment',
  order_status TEXT DEFAULT 'Pending',
  rating INT,
  review TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Tabel Vouchers
CREATE TABLE vouchers (
  code TEXT PRIMARY KEY,
  discountPercentage NUMERIC NOT NULL,
  maxDiscount NUMERIC NOT NULL,
  minTransaction NUMERIC NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Kebijakan RLS (Row Level Security)
-- Agar simpel, kita buat tabel ini public untuk semua (anon/authenticated).
-- Di production, Anda harus membatasi akses berdasarkan auth.uid().
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public Access Products" ON products FOR ALL USING (true);

ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public Access Orders" ON orders FOR ALL USING (true);

ALTER TABLE vouchers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public Access Vouchers" ON vouchers FOR ALL USING (true);

-- Realtime Setup
-- Mengaktifkan Realtime Supabase untuk tabel orders
ALTER PUBLICATION supabase_realtime ADD TABLE orders;
