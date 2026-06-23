-- Supabase SQL Schema for POS Cafe
-- This schema matches the TypeScript interfaces defined in `/src/types.ts`
-- You can copy and paste this entire block into the Supabase SQL Editor to run it.

-- 1. Create Enums for strict type checking
CREATE TYPE menu_category AS ENUM ('Coffee', 'Non Coffee', 'Tea', 'Snack', 'Dessert', 'Main Course');
CREATE TYPE order_status AS ENUM ('Pending', 'Paid', 'Preparing', 'Ready', 'Delivered', 'Completed', 'Cancelled');
CREATE TYPE payment_status AS ENUM ('Unpaid', 'Waiting Payment', 'Paid', 'Failed', 'Refunded');
CREATE TYPE delivery_type AS ENUM ('Ambil Sendiri', 'Diantar ke Meja');
CREATE TYPE payment_method AS ENUM ('Cash', 'Cashless', 'QRIS', 'GoPay', 'OVO', 'DANA', 'ShopeePay', 'Virtual Account', 'Credit Card');
CREATE TYPE table_status AS ENUM ('Empty', 'Occupied', 'Reserved');
CREATE TYPE user_role AS ENUM ('Admin', 'Kasir', 'Kitchen', 'Waitress', 'Customer');
CREATE TYPE waiter_call_status AS ENUM ('Waiting', 'Accepted', 'Completed');

-- 2. Create Users Table
CREATE TABLE public.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  role user_role NOT NULL DEFAULT 'Customer',
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Create Products Table
CREATE TABLE public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category menu_category NOT NULL,
  price NUMERIC NOT NULL,
  "originalPrice" NUMERIC,
  description TEXT,
  image TEXT,
  stock INTEGER NOT NULL DEFAULT 0,
  "min_stock_alert" INTEGER NOT NULL DEFAULT 10,
  "isPopular" BOOLEAN DEFAULT false,
  "isPromo" BOOLEAN DEFAULT false,
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Create Tables Table (for restaurant seating)
CREATE TABLE public.tables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  number TEXT NOT NULL UNIQUE,
  "qrCodeUrl" TEXT,
  status table_status NOT NULL DEFAULT 'Empty',
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Create Vouchers Table
CREATE TABLE public.vouchers (
  code TEXT PRIMARY KEY,
  "discountPercentage" NUMERIC NOT NULL DEFAULT 0,
  "minTransaction" NUMERIC,
  description TEXT,
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5b. Create Settings Table for App Config
CREATE TABLE public.settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  value TEXT NOT NULL,
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. Create Orders Table
CREATE TABLE public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "shortId" TEXT NOT NULL UNIQUE,
  "tableNumber" TEXT NOT NULL,
  "deliveryType" delivery_type NOT NULL,
  subtotal NUMERIC NOT NULL,
  "waitressFee" NUMERIC NOT NULL DEFAULT 0,
  discount NUMERIC NOT NULL DEFAULT 0,
  "grandTotal" NUMERIC NOT NULL,
  "paymentMethod" payment_method,
  "paymentStatus" payment_status NOT NULL DEFAULT 'Unpaid',
  "orderStatus" order_status NOT NULL DEFAULT 'Pending',
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  "customerName" TEXT NOT NULL,
  "customerPhone" TEXT,
  rating INTEGER,
  review TEXT
);

-- 7. Create Order Items Table (Linked to Orders and Products)
CREATE TABLE public.order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "orderId" UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  "productId" UUID NOT NULL REFERENCES public.products(id),
  name TEXT NOT NULL,
  price NUMERIC NOT NULL,
  quantity INTEGER NOT NULL,
  notes TEXT,
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 8. Create Reviews Table
CREATE TABLE public.reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "orderId" UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  "customerName" TEXT NOT NULL,
  rating INTEGER NOT NULL,
  comment TEXT,
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  "menuItemNames" TEXT[] -- Array of names for the items reviewed
);

-- 9. Create Stock Logs Table
CREATE TABLE public.stock_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "productId" UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  type TEXT NOT NULL, -- 'IN' or 'OUT'
  quantity INTEGER NOT NULL,
  notes TEXT,
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 10. Create Waiter Calls Table
CREATE TABLE public.waiter_calls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tableNumber" TEXT NOT NULL,
  status waiter_call_status NOT NULL DEFAULT 'Waiting',
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  "completedAt" TIMESTAMP WITH TIME ZONE
);

-- Setup Row Level Security (RLS)
-- Enable RLS on all tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vouchers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.waiter_calls ENABLE ROW LEVEL SECURITY;

-- Allow anonymous access for the POS System (since no robust auth is fully implemented yet)
-- WARNING: These rules make your database publicly accessible. You should lock this down in a real production app.
CREATE POLICY "Allow public read access on products" ON public.products FOR SELECT USING (true);
CREATE POLICY "Allow public read access on tables" ON public.tables FOR SELECT USING (true);
CREATE POLICY "Allow public read access on vouchers" ON public.vouchers FOR SELECT USING (true);
CREATE POLICY "Allow public all on settings" ON public.settings FOR ALL USING (true);

-- Allow public insert/read/update on orders and related tables for customers/cashiers to use the app
CREATE POLICY "Allow public all on orders" ON public.orders FOR ALL USING (true);
CREATE POLICY "Allow public all on order_items" ON public.order_items FOR ALL USING (true);
CREATE POLICY "Allow public all on tables" ON public.tables FOR ALL USING (true);
CREATE POLICY "Allow public all on reviews" ON public.reviews FOR ALL USING (true);
CREATE POLICY "Allow public all on stock_logs" ON public.stock_logs FOR ALL USING (true);
CREATE POLICY "Allow public all on waiter_calls" ON public.waiter_calls FOR ALL USING (true);
