import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import { Product, Order, Table, Voucher, Review, OrderStatus, PaymentStatus, OrderItem } from './src/types';

// Initial data definition
const INITIAL_PRODUCTS: Product[] = [
  { id: 'p1', name: 'Espresso Single Shot', category: 'Coffee', price: 18000, description: 'Single shot of extracted premium Arabica house-blend espresso.', image: 'https://images.unsplash.com/photo-1510707577719-ee7c14d5163a?q=80&w=600&auto=format&fit=crop', stock: 50, isPopular: true },
  { id: 'p2', name: 'Classic Iced Cafe Latte', category: 'Coffee', price: 24000, originalPrice: 28000, description: 'Es espresso ganda dengan susu segar dingin dan sirup gula murni.', image: 'https://images.unsplash.com/photo-1541167760496-1628856ab772?q=80&w=600&auto=format&fit=crop', stock: 60, isPromo: true },
  { id: 'p3', name: 'Caramel Macchiato Fluffy', category: 'Coffee', price: 32000, description: 'Espresso disiram dengan sirup vanila lembut, foam susu tebal, dan saus karamel.', image: 'https://images.unsplash.com/photo-1485808191679-5f86510681a2?q=80&w=600&auto=format&fit=crop', stock: 40, isPopular: true },
  { id: 'p4', name: 'Premium Matcha Latte', category: 'Non Coffee', price: 26000, description: 'Uji Matcha Jepang murni yang dikocok dengan susu segar hangat atau dingin.', image: 'https://images.unsplash.com/photo-1536256263959-770b48d82b0a?q=80&w=600&auto=format&fit=crop', stock: 35, isPopular: true },
  { id: 'p5', name: 'Midnight Charcoal Latte', category: 'Non Coffee', price: 28000, description: 'Susu segar gurih dipadukan dengan activated charcoal premium beraroma manis roasted.', image: 'https://images.unsplash.com/photo-1515694590185-73647ba02c10?q=80&w=600&auto=format&fit=crop', stock: 25 },
  { id: 'p6', name: 'Signature Iced Lychee Tea', category: 'Tea', price: 22000, description: 'Teh harum diseduh murni, disajikan dengan buah leci segar dan sirup leci.', image: 'https://images.unsplash.com/photo-1556679343-c7306c1976bc?q=80&w=600&auto=format&fit=crop', stock: 100, isPromo: true },
  { id: 'p7', name: 'Jasmine Peach Blossom', category: 'Tea', price: 24000, originalPrice: 26000, description: 'Teh melati wangi berpadu dengan potongan buah persika segar yang manis.', image: 'https://images.unsplash.com/photo-1576092768241-dec231879fc3?q=80&w=600&auto=format&fit=crop', stock: 45, isPromo: true },
  { id: 'p8', name: 'Truffle Fries with Garlic Aioli', category: 'Snack', price: 25000, description: 'Kentang goreng renyah bumbu truffle oil wangi disajikan dengan saus garlic aioli.', image: 'https://images.unsplash.com/photo-1573080496219-bb080dd4f877?q=80&w=600&auto=format&fit=crop', stock: 50, isPopular: true },
  { id: 'p9', name: 'Smoky Crispy Chicken Wings', category: 'Snack', price: 30000, description: 'Sayap ayam garing berlapis bumbu BBQ berasap dengan saus keju gurih.', image: 'https://images.unsplash.com/photo-1567620832903-9fc6debc209f?q=80&w=600&auto=format&fit=crop', stock: 30 },
  { id: 'p10', name: 'Rich Chocolate Lava Cake', category: 'Dessert', price: 28000, description: 'Kue cokelat panggang dengan lelehan lava cokelat pekat di bagian tengah.', image: 'https://images.unsplash.com/photo-1606313564200-e75d5e30476c?q=80&w=600&auto=format&fit=crop', stock: 20, isPopular: true },
  { id: 'p11', name: 'Classic New York Cheesecake', category: 'Dessert', price: 35000, description: 'Kue keju padat lembut khas NY dengan crust biskuit gurih dan sirup stroberi.', image: 'https://images.unsplash.com/photo-1524351199679-46cddf530c04?q=80&w=600&auto=format&fit=crop', stock: 15 },
  { id: 'p12', name: 'Nasi Goreng Wagyu Kecombrang', category: 'Main Course', price: 48000, description: 'Nasi goreng harum beraroma bunga kecombrang segar dengan irisan daging Wagyu empuk.', image: 'https://images.unsplash.com/photo-1626200419199-391ae4be7a41?q=80&w=600&auto=format&fit=crop', stock: 30, isPopular: true },
  { id: 'p13', name: 'Spaghetti Creamy Carbonara', category: 'Main Course', price: 42000, description: 'Pasta spaghetti al dente dalam balutan saus krim telur gurih, parmesan, dan beef bacon.', image: 'https://images.unsplash.com/photo-1612874742237-6526221588e3?q=80&w=600&auto=format&fit=crop', stock: 25 }
];

