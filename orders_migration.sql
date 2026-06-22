-- Jalankan script SQL ini di fitur SQL Editor pada dashboard Supabase Anda
CREATE TABLE IF NOT EXISTS orders (
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

-- Atur kebijakan (RLS) agar endpoint kita dapat membaca/menulis tabel ini.
-- Di production, sesuaikan kembali keamanan RLS jika diperlukan.
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public Access Orders" ON orders FOR ALL USING (true);
