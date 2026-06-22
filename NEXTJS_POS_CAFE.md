# POS Cafe - Next.js + Supabase + Google Sheets API

Karena environment ini menggunakan ekosistem Vite + React, saya menyertakan kode utuh untuk **Next.js (App Router) + Server Actions** di dokumen ini. Anda bisa langsung menyalin (*copy-paste*) instruksi dan struktur ini ke mesin lokal/repository Vercel Anda.

## Struktur Folder Top-Level

```text
my-pos-cafe/
├── app/
│   ├── api/
│   │   ├── order/
│   │   │   └── route.ts
│   │   └── report/
│   │       └── route.ts
│   ├── admin/
│   │   └── page.tsx      // Dashboard Admin
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx         // Kasir / Kasir POS Page
├── components/
│   └── (komponen UI)
├── lib/
│   ├── supabase.ts
│   ├── googleSheets.ts
│   └── actions.ts       // Server Actions
├── .env.local
├── package.json
└── next.config.js
```

## 1. Environment Variables (`.env.local`)
```env
NEXT_PUBLIC_SUPABASE_URL=https://[YOUR_INSTANCE].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=[YOUR_ANON_KEY]

# Kredensial Google Service Account (untuk Google Sheets API Server-to-Server)
GOOGLE_SERVICE_ACCOUNT_EMAIL=your-service-account@your-project.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIE...\n-----END PRIVATE KEY-----\n"
GOOGLE_SPREADSHEET_ID=[SPREADSHEET_ID_ANDA_JIKA_SUDAH_ADA]
```

## 2. Instalasi Dependensi
```bash
npx create-next-app@latest my-pos-cafe
cd my-pos-cafe
npm install @supabase/supabase-js googleapis
```

## 3. Integrasi Supabase (`lib/supabase.ts`)
```typescript
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseKey);
```

## 4. Server Actions Google Sheets API (`lib/googleSheets.ts`)
```typescript
import { google } from 'googleapis';

export async function getGoogleSheetsClient() {
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    },
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  const authClient = await auth.getClient();
  return google.sheets({ version: 'v4', auth: authClient });
}

export async function setupSpreadsheet(spreadsheetId: string) {
  const sheets = await getGoogleSheetsClient();
  
  // Asumsi spreadsheet sudah ada, kita tambahkan sheet jika belum ada
  const res = await sheets.spreadsheets.get({ spreadsheetId });
  const sheetTitles = res.data.sheets?.map(s => s.properties?.title) || [];

  const requests = [];
  if (!sheetTitles.includes('Pesanan')) {
    requests.push({ addSheet: { properties: { title: 'Pesanan' } } });
  }
  if (!sheetTitles.includes('Keuangan')) {
    requests.push({ addSheet: { properties: { title: 'Keuangan' } } });
  }

  if (requests.length > 0) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: { requests }
    });
    
    // Tambah Header ke Pesanan
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: 'Pesanan!A1:G1',
      valueInputOption: 'RAW',
      requestBody: { values: [['Tanggal', 'ID Pesanan', 'Nama Customer', 'Nomor Meja', 'Item', 'Total', 'Status']] }
    });

    // Tambah Header ke Keuangan
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: 'Keuangan!A1:D1',
      valueInputOption: 'RAW',
      requestBody: { values: [['Tanggal', 'Pendapatan', 'Jumlah Transaksi', 'Metode Pembayaran']] }
    });
  }
}

export async function appendOrderRow(order: any) {
  const sheets = await getGoogleSheetsClient();
  const spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID!;
  
  const itemsStr = order.items.map((i: any) => `${i.name} (${i.quantity}x)`).join(', ');
  
  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: 'Pesanan!A:G',
    valueInputOption: 'USER_ENTERED',
    requestBody: {
      values: [[
        new Date().toISOString(),
        order.id,
        order.customer_name,
        order.table_number,
        itemsStr,
        order.total_price,
        order.status
      ]]
    }
  });
}

export async function updateFinanceRow(order: any) {
  const sheets = await getGoogleSheetsClient();
  const spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID!;
  
  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: 'Keuangan!A:D',
    valueInputOption: 'USER_ENTERED',
    requestBody: {
      values: [[
        new Date().toISOString(),
        order.total_price,
        1,
        order.payment_method
      ]]
    }
  });
}
```