const INITIAL_TABLES: Table[] = Array.from({ length: 10 }, (_, i) => ({
  id: `t${i + 1}`,
  number: String(i + 1).padStart(2, '0'),
  qrCodeUrl: `/?table=${String(i + 1).padStart(2, '0')}`,
  status: 'Empty'
}));

const INITIAL_VOUCHERS: Voucher[] = [
  { code: 'COFFEELOVER', discountPercentage: 15, maxDiscount: 15000, minTransaction: 30000, description: 'Diskon 15% khusus pembelian Kopi / Minuman (Maks. Rp15.000, Min. Belanja Rp30.000).' },
  { code: 'CAFEASY20', discountPercentage: 20, maxDiscount: 25000, minTransaction: 50000, description: 'Diskon 20% untuk semua menu tanpa pengecualian (Maks. Rp25.000).' },
  { code: 'MAKANRENYAH', discountPercentage: 10, maxDiscount: 10000, minTransaction: 20000, description: 'Potongan hemat 10% untuk transaksi snack & makanan penutup.' }
];

const DB_FILE = path.join(process.cwd(), 'db_sim.json');

interface AppData {
  products: Product[];
  tables: Table[];
  vouchers: Voucher[];
  orders: Order[];
  reviews: Review[];
  logs: Array<{ id: string; timestamp: string; action: string; user: string }>;
}

let db: AppData = {
  products: INITIAL_PRODUCTS,
  tables: INITIAL_TABLES,
  vouchers: INITIAL_VOUCHERS,
  orders: [],
  reviews: [],
  logs: []
};

// Seed initial order logs
const SEED_OLD_ORDERS: Order[] = [
  {
    id: 'ord-99',
    shortId: 'A099',
    tableNumber: '02',
    deliveryType: 'Diantar ke Meja',
    items: [
      { productId: 'p3', name: 'Caramel Macchiato Fluffy', price: 32000, quantity: 2, notes: 'Less ice' },
      { productId: 'p10', name: 'Rich Chocolate Lava Cake', price: 28000, quantity: 1, notes: 'Extra hot' }
    ],
    subtotal: 92000,
    waitressFee: 1840,
    discount: 10000,
    grandTotal: 83840,
    paymentMethod: 'QRIS',
    paymentStatus: 'Paid',
    orderStatus: 'Completed',
    createdAt: new Date(Date.now() - 3600000 * 24).toISOString(), // Yesterday
    customerName: 'Ahmad Faisal',
    customerPhone: '08123456789',
    rating: 5,
    review: 'Rasa kopi karamelnya mantap banget, lava cakenya meleleh sempurna!'
  },
  {
    id: 'ord-100',
    shortId: 'A100',
    tableNumber: '05',
    deliveryType: 'Diantar ke Meja',
    items: [
      { productId: 'p12', name: 'Nasi Goreng Wagyu Kecombrang', price: 48000, quantity: 1, notes: 'Pedas sedang' },
      { productId: 'p4', name: 'Premium Matcha Latte', price: 26000, quantity: 1, notes: 'Less sugar, no ice' }
    ],
    subtotal: 74000,
    waitressFee: 1480,
    discount: 0,
    grandTotal: 75480,
    paymentMethod: 'OVO',
    paymentStatus: 'Paid',
    orderStatus: 'Completed',
    createdAt: new Date(Date.now() - 3600000 * 12).toISOString(), // 12 hours ago
    customerName: 'Siti Rahma',
    customerPhone: '089876543210',
    rating: 4,
    review: 'Wagyu kecombrangnya harum sekali, tapi agak sedikit berminyak. Overall ok!'
  },
  {
    id: 'ord-101',
    shortId: 'A101',
    tableNumber: 'Ambil Sendiri',
    deliveryType: 'Ambil Sendiri',
    items: [
      { productId: 'p1', name: 'Espresso Single Shot', price: 18000, quantity: 1, notes: '' },
      { productId: 'p8', name: 'Truffle Fries with Garlic Aioli', price: 25000, quantity: 1, notes: 'Extra dipping sauce' }
    ],
    subtotal: 43000,
    waitressFee: 0,
    discount: 4300,
    grandTotal: 38700,
    paymentMethod: 'Cash',
    paymentStatus: 'Paid',
    orderStatus: 'Completed',
    createdAt: new Date(Date.now() - 3600000 * 4).toISOString(), // 4 hours ago
    customerName: 'Yosef Wijaya',
    rating: 5,
    review: 'Kentang truffle-nya garing aromanya mahal!'
  }
];

