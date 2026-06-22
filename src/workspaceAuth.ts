import { initializeApp } from 'firebase/app';
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, User } from 'firebase/auth';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

const provider = new GoogleAuthProvider();
provider.addScope('https://www.googleapis.com/auth/drive.file');
provider.addScope('https://www.googleapis.com/auth/spreadsheets');

let isSigningIn = false;
let cachedAccessToken: string | null = null;

// Initialize Auth
export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      if (cachedAccessToken) {
        if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
      } else if (!isSigningIn) {
        // Try getting token or let user re-sign-in if token became null
        cachedAccessToken = null;
        if (onAuthFailure) onAuthFailure();
      }
    } else {
      cachedAccessToken = null;
      if (onAuthFailure) onAuthFailure();
    }
  });
};

// Sign in with Google Popup
export const googleSignIn = async (): Promise<{ user: User; accessToken: string } | null> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Gagal mendapatkan token akses dari Google.');
    }
    cachedAccessToken = credential.accessToken;
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: any) {
    console.error('Sign in error:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

// Logout
export const logoutAuth = async () => {
  await auth.signOut();
  cachedAccessToken = null;
};

// Get current token helper
export const getAccessToken = (): string | null => {
  return cachedAccessToken;
};

// --- Google Sheets & Drive API Helpers ---

// List files to find spreadsheets
export const findSpreadsheets = async (token: string) => {
  const query = encodeURIComponent("mimeType='application/vnd.google-apps.spreadsheet' and trashed=false");
  const res = await fetch(`https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name,webViewLink)`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error?.message || 'Gagal mencari Google Sheets di Drive Anda.');
  }
  const data = await res.json();
  return data.files || [];
};

// Create a new spreadsheet with customized worksheets
export const createSheetsDatabase = async (token: string, title: string) => {
  // Post request to make a spreadsheet with two tabs: 'Menus' and 'Orders'
  const body = {
    properties: {
      title: title
    },
    sheets: [
      {
        properties: {
          title: 'Menus',
          gridProperties: { rowCount: 100, columnCount: 10 }
        }
      },
      {
        properties: {
          title: 'Orders',
          gridProperties: { rowCount: 500, columnCount: 15 }
        }
      }
    ]
  };

  const res = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error?.message || 'Gagal membuat Google Spreadsheet baru.');
  }

  const data = await res.json();
  const spreadsheetId = data.spreadsheetId;

  // Now, initialize headers for both sheets: 'Menus' and 'Orders'
  await initializeSheetHeaders(token, spreadsheetId);

  return data;
};

const initializeSheetHeaders = async (token: string, spreadsheetId: string) => {
  const menuHeaders = [
    ['ID', 'Nama Produk', 'Kategori', 'Harga', 'Deskripsi', 'URL Gambar', 'Stok', 'Terlaris (Yes/No)', 'Sedang Promo (Yes/No)']
  ];
  
  const orderHeaders = [
    ['ID Pesanan', 'Meja', 'Tipe Layanan', 'Metode Bayar', 'Nama Pelanggan', 'Daftar Item', 'Total Makanan', 'Waitress Fee', 'Voucher Diskon', 'Pajak PPP (10%)', 'Total Akhir', 'Status Pesanan', 'Status Bayar', 'Tanggal / Jam', 'Catatan']
  ];

  // Write headers to Menus
  await writeSheetRange(token, spreadsheetId, 'Menus!A1:I1', menuHeaders);
  // Write headers to Orders
  await writeSheetRange(token, spreadsheetId, 'Orders!A1:O1', orderHeaders);
};

// Write raw values to a specific range
export const writeSheetRange = async (token: string, spreadsheetId: string, range: string, values: any[][]) => {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`;
  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ values })
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error?.message || `Gagal menulis data ke range ${range}`);
  }
};

// Add tab if not exist
export const ensureSheetTabExists = async (token: string, spreadsheetId: string, tabName: string) => {
  const getSheetUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties.title`;
  const resGet = await fetch(getSheetUrl, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!resGet.ok) return;
  const sheetMetadata = await resGet.json();
  const existingTabs = sheetMetadata.sheets?.map((s: any) => s.properties.title) || [];
  
  if (!existingTabs.includes(tabName)) {
    // Add it via batch update
    const batchUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`;
    await fetch(batchUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        requests: [{
          addSheet: {
            properties: {
              title: tabName
            }
          }
        }]
      })
    });
  }
};

// Read values from a range
export const readSheetRange = async (token: string, spreadsheetId: string, range: string): Promise<any[][] | null> => {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` }
  });

  if (res.status === 404 || res.status === 400) {
    // Worksheet or range might not exist, ensure or return empty
    return null;
  }

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error?.message || `Gagal mengambil data dari Google Sheets range ${range}`);
  }

  const data = await res.json();
  return data.values || null;
};