## 5. Server Actions untuk Supabase & Next.js (`lib/actions.ts`)
```typescript
'use server'

import { supabase } from './supabase';
import { appendOrderRow, updateFinanceRow } from './googleSheets';

export async function createOrder(orderData: any) {
  // 1. Simpan ke Supabase
  const { data, error } = await supabase
    .from('orders')
    .insert([orderData])
    .select()
    .single();

  if (error) throw new Error(error.message);

  // 2. Tulis baris baru ke Google Sheets (Pesanan)
  await appendOrderRow(data);

  return data;
}

export async function updateOrderStatus(orderId: string, status: string, orderData: any) {
  // 1. Update ke Supabase
  const { data, error } = await supabase
    .from('orders')
    .update({ status })
    .eq('id', orderId)
    .select()
    .single();

  if (error) throw new Error(error.message);

  // 2. Jika status menjadi Dibayar / Selesai, catat di sheet Keuangan
  if (status === 'Dibayar' || status === 'Selesai') {
    await updateFinanceRow(data || orderData);
  }

  // Catatan: Mencari baris secara update langsung di Sheet via API itu rumit, 
  // solusinya adalah menyimpan log transaksional pada Sheets.

  return data;
}
```

## 6. Page Dashboard Realtime (`app/admin/page.tsx`)
```tsx
'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { updateOrderStatus } from '@/lib/actions'

export default function AdminDashboard() {
  const [orders, setOrders] = useState<any[]>([])

  useEffect(() => {
    // 1. Init Load Fetch
    supabase.from('orders').select('*').order('created_at', { ascending: false }).then(({ data }) => setOrders(data || []))

    // 2. Realtime Listener
    const channel = supabase.channel('realtime_orders')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' }, payload => {
        setOrders(prev => [payload.new, ...prev])
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders' }, payload => {
        setOrders(prev => prev.map(o => o.id === payload.new.id ? payload.new : o))
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Dashboard POS</h1>
      <div className="grid grid-cols-3 gap-4 mb-8">
         <div className="p-4 border rounded shadow">Total Omzet (placeholder)</div>
         <div className="p-4 border rounded shadow">Order Draft (placeholder)</div>
      </div>
      <h2 className="font-bold">Pesanan Realtime</h2>
      {orders.map(o => (
        <div key={o.id} className="border p-4 flex justify-between my-2">
          <div>
            <p className="font-bold">{o.customer_name} - Meja {o.table_number}</p>
            <p>Rp{o.total_price?.toLocaleString()} | {o.status}</p>
          </div>
          <div>
             <button 
               onClick={() => updateOrderStatus(o.id, 'Diproses', o)} 
               className="bg-blue-500 text-white px-2 py-1 mr-2"
             >
               Proses
             </button>
             <button 
               onClick={() => updateOrderStatus(o.id, 'Dibayar', o)} 
               className="bg-green-500 text-white px-2 py-1"
             >
               Dibayar
             </button>
          </div>
        </div>
      ))}
    </div>
  )
}
```

## 7. Panduan Deploy ke Vercel
1. Dorong (*push*) kode ini ke repository GitHub.
2. Masuk ke dasbor **Vercel**, klik **Add New Project**, dan impor repositori.
3. Di bagian "Environment Variables", isi semua variabel yang ada di `.env.local` Anda.
   *(Terutama URL Supabase, Kunci Supabase, Kredensial Service Account)*
4. Klik **Deploy**.
5. Kunjungi dasbor Supabase Anda, masuk ke **Table Editor** > klik Tabel **`orders`** dan tabel **`products`**. Pastikan **Realtime** diaktifkan (via menu Replication/Realtime setings).
6. Aplikasi POS Anda sudah siap digunakan!