// Load Database
function loadDB() {
  try {
    if (fs.existsSync(DB_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'));
      db = {
        products: parsed.products || INITIAL_PRODUCTS,
        tables: parsed.tables || INITIAL_TABLES,
        vouchers: parsed.vouchers || INITIAL_VOUCHERS,
        orders: parsed.orders || [],
        reviews: parsed.reviews || [],
        logs: parsed.logs || []
      };
      
      // Seed if empty
      if (db.orders.length === 0) {
        db.orders = SEED_OLD_ORDERS;
        db.reviews = SEED_OLD_ORDERS.map(o => ({
          id: `rev-${o.id}`,
          orderId: o.id,
          customerName: o.customerName,
          rating: o.rating || 5,
          comment: o.review || '',
          createdAt: o.createdAt,
          menuItemNames: o.items.map(i => i.name)
        }));
        saveDB();
      }
      console.log('Database loaded successfully from JSON.');
    } else {
      db.orders = SEED_OLD_ORDERS;
      db.reviews = SEED_OLD_ORDERS.map(o => ({
        id: `rev-${o.id}`,
        orderId: o.id,
        customerName: o.customerName,
        rating: o.rating || 5,
        comment: o.review || '',
        createdAt: o.createdAt,
        menuItemNames: o.items.map(i => i.name)
      }));
      db.logs = [
        { id: 'l1', timestamp: new Date().toISOString(), action: 'System Database Initialized', user: 'System' }
      ];
      saveDB();
      console.log('Built default mock database.');
    }
  } catch (error) {
    console.error('Error loading DB, utilizing fallback memory store:', error);
  }
}

// Save Database
function saveDB() {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf-8');
  } catch (error) {
    console.error('Error saving database to file:', error);
  }
}

loadDB();