// Export menus (overwrite existing to match db products)
export const exportMenusToSheet = async (token: string, spreadsheetId: string, products: any[]) => {
  await ensureSheetTabExists(token, spreadsheetId, 'Menus');
  
  // Headers + items
  const values = [
    ['ID', 'Nama Produk', 'Kategori', 'Harga', 'Deskripsi', 'URL Gambar', 'Stok', 'Terlaris (Yes/No)', 'Sedang Promo (Yes/No)']
  ];

  products.forEach(p => {
    values.push([
      p.id || '',
      p.name || '',
      p.category || '',
      p.price || 0,
      p.description || '',
      p.image || '',
      p.stock || 0,
      p.isPopular ? 'YES' : 'NO',
      p.isPromo ? 'YES' : 'NO'
    ]);
  });

  // First clear or overwrite the old data
  // We can write to Menus!A1:I100 to ensure we overwrite old lines
  await writeSheetRange(token, spreadsheetId, 'Menus!A1:I200', values);
};

// Import menus from Sheet
export const importMenusFromSheet = async (token: string, spreadsheetId: string) => {
  const rows = await readSheetRange(token, spreadsheetId, 'Menus!A1:I200');
  if (!rows || rows.length <= 1) {
    throw new Error('Tidak ada data produk yang valid di lembar "Menus". Pastikan kolom Header baris pertama sesuai format.');
  }

  // Parse headers
  const headers = rows[0].map(h => String(h).trim().toLowerCase());
  const idIdx = headers.indexOf('id');
  const nameIdx = headers.findIndex(h => h.includes('nama'));
  const catIdx = headers.findIndex(h => h.includes('kategori'));
  const priceIdx = headers.findIndex(h => h.includes('harga'));
  const descIdx = headers.findIndex(h => h.includes('deskripsi'));
  const imgIdx = headers.findIndex(h => h.includes('gambar') || h.includes('foto'));
  const stockIdx = headers.findIndex(h => h.includes('stok'));
  const popIdx = headers.findIndex(h => h.includes('terlaris') || h.includes('popular'));
  const proIdx = headers.findIndex(h => h.includes('promo'));

  if (nameIdx === -1 || catIdx === -1 || priceIdx === -1) {
    throw new Error('Format kolom tidak cocok! Pastikan ada kolom "Nama Produk", "Kategori", dan "Harga" di Google Sheet.');
  }

  const newProducts: any[] = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0 || !row[nameIdx]) continue; // skip empty

    const parsedPrice = Number(String(row[priceIdx] || '0').replace(/[^0-9]/g, ''));
    if (!parsedPrice || isNaN(parsedPrice)) continue;

    const category = row[catIdx] || 'Coffee';
    const id = idIdx !== -1 && row[idIdx] ? String(row[idIdx]).trim() : `prod_${Math.random().toString(36).substr(2, 9)}`;
    const image = imgIdx !== -1 && row[imgIdx] ? String(row[imgIdx]).trim() : 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=500';

    newProducts.push({
      id,
      name: String(row[nameIdx]).trim(),
      category: category,
      price: parsedPrice,
      description: descIdx !== -1 ? String(row[descIdx] || '').trim() : '',
      image,
      stock: stockIdx !== -1 ? Number(row[stockIdx] || '100') : 100,
      isPopular: popIdx !== -1 ? String(row[popIdx]).toUpperCase() === 'YES' : false,
      isPromo: proIdx !== -1 ? String(row[proIdx]).toUpperCase() === 'YES' : false
    });
  }

  if (newProducts.length === 0) {
    throw new Error('Tidak berhasil memproses baris menu dari Google Sheets. Periksa nilai harga atau nama produk.');
  }

  return newProducts;
};

// Export / Append Orders
export const exportOrdersToSheet = async (token: string, spreadsheetId: string, orders: any[]) => {
  await ensureSheetTabExists(token, spreadsheetId, 'Orders');

  const values = [
    ['ID Pesanan', 'Meja', 'Tipe Layanan', 'Metode Bayar', 'Nama Pelanggan', 'Daftar Item', 'Total Makanan', 'Waitress Fee', 'Voucher Diskon', 'Pajak PPP (10%)', 'Total Akhir', 'Status Pesanan', 'Status Bayar', 'Tanggal / Jam', 'Catatan']
  ];

  orders.forEach(o => {
    // stringify item list cleanly
    const itemsStr = o.items?.map((item: any) => `${item.name} (${item.qty}x)`).join(', ') || '';
    
    values.push([
      o.id || '',
      o.tableNo || 'Take Away',
      o.serviceType || '',
      o.paymentMethod || '',
      o.customerName || '',
      itemsStr,
      o.subtotal || 0,
      o.waitressFee || 0,
      o.discount || 0,
      o.tax || 0,
      o.total || 0,
      o.status || '',
      o.paymentStatus || '',
      o.time ? new Date(o.time).toLocaleString('id-ID') : '',
      o.notes || ''
    ]);
  });

  // Overwrite starting from A1
  await writeSheetRange(token, spreadsheetId, 'Orders!A1:O500', values);
};