// Global Notification Trigger Logger
let systemNotifications: any[] = [];
function addNotification(message: string, orderId?: string) {
  const notif = {
    id: 'n-' + Math.random().toString(36).substring(2, 9),
    message,
    orderId,
    timestamp: new Date().toISOString(),
    isRead: false
  };
  systemNotifications.unshift(notif);
  if (systemNotifications.length > 50) {
    systemNotifications.pop();
  }
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Log action helper
  const writeLog = (action: string, user: string = 'System') => {
    db.logs.unshift({
      id: 'log-' + Math.random().toString(36).substring(2, 9),
      timestamp: new Date().toISOString(),
      action,
      user
    });
    if (db.logs.length > 100) {
      db.logs.pop();
    }
    saveDB();
  };

  // --- API ROUTES ---

  // Get active configurations, products, tables, and statistics
  app.get('/api/config', (req, res) => {
    res.json({
      vouchers: db.vouchers,
      tables: db.tables
    });
  });

  // 1. MENU API
  app.get('/api/menus', (req, res) => {
    res.json(db.products);
  });

  app.post('/api/menus', (req, res) => {
    const { name, category, price, originalPrice, description, image, stock, isPopular, isPromo } = req.body;
    if (!name || !category || !price) {
      return res.status(400).json({ error: 'Nama, Kategori, dan Harga wajib diisi!' });
    }
    const newProduct: Product = {
      id: 'p-' + Math.random().toString(36).substring(2, 9),
      name,
      category,
      price: Number(price),
      originalPrice: originalPrice ? Number(originalPrice) : undefined,
      description: description || '',
      image: image || 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?q=80&w=600&auto=format&fit=crop',
      stock: Number(stock) || 10,
      isPopular: !!isPopular,
      isPromo: !!isPromo
    };

    db.products.push(newProduct);
    writeLog(`Menambahkan produk baru: ${name}`, 'Admin');
    res.status(201).json(newProduct);
  });

  app.put('/api/menus/:id', (req, res) => {
    const { id } = req.params;
    const index = db.products.findIndex(p => p.id === id);
    if (index === -1) {
      return res.status(404).json({ error: 'Menu tidak ditemukan!' });
    }

    const { name, category, price, originalPrice, description, image, stock, isPopular, isPromo } = req.body;
    db.products[index] = {
      ...db.products[index],
      name: name || db.products[index].name,
      category: category || db.products[index].category,
      price: price !== undefined ? Number(price) : db.products[index].price,
      originalPrice: originalPrice !== undefined ? (originalPrice ? Number(originalPrice) : undefined) : db.products[index].originalPrice,
      description: description !== undefined ? description : db.products[index].description,
      image: image !== undefined ? image : db.products[index].image,
      stock: stock !== undefined ? Number(stock) : db.products[index].stock,
      isPopular: isPopular !== undefined ? !!isPopular : db.products[index].isPopular,
      isPromo: isPromo !== undefined ? !!isPromo : db.products[index].isPromo
    };

    writeLog(`Mengubah detail produk: ${db.products[index].name}`, 'Admin');
    res.json(db.products[index]);
  });

  app.delete('/api/menus/:id', (req, res) => {
    const { id } = req.params;
    const index = db.products.findIndex(p => p.id === id);
    if (index === -1) {
      return res.status(404).json({ error: 'Menu tidak ditemukan' });
    }
    const name = db.products[index].name;
    db.products.splice(index, 1);
    writeLog(`Menghapus produk: ${name}`, 'Admin');
    res.json({ message: 'Menu berhasil dihapus' });
  });

  // Table management
  app.put('/api/tables/:id', (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    const item = db.tables.find(t => t.id === id);
    if (item) {
      item.status = status;
      writeLog(`Meja ${item.number} status diperbarui ke ${status}`);
      saveDB();
    }
    res.json({ success: true, tables: db.tables });
  });

  // Voucher API
  app.get('/api/vouchers', (req, res) => {
    res.json(db.vouchers);
  });

  app.post('/api/vouchers', (req, res) => {
    const { code, discountPercentage, maxDiscount, minTransaction, description } = req.body;
    if (!code || !discountPercentage) {
      return res.status(400).json({ error: 'Kode dan Persentase diskon wajib diisi!' });
    }
    const upperCode = code.toUpperCase().trim();
    if (db.vouchers.some(v => v.code === upperCode)) {
      return res.status(400).json({ error: 'Kode voucher sudah ada!' });
    }
    const newVoucher: Voucher = {
      code: upperCode,
      discountPercentage: Number(discountPercentage),
      maxDiscount: Number(maxDiscount) || 10000,
      minTransaction: Number(minTransaction) || 0,
      description: description || `Diskon ${discountPercentage}%`
    };
    db.vouchers.push(newVoucher);
    writeLog(`Menambahkan voucher baru: ${upperCode}`, 'Admin');
    saveDB();
    res.status(201).json(newVoucher);
  });

  app.put('/api/vouchers/:code', (req, res) => {
    const { code } = req.params;
    const index = db.vouchers.findIndex(v => v.code === code.toUpperCase().trim());
    if (index === -1) {
      return res.status(404).json({ error: 'Voucher tidak ditemukan!' });
    }
    const { discountPercentage, maxDiscount, minTransaction, description } = req.body;
    db.vouchers[index] = {
      ...db.vouchers[index],
      discountPercentage: discountPercentage !== undefined ? Number(discountPercentage) : db.vouchers[index].discountPercentage,
      maxDiscount: maxDiscount !== undefined ? Number(maxDiscount) : db.vouchers[index].maxDiscount,
      minTransaction: minTransaction !== undefined ? Number(minTransaction) : db.vouchers[index].minTransaction,
      description: description !== undefined ? description : db.vouchers[index].description
    };
    writeLog(`Mengubah voucher: ${code.toUpperCase().trim()}`, 'Admin');
    saveDB();
    res.json(db.vouchers[index]);
  });

  app.delete('/api/vouchers/:code', (req, res) => {
    const { code } = req.params;
    const index = db.vouchers.findIndex(v => v.code === code.toUpperCase().trim());
    if (index === -1) {
      return res.status(404).json({ error: 'Voucher tidak ditemukan!' });
    }
    db.vouchers.splice(index, 1);
    writeLog(`Menghapus voucher: ${code}`, 'Admin');
    saveDB();
    res.json({ message: 'Voucher berhasil dihapus' });
  });

  // 2. ORDER API
  app.get('/api/orders', (req, res) => {
    res.json(db.orders);
  });

  // Submit new order (Checkout Flow)
  app.post('/api/orders', (req, res) => {
    const { customerName, customerPhone, tableNumber, deliveryType, items, subtotal, waitressFee, discount, grandTotal, paymentMethod } = req.body;

    if (!items || items.length === 0) {
      return res.status(400).json({ error: 'Keranjang belanja tidak boleh kosong!' });
    }

    // Generate Short Order ID like "A103"
    const count = db.orders.length + 1;
    const shortId = `A${String(100 + count).padStart(3, '0')}`;

    // Reduce stock
    items.forEach((item: OrderItem) => {
      const prod = db.products.find(p => p.id === item.productId);
      if (prod) {
        prod.stock = Math.max(0, prod.stock - item.quantity);
      }
    });

    const isCash = paymentMethod === 'Cash';
    const newOrder: Order = {
      id: 'ord-' + Math.random().toString(36).substring(2, 9),
      shortId,
      tableNumber: deliveryType === 'Ambil Sendiri' ? 'Ambil Sendiri' : (tableNumber || '01'),
      deliveryType,
      items,
      subtotal: Number(subtotal),
      waitressFee: Number(waitressFee),
      discount: Number(discount),
      grandTotal: Number(grandTotal),
      paymentMethod,
      paymentStatus: isCash ? 'Unpaid' : 'Waiting Payment',
      orderStatus: 'Pending',
      createdAt: new Date().toISOString(),
      customerName: customerName || 'Pelanggan Tanpa Nama',
      customerPhone: customerPhone || ''
    };

    db.orders.unshift(newOrder);

    // Update table occupied state if applicable
    if (deliveryType === 'Diantar ke Meja' && tableNumber) {
      const tbl = db.tables.find(t => t.number === tableNumber);
      if (tbl) {
        tbl.status = 'Occupied';
      }
    }

    // System notifications and Audits
    addNotification(`Pesanan Baru #${shortId} oleh ${newOrder.customerName} (${deliveryType})`, newOrder.id);
    writeLog(`Pesanan baru #${shortId} dibuat oleh ${newOrder.customerName}`, 'Customer');

    res.status(201).json(newOrder);
  });

  // Change Order / Payment status
  app.put('/api/orders/:id', (req, res) => {
    const { id } = req.params;
    const { orderStatus, paymentStatus, rating, review } = req.body;

    const orderIndex = db.orders.findIndex(o => o.id === id);
    if (orderIndex === -1) {
      return res.status(404).json({ error: 'Pesanan tidak ditemukan!' });
    }

    const o = db.orders[orderIndex];
    const prevStatus = o.orderStatus;
    const prevPayStatus = o.paymentStatus;

    if (orderStatus) o.orderStatus = orderStatus as OrderStatus;
    if (paymentStatus) o.paymentStatus = paymentStatus as PaymentStatus;

    // Handle Completed Table updates
    if (orderStatus === 'Completed' || orderStatus === 'Cancelled') {
      if (o.deliveryType === 'Diantar ke Meja' && o.tableNumber) {
        const tbl = db.tables.find(t => t.number === o.tableNumber);
        if (tbl) {
          tbl.status = 'Empty';
        }
      }
    }

    // Trigger Notifications on Status Updates
    if (orderStatus && prevStatus !== orderStatus) {
      addNotification(`Pesanan #${o.shortId} status berubah menjadi: ${orderStatus}`, o.id);
      writeLog(`Pesanan #${o.shortId} diubah status dari ${prevStatus} ke ${orderStatus}`, 'Staff');
    }

    if (paymentStatus && prevPayStatus !== paymentStatus) {
      addNotification(`Pembayaran Pesanan #${o.shortId} status berubah menjadi: ${paymentStatus}`, o.id);
      writeLog(`Pembayaran #${o.shortId} diubah status ke ${paymentStatus}`, 'System');
    }

    // Handle review submission
    if (rating !== undefined) {
      o.rating = rating;
      o.review = review;

      const newReview: Review = {
        id: 'rev-' + Math.random().toString(36).substring(2, 9),
        orderId: o.id,
        customerName: o.customerName,
        rating: rating,
        comment: review || '',
        createdAt: new Date().toISOString(),
        menuItemNames: o.items.map(i => i.name)
      };
      db.reviews.unshift(newReview);
      writeLog(`Ulasan baru diterima untuk pesanan #${o.shortId}`, 'Customer');
    }

    saveDB();
    res.json(o);
  });

  // 3. REVIEWS API
  app.get('/api/reviews', (req, res) => {
    res.json(db.reviews);
  });

  // 4. NOTIFICATION CENTER
  app.get('/api/notifications', (req, res) => {
    res.json(systemNotifications);
  });

  app.post('/api/notifications/clear', (req, res) => {
    systemNotifications = [];
    res.json({ success: true });
  });

  // 5. REPORTS API
  app.get('/api/reports', (req, res) => {
    // Calculate total statistics
    const completedOrders = db.orders.filter(o => o.orderStatus !== 'Cancelled');
    const totalOmzet = completedOrders.reduce((sum, o) => sum + (o.paymentStatus === 'Paid' ? o.grandTotal : 0), 0);
    const totalWaitressFee = completedOrders.reduce((sum, o) => sum + (o.paymentStatus === 'Paid' ? o.waitressFee : 0), 0);
    const subtotalOmzet = completedOrders.reduce((sum, o) => sum + (o.paymentStatus === 'Paid' ? o.subtotal : 0), 0);

    // Dynamic Sales by date distribution (Last 7 days)
    const salesByDay: Record<string, number> = {};
    const feesByDay: Record<string, number> = {};
    const dates = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - i);
      return d.toISOString().split('T')[0];
    }).reverse();

    dates.forEach(d => {
      salesByDay[d] = 0;
      feesByDay[d] = 0;
    });

    completedOrders.forEach(o => {
      if (o.paymentStatus === 'Paid') {
        const dateStr = o.createdAt.split('T')[0];
        if (salesByDay[dateStr] !== undefined) {
          salesByDay[dateStr] += o.grandTotal;
          feesByDay[dateStr] += o.waitressFee;
        }
      }
    });

    const reportDaily = dates.map(d => ({
      date: d,
      omzet: salesByDay[d],
      fees: feesByDay[d]
    }));

    // Bestseller menu analysis
    const itemsMap: Record<string, { name: string; category: string; quantity: number; revenue: number }> = {};
    completedOrders.forEach(o => {
      if (o.paymentStatus === 'Paid') {
        o.items.forEach(item => {
          if (!itemsMap[item.productId]) {
            const p = db.products.find(prod => prod.id === item.productId);
            itemsMap[item.productId] = {
              name: item.name,
              category: p ? p.category : 'Lainnya',
              quantity: 0,
              revenue: 0
            };
          }
          itemsMap[item.productId].quantity += item.quantity;
          itemsMap[item.productId].revenue += item.price * item.quantity;
        });
      }
    });

    const bestSellers = Object.values(itemsMap).sort((a, b) => b.quantity - a.quantity);

    res.json({
      totalOmzet,
      totalWaitressFee,
      subtotalOmzet,
      dailySales: reportDaily,
      bestSellers,
      logs: db.logs.slice(0, 30),
      totalOrdersCount: db.orders.length,
      unpaidCount: db.orders.filter(o => o.paymentStatus === 'Unpaid').length,
      preparingCount: db.orders.filter(o => o.orderStatus === 'Preparing').length,
      readyCount: db.orders.filter(o => o.orderStatus === 'Ready').length
    });
  });

  // Clear system simulator logs/reset DB
  app.post('/api/reset', (req, res) => {
    db.products = INITIAL_PRODUCTS;
    db.tables = INITIAL_TABLES;
    db.vouchers = INITIAL_VOUCHERS;
    db.orders = SEED_OLD_ORDERS;
    db.reviews = SEED_OLD_ORDERS.map(o => ({
      id: `rev-${o.id}`,
      orderId: o.id,
      customerName: o.customerName,
      rating: o.rating || 5,
      comment: o.review || '',
      createdAt: o.createdAt,
      menuItemNames: o.items.map(i => i.name)
    }));
    db.logs = [{ id: 'l_init', timestamp: new Date().toISOString(), action: 'Sistem Direset ke Default Pabrik', user: 'Admin' }];
    systemNotifications = [];
    saveDB();
    res.json({ success: true });
  });

  // Serve static files in production setup
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[QR-CafeServer] Running beautifully at http://localhost:${PORT}`);
  });
}

startServer();
