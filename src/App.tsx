import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Coffee,
  Smartphone,
  Search,
  ShoppingCart,
  Plus,
  Minus,
  Trash2,
  CheckCircle,
  Clock,
  ChefHat,
  Star,
  Settings,
  RefreshCw,
  QrCode,
  FileText,
  MessageSquare,
  Lock,
  User,
  Hash,
  MoreVertical,
  Upload,
  Image as ImageIcon,
  Database,
  Share2
} from 'lucide-react';
import { Product, Order, OrderItem, MenuCategory, DeliveryType, PaymentMethod, OrderStatus, PaymentStatus, Table, Voucher, Review } from './types';
import { verifyConnection, dbRead, dbInsert, dbUpdate, dbDelete } from './supabaseClient';
import {
  initAuth,
  googleSignIn,
  logoutAuth,
  findSpreadsheets,
  createSheetsDatabase,
  readSheetRange,
  writeSheetRange,
  exportMenusToSheet,
  importMenusFromSheet,
  exportOrdersToSheet
} from './workspaceAuth';

export default function App() {
  // Navigation & Role states
  const [activeRole, setActiveRole] = useState<'Customer' | 'Admin' | 'Kasir' | 'Kitchen'>('Customer');
  const [currentTableNum, setCurrentTableNum] = useState<string>('07');

  // Animated Cart and PIN Portal state engines
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [pendingRole, setPendingRole] = useState<'Customer' | 'Admin' | 'Kasir' | 'Kitchen' | null>(null);
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState('');
  const [isMenuDropdownOpen, setIsMenuDropdownOpen] = useState(false);

  // Customer Catalog & Local state
  const [products, setProducts] = useState<Product[]>([]);
  const [stockLogs, setStockLogs] = useState<any[]>([]);
  const [waiterCalls, setWaiterCalls] = useState<any[]>([]);
  const [stockForm, setStockForm] = useState({ productId: '', type: 'IN', quantity: '', notes: '' });
  const [isCallingWaiter, setIsCallingWaiter] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<MenuCategory | 'All'>('All');
  const [favorites, setFavorites] = useState<string[]>([]);
  const [cart, setCart] = useState<OrderItem[]>([]);
  const [orderHistory, setOrderHistory] = useState<Order[]>([]);
  const [activeTrackingId, setActiveTrackingId] = useState<string | null>(null);

  // Voucher states
  const [voucherCode, setVoucherCode] = useState('');
  const [appliedVoucher, setAppliedVoucher] = useState<Voucher | null>(null);
  const [voucherError, setVoucherError] = useState('');

  // Delivery & Customer Profile states
  const [customerName, setCustomerName] = useState('Pelanggan');
  const [customerPhone, setCustomerPhone] = useState('');
  const [deliveryType, setDeliveryType] = useState<DeliveryType>('Diantar ke Meja');

  // Checkout modal & simulated Payment workflow
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<PaymentMethod>('QRIS');
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);

  // Admin tabs & edit fields
  const [adminActiveTab, setAdminActiveTab] = useState<'menus' | 'vouchers' | 'reports' | 'sheets' | 'settings' | 'stock'>('menus');
  const [globalPin, setGlobalPin] = useState('0000');
  const [pinForm, setPinForm] = useState({ current: '', new: '', confirm: '' });
  const [googleUser, setGoogleUser] = useState<any>(null);
  const [googleAccessToken, setGoogleAccessToken] = useState<string | null>(null);
  const [googleSpreadsheetId, setGoogleSpreadsheetId] = useState<string>(() => localStorage.getItem('google_spreadsheet_id') || '');
  const [availableSpreadsheets, setAvailableSpreadsheets] = useState<any[]>([]);
  const [isSyncingSheets, setIsSyncingSheets] = useState<boolean>(false);
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [editingVoucher, setEditingVoucher] = useState<Voucher | null>(null);
  const [newVoucherForm, setNewVoucherForm] = useState({
    code: '',
    discountPercentage: '',
    minTransaction: '',
    description: ''
  });

  const [newMenuForm, setNewMenuForm] = useState({
    name: '',
    category: 'Coffee' as MenuCategory,
    price: '',
    description: '',
    image: '',
    stock: '30',
    isPopular: false,
    isPromo: false
  });
  
  const [notifications, setNotifications] = useState<any[]>([]);
  const [reportData, setReportData] = useState<any>(null);

  // Review state
  const [ratingVal, setRatingVal] = useState(5);
  const [reviewTxt, setReviewTxt] = useState('');

  // Parse table parameter from query string
  useEffect(() => {
    verifyConnection();
    
    const params = new URLSearchParams(window.location.search);
    const tableParam = params.get('table');
    if (tableParam) {
      setCurrentTableNum(tableParam);
      setDeliveryType('Diantar ke Meja');
    }

    const loadSettings = async () => {
      try {
        const { supabase } = await import('./supabaseClient');
        const { data, error } = await supabase.from('settings').select('value').eq('key', 'admin_pin').single();
        if (data && data.value) {
          setGlobalPin(data.value);
        } else {
          // Initialize if not exists
          await supabase.from('settings').insert({ key: 'admin_pin', value: '0000' });
          setGlobalPin('0000');
        }
      } catch (e) {
        console.error('Settings table missing or error', e);
      }
    };
    loadSettings();
  }, []);

  const fetchMenus = async () => {
    try {
      const data = await dbRead('products');
      setProducts(data || []);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchOrdersAndReports = async () => {
    try {
      const { supabase } = await import('./supabaseClient');
      const { data: rawOrders, error: ordersError } = await supabase.from('orders').select('*, order_items(*)').order('createdAt', { ascending: false });
      if (ordersError) throw ordersError;

      const formattedOrders = (rawOrders || []).map((o: any) => ({
        ...o,
        items: o.order_items || []
      }));
      setOrderHistory(formattedOrders);

      // Calculate Reports
      const completedOrders = formattedOrders.filter(o => o.orderStatus !== 'Cancelled');
      const totalOmzet = completedOrders.reduce((sum, o) => sum + (o.paymentStatus === 'Paid' ? Number(o.grandTotal) : 0), 0);
      const totalWaitressFee = completedOrders.reduce((sum, o) => sum + (o.paymentStatus === 'Paid' ? Number(o.waitressFee) : 0), 0);
      const subtotalOmzet = completedOrders.reduce((sum, o) => sum + (o.paymentStatus === 'Paid' ? Number(o.subtotal) : 0), 0);

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
        if (o.paymentStatus === 'Paid' && o.createdAt) {
          const dateStr = o.createdAt.split('T')[0];
          if (salesByDay[dateStr] !== undefined) {
            salesByDay[dateStr] += Number(o.grandTotal);
            feesByDay[dateStr] += Number(o.waitressFee);
          }
        }
      });

      const reportDaily = dates.map(d => ({
        date: d,
        omzet: salesByDay[d],
        fees: feesByDay[d]
      }));

      const itemsMap: Record<string, { name: string; category: string; quantity: number; revenue: number }> = {};
      
      completedOrders.forEach(o => {
        if (o.paymentStatus === 'Paid') {
          o.items.forEach((item: any) => {
            if (!itemsMap[item.productId]) {
              itemsMap[item.productId] = {
                name: item.name,
                category: 'Produk', // Simplified since we don't join products here
                quantity: 0,
                revenue: 0
              };
            }
            itemsMap[item.productId].quantity += Number(item.quantity);
            itemsMap[item.productId].revenue += Number(item.price) * Number(item.quantity);
          });
        }
      });

      const bestSellers = Object.values(itemsMap).sort((a: any, b: any) => b.quantity - a.quantity);

      setReportData({
        totalOmzet,
        totalWaitressFee,
        subtotalOmzet,
        dailySales: reportDaily,
        bestSellers,
        logs: [],
        totalOrdersCount: formattedOrders.length,
        unpaidCount: formattedOrders.filter(o => o.paymentStatus === 'Unpaid').length,
        preparingCount: formattedOrders.filter(o => o.orderStatus === 'Preparing').length,
        readyCount: formattedOrders.filter(o => o.orderStatus === 'Ready').length
      });

      setNotifications([]);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchVouchers = async () => {
    try {
      const data = await dbRead('vouchers');
      setVouchers(data || []);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchStockLogs = async () => {
    try {
      const { supabase } = await import('./supabaseClient');
      const { data, error } = await supabase.from('stock_logs').select('*, products(name)').order('createdAt', { ascending: false }).limit(50);
      if (!error) setStockLogs(data || []);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchWaiterCalls = async () => {
    try {
      const { supabase } = await import('./supabaseClient');
      const { data, error } = await supabase.from('waiter_calls').select('*').order('createdAt', { ascending: false });
      if (!error) setWaiterCalls(data || []);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchMenus();
    fetchOrdersAndReports();
    fetchVouchers();
    fetchStockLogs();
    fetchWaiterCalls();

    let channel: any;
    const setupRealtime = async () => {
      const { supabase } = await import('./supabaseClient');
      channel = supabase.channel('schema-db-changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, (payload) => {
          fetchOrdersAndReports();
          if (payload.eventType === 'UPDATE' && payload.new.orderStatus === 'Ready' && payload.old.orderStatus !== 'Ready') {
             // Let a global document state handle it or just rely on the UI polling
             const currentTrackingStr = localStorage.getItem('activeTrackingId');
             if (currentTrackingStr === payload.new.id) {
                const beep = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
                beep.play().catch(e => console.error(e));
                alert(`☕ Your order is ready for pickup.\nOrder #: ${payload.new.shortId}\nPlease collect your order at the pickup counter.`);
             }
          }
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'waiter_calls' }, (payload) => {
          fetchWaiterCalls();
          if (payload.eventType === 'INSERT' && payload.new.status === 'Waiting' && ['Kasir', 'Admin'].includes(activeRole)) {
            const beep = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
            beep.play().catch(e => console.error(e));
            alert(`Pangggilan Pelayan dari Meja ${payload.new.tableNumber}`);
          }
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, () => {
          fetchMenus();
        })
        .subscribe();
    }
    setupRealtime();

    // Setup polling every 4 seconds as fallback
    const timer = setInterval(() => {
      fetchOrdersAndReports();
      fetchWaiterCalls();
    }, 4000);

    return () => {
      clearInterval(timer);
      if (channel) channel.unsubscribe();
    }
  }, []);

  useEffect(() => {
    const cached = localStorage.getItem('cafe_favorites');
    if (cached) {
      setFavorites(JSON.parse(cached));
    }
  }, []);

  // Listen and restore Google Auth state for Workspace integration
  useEffect(() => {
    const unsubscribe = initAuth(
      (user, token) => {
        setGoogleUser(user);
        setGoogleAccessToken(token);
        findSpreadsheets(token).then(setAvailableSpreadsheets).catch(console.error);
      },
      () => {
        setGoogleUser(null);
        setGoogleAccessToken(null);
      }
    );
    return () => unsubscribe();
  }, []);

  const toggleFavorite = (id: string) => {
    let next = favorites.includes(id) 
      ? favorites.filter(f => f !== id) 
      : [...favorites, id];
    setFavorites(next);
    localStorage.setItem('cafe_favorites', JSON.stringify(next));
  };

  const addToCart = (product: Product) => {
    const existing = cart.find(item => item.productId === product.id);
    if (existing) {
      setCart(cart.map(item => 
        item.productId === product.id ? { ...item, quantity: item.quantity + 1 } : item
      ));
    } else {
      setCart([...cart, {
        productId: product.id,
        name: product.name,
        price: product.price,
        quantity: 1,
        notes: ''
      }]);
    }
    setIsCartOpen(true); // Automatically slide open the animated cart drawer
  };

  // Staff Portal Role Switches and Default PIN check (0000)
  const handleSwitchRoleAttempt = (targetRole: 'Customer' | 'Admin' | 'Kasir' | 'Kitchen') => {
    if (targetRole === 'Customer') {
      setActiveRole('Customer');
      return;
    }
    setPendingRole(targetRole);
    setPinInput('');
    setPinError('');
    setIsPinModalOpen(true);
  };

  const handleKeyPress = (num: string) => {
    setPinError('');
    if (pinInput.length < 4) {
      const nextPin = pinInput + num;
      setPinInput(nextPin);
      
      // Automatic verify if length reaches 4
      if (nextPin === globalPin) {
        if (pendingRole) {
          setActiveRole(pendingRole);
          if (pendingRole !== 'Admin') {
            fetchOrdersAndReports();
          }
        }
        setIsPinModalOpen(false);
        setPinInput('');
      } else if (nextPin.length === 4) {
        setPinError('PIN salah! Silakan coba lagi.');
        setTimeout(() => {
          setPinInput('');
        }, 1200);
      }
    }
  };

  const handleDeletePress = () => {
    setPinError('');
    setPinInput(prev => prev.slice(0, -1));
  };

  const updateQuantity = (productId: string, val: number) => {
    setCart(cart.map(item => {
      if (item.productId === productId) {
        return { ...item, quantity: Math.max(1, item.quantity + val) };
      }
      return item;
    }));
  };

  const updateItemNotes = (productId: string, notes: string) => {
    setCart(cart.map(item => 
      item.productId === productId ? { ...item, notes } : item
    ));
  };

  const removeFromCart = (productId: string) => {
    setCart(cart.filter(item => item.productId !== productId));
  };

  const applyVoucher = () => {
    setVoucherError('');
    if (!voucherCode) return;
    
    const codeUpper = voucherCode.toUpperCase().trim();
    const v = vouchers.find(x => x.code === codeUpper);

    if (v) {
      const sub = getSubtotal();
      if (v.minTransaction && sub < v.minTransaction) {
        setVoucherError(`Minimum Rp${v.minTransaction.toLocaleString('id-ID')} untuk kupon ini.`);
        setAppliedVoucher(null);
      } else {
        setAppliedVoucher(v);
      }
    } else {
      setVoucherError('Kode voucher tidak ditemukan.');
      setAppliedVoucher(null);
    }
  };

  const applyVoucherByCode = (code: string) => {
    setVoucherCode(code);
    setVoucherError('');
    
    const v = vouchers.find(x => x.code === code);
    if (v) {
      const sub = getSubtotal();
      if (v.minTransaction && sub < v.minTransaction) {
        setVoucherError(`Minimum Rp${v.minTransaction.toLocaleString('id-ID')} untuk kupon ini.`);
        setAppliedVoucher(null);
      } else {
        setAppliedVoucher(v);
        setVoucherError('');
      }
    }
  };

  const getSubtotal = () => cart.reduce((acc, item) => acc + (item.price * item.quantity), 0);
  
  const getWaitressFee = () => deliveryType === 'Diantar ke Meja' ? getSubtotal() * 0.02 : 0;

  const getDiscount = () => {
    if (!appliedVoucher) return 0;
    const sub = getSubtotal();
    return (sub * appliedVoucher.discountPercentage) / 100;
  };

  const getGrandTotal = () => getSubtotal() + getWaitressFee() - getDiscount();

  const handleProceedCheckout = () => {
    if (cart.length === 0) return;
    setIsCheckoutOpen(true);
  };

  const executeOrderCheckout = async () => {
    setIsProcessingPayment(true);
    const sub = getSubtotal();
    const fee = getWaitressFee();
    const disc = getDiscount();
    const tot = getGrandTotal();

    const orderPayload = {
      customerName: customerName || 'Pelanggan Meja ' + currentTableNum,
      customerPhone,
      tableNumber: deliveryType === 'Ambil Sendiri' ? 'Ambil Sendiri' : currentTableNum,
      deliveryType,
      items: cart,
      subtotal: sub,
      waitressFee: fee,
      discount: disc,
      grandTotal: tot,
      paymentMethod: selectedPayment
    };

    try {
      const { items, ...orderData } = orderPayload;
      // Add shortId
      orderData.shortId = `A${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`;
      orderData.paymentStatus = (selectedPayment === 'Cash' || !selectedPayment) ? 'Unpaid' : 'Waiting Payment';
      orderData.orderStatus = 'Pending';
      
      const { supabase } = await import('./supabaseClient');
      const { data: insertedOrder, error: orderError } = await supabase.from('orders').insert(orderData).select();
      
      if (orderError) throw orderError;
      
      if (insertedOrder && insertedOrder.length > 0) {
        const newOrderId = insertedOrder[0].id;
        
        // Insert items
        if (items && items.length > 0) {
          const orderItems = items.map((it: any) => ({
            orderId: newOrderId,
            productId: it.productId,
            name: it.name,
            price: it.price,
            quantity: it.quantity,
            notes: it.notes
          }));
          const { error: itemsError } = await supabase.from('order_items').insert(orderItems);
          if (itemsError) throw itemsError;
        }

        setActiveTrackingId(newOrderId);
        localStorage.setItem('activeTrackingId', newOrderId);
        setCart([]);
        setAppliedVoucher(null);
        setVoucherCode('');

        setTimeout(() => {
          setIsProcessingPayment(false);
          setIsCheckoutOpen(false);
          fetchOrdersAndReports();
        }, 1200);
      } else {
        alert('Gagal membuat pesanan');
        setIsProcessingPayment(false);
      }
    } catch (e) {
      console.error(e);
      alert('Koneksi backend atau format pesanan gagal');
      setIsProcessingPayment(false);
    }
  };

  const updateOrderStatus = async (orderId: string, statusObj: { orderStatus?: OrderStatus, paymentStatus?: PaymentStatus, rating?: number, review?: string }) => {
    try {
      const { supabase } = await import('./supabaseClient');

      // Check if marking as Paid for the first time
      if (statusObj.paymentStatus === 'Paid') {
        const order = orderHistory.find(o => o.id === orderId);
        if (order && order.paymentStatus !== 'Paid') {
          // Reduce stock & log
          for (const item of order.items) {
             const { data: p } = await supabase.from('products').select('stock').eq('id', item.productId).single();
             if (p) {
               await supabase.from('products').update({ stock: Math.max(0, p.stock - item.quantity) }).eq('id', item.productId);
               await supabase.from('stock_logs').insert({ productId: item.productId, type: 'OUT', quantity: item.quantity, notes: `Order Paid #${order.shortId}` });
             }
          }
        }
      }

      await dbUpdate('orders', statusObj, { id: orderId });
      fetchOrdersAndReports();
      fetchStockLogs();
      fetchMenus();

      if (statusObj.rating !== undefined) {
        alert('Ulasan rasa diunggah! Terima kasih.');
        setRatingVal(5);
        setReviewTxt('');
      }
      
      // Notification sound for customer if Ready
      if (statusObj.orderStatus === 'Ready') {
         // This runs for all clients watching, but sound will only be helpful if we are that customer or global
         // For now, simple beep
         const beep = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
         beep.play().catch(e => console.error(e));
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleCallWaiter = async () => {
    if (isCallingWaiter) return;
    
    // Check spam
    const lastCallTime = localStorage.getItem('last_waiter_call');
    if (lastCallTime && new Date().getTime() - Number(lastCallTime) < 120000) {
      alert('Mohon waktu 2 menit sejak panggilan terakhir. Staf kami sedang meluncur ke meja Anda.');
      return;
    }

    if (confirm('Panggil pelayan ke meja Anda sekarang?')) {
      setIsCallingWaiter(true);
      try {
        const { supabase } = await import('./supabaseClient');
        const { error } = await supabase.from('waiter_calls').insert({ tableNumber: currentTableNum, status: 'Waiting' });
        if (!error) {
          localStorage.setItem('last_waiter_call', new Date().getTime().toString());
          alert('Berhasil! Pelayan sedang dalam perjalanan ke meja Anda.');
        } else {
          alert('Gagal memanggil pelayan.');
        }
      } catch (e) {
        console.error(e);
      } finally {
        setIsCallingWaiter(false);
      }
    }
  };

  const handleStockAdjust = async (e: React.FormEvent) => {
    e.preventDefault();
    const qty = Number(stockForm.quantity);
    if (!stockForm.productId || qty <= 0) return;
    const p = products.find(prod => prod.id === stockForm.productId);
    if (!p) return;
    try {
      const { supabase } = await import('./supabaseClient');
      let newStock = p.stock;
      if (stockForm.type === 'IN') newStock += qty;
      else if (stockForm.type === 'OUT') newStock = Math.max(0, newStock - qty);
      
      await supabase.from('products').update({ stock: newStock }).eq('id', p.id);
      await supabase.from('stock_logs').insert({ productId: p.id, type: stockForm.type, quantity: qty, notes: stockForm.notes });
      
      fetchMenus();
      fetchStockLogs();
      setStockForm({ productId: '', type: 'IN', quantity: '', notes: '' });
      alert('Stok berhasil diperbarui ✅');
    } catch (err) {
      console.error(err);
      alert('Gagal memperbarui stok.');
    }
  };

  const handleResetDatabase = async () => {
    if (confirm('Riset data database Supabase tidak diizinkan dari Frontend.')) {
      alert('Tindakan ini tidak bisa dilakukan langsung dari browser.');
    }
  };

  const handleGoogleLogin = async () => {
    setIsSyncingSheets(true);
    try {
      const res = await googleSignIn();
      if (res) {
        setGoogleUser(res.user);
        setGoogleAccessToken(res.accessToken);
        const files = await findSpreadsheets(res.accessToken);
        setAvailableSpreadsheets(files);
        alert(`Berhasil terhubung dengan Google Drive akun: ${res.user.email}`);
      }
    } catch (e: any) {
      alert(`Gagal login Google: ${e.message}`);
    } finally {
      setIsSyncingSheets(false);
    }
  };

  const handleGoogleLogout = async () => {
    try {
      await logoutAuth();
      setGoogleUser(null);
      setGoogleAccessToken(null);
      setAvailableSpreadsheets([]);
      alert('Berhasil memutuskan koneksi Google.');
    } catch (e: any) {
      alert(`Gagal logout: ${e.message}`);
    }
  };

  const handleCreateSpreadsheet = async () => {
    if (!googleAccessToken) return alert('Silakan hubungkan akun Google terlebih dahulu.');
    setIsSyncingSheets(true);
    try {
      const title = `DB Café Order - ${new Date().toLocaleDateString('id-ID')} ${new Date().toLocaleTimeString('id-ID')}`;
      const sheet = await createSheetsDatabase(googleAccessToken, title);
      const newId = sheet.spreadsheetId;
      setGoogleSpreadsheetId(newId);
      localStorage.setItem('google_spreadsheet_id', newId);
      
      const files = await findSpreadsheets(googleAccessToken);
      setAvailableSpreadsheets(files);
      alert(`BERHASIL! Membuat spreadsheet baru "${title}" di Drive Anda.\nSpreadsheet ID: ${newId}`);
    } catch (e: any) {
      alert(`Gagal membuat spreadsheet: ${e.message}`);
    } finally {
      setIsSyncingSheets(false);
    }
  };

  const handleSelectSpreadsheet = (id: string) => {
    setGoogleSpreadsheetId(id);
    localStorage.setItem('google_spreadsheet_id', id);
    alert(`Spreadsheet target berhasil diatur ke: ${id}`);
  };

  const handleExportMenus = async () => {
    if (!googleAccessToken || !googleSpreadsheetId) {
      return alert('Pastikan Anda sudah login Google dan memilih Spreadsheet target!');
    }
    const confirmed = confirm("Ekspor semua Katalog Menu aktif ke Google Sheets Anda? Tindakan ini akan menimpa tab 'Menus' di lembar kerja.");
    if (!confirmed) return;

    setIsSyncingSheets(true);
    try {
      await exportMenusToSheet(googleAccessToken, googleSpreadsheetId, products);
      alert(`Sinkronisasi Berhasil! Katalog menu cafe (${products.length} item) telah diunggah ke Google Sheet tab 'Menus'.`);
    } catch (e: any) {
      alert(`Gagal ekspor menu: ${e.message}`);
    } finally {
      setIsSyncingSheets(false);
    }
  };

  const handleImportMenus = async () => {
    if (!googleAccessToken || !googleSpreadsheetId) {
      return alert('Pastikan Anda sudah login Google dan memilih Spreadsheet target!');
    }
    const confirmed = confirm("Impor Katalog Menu dari tab 'Menus' di Google Sheets Anda? Tindakan ini akan menimpa data menu café lokal saat ini.");
    if (!confirmed) return;

    setIsSyncingSheets(true);
    try {
      const importedProducts = await importMenusFromSheet(googleAccessToken, googleSpreadsheetId);
      
      // Delete existing and insert new
      await dbDelete('products', {}); // Assuming we can do broad deletes this way, or we'd just use supabase directly.
      const { supabase } = await import('./supabaseClient');
      await supabase.from('products').delete().neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all rows
      
      if (importedProducts.length > 0) {
        await supabase.from('products').insert(importedProducts);
      }
      const data = await dbRead('products');
      setProducts(data || []);
      alert(`Sinkronisasi Berhasil! Berhasil mengimpor ${importedProducts.length} produk dari Google Sheets.`);
    } catch (e: any) {
      alert(`Gagal impor menu: ${e.message}`);
    } finally {
      setIsSyncingSheets(false);
    }
  };

  const handleExportOrders = async () => {
    if (!googleAccessToken || !googleSpreadsheetId) {
      return alert('Pastikan Anda sudah login Google dan memilih Spreadsheet target!');
    }
    const confirmed = confirm("Ekspor semua Riwayat Pesanan ke Google Sheets? Tindakan ini akan memperbarui tab 'Orders' di lembar kerja.");
    if (!confirmed) return;

    setIsSyncingSheets(true);
    try {
      await exportOrdersToSheet(googleAccessToken, googleSpreadsheetId, orderHistory);
      alert(`Sinkronisasi Berhasil! Riwayat pesanan cafe (${orderHistory.length} pesanan) berhasil diunggah ke Google Sheet tab 'Orders'.`);
    } catch (e: any) {
      alert(`Gagal ekspor riwayat pesanan: ${e.message}`);
    } finally {
      setIsSyncingSheets(false);
    }
  };

  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        ...newMenuForm,
        price: Number(newMenuForm.price),
        stock: Number(newMenuForm.stock)
      };
      const inserted = await dbInsert('products', payload);
      
      if (inserted) {
        setNewMenuForm({
          name: '',
          category: 'Coffee',
          price: '',
          description: '',
          image: '',
          stock: '30',
          isPopular: false,
          isPromo: false
        });
        fetchMenus();
        fetchOrdersAndReports();
        alert('Menu kuliner berhasil disimpan!');
      } else {
        alert('Gagal menambahkan menu. Silakan periksa kembali data Anda.');
      }
    } catch (e) {
      console.error(e);
      alert('Terjadi kesalahan jaringan saat menyimpan menu.');
    }
  };

  const handleUpdateStock = async (id: string, nextStock: number) => {
    try {
      await dbUpdate('products', { stock: nextStock }, { id });
      fetchMenus();
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteProduct = async (id: string) => {
    if (confirm('Hapus item menu ini?')) {
      await dbDelete('products', { id });
      fetchMenus();
    }
  };

  const handleUpdateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduct) return;
    try {
      const payload = {
        name: editingProduct.name,
        category: editingProduct.category,
        price: Number(editingProduct.price),
        description: editingProduct.description,
        image: editingProduct.image,
        stock: Number(editingProduct.stock),
        isPopular: !!editingProduct.isPopular,
        isPromo: !!editingProduct.isPromo
      };
      
      await dbUpdate('products', payload, { id: editingProduct.id });
      setEditingProduct(null);
      fetchMenus();
      alert('Menu kuliner berhasil diperbarui!');
    } catch (e) {
      console.error(e);
      alert('Gagal memperbarui menu');
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) { // 2MB limit
        alert('Ukuran foto terlalu besar! Maksimal 2MB.');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        if (editingProduct) {
          setEditingProduct({ ...editingProduct, image: base64String });
        } else {
          setNewMenuForm({ ...newMenuForm, image: base64String });
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAddVoucher = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        code: newVoucherForm.code,
        discountPercentage: Number(newVoucherForm.discountPercentage),
        minTransaction: newVoucherForm.minTransaction ? Number(newVoucherForm.minTransaction) : null,
        description: newVoucherForm.description
      };
      
      const inserted = await dbInsert('vouchers', payload);
      if (inserted) {
        setNewVoucherForm({
          code: '',
          discountPercentage: '',
          minTransaction: '',
          description: ''
        });
        fetchVouchers();
        alert('Voucher baru berhasil disimpan!');
      } else {
        alert('Gagal menambahkan voucher');
      }
    } catch (e) {
      console.error(e);
      alert('Gagal menambahkan voucher');
    }
  };

  const handleUpdateVoucher = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingVoucher) return;
    try {
      const payload = {
        discountPercentage: Number(editingVoucher.discountPercentage),
        minTransaction: editingVoucher.minTransaction ? Number(editingVoucher.minTransaction) : null,
        description: editingVoucher.description
      };
      await dbUpdate('vouchers', payload, { code: editingVoucher.code });
      setEditingVoucher(null);
      fetchVouchers();
      alert('Voucher berhasil diperbarui!');
    } catch (e) {
      console.error(e);
      alert('Gagal memperbarui voucher');
    }
  };

  const handleDeleteVoucher = async (code: string) => {
    if (confirm(`Hapus voucher ${code}?`)) {
      try {
        await dbDelete('vouchers', { code });
        fetchVouchers();
        alert('Voucher berhasil dihapus!');
      } catch (e) {
        console.error(e);
        alert('Gagal menghapus voucher');
      }
    }
  };

  const filteredProducts = products.filter(p => {
    const matchesCategory = selectedCategory === 'All' || p.category === selectedCategory;
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          p.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const trackingOrder = orderHistory.find(o => o.id === activeTrackingId);

  const getPaymentDetails = (method: PaymentMethod) => {
    switch (method) {
      case 'QRIS':
        return { name: 'QRIS STANDAR NASIONAL (M-banking/E-Wallet)', desc: 'Scan QR Code statis pada panel modal untuk simulasi transfer instan.' };
      case 'GoPay':
        return { name: 'GOPAY INSTANT GATEWAY', desc: 'Selesaikan transaksi dengan push notification dari aplikasi Gojek.' };
      case 'DANA':
        return { name: 'DANA INDONESIA WALLET', desc: 'Transfer instan dengan simulasi kode token OTP saldo DANA Anda.' };
      case 'OVO':
        return { name: 'OVO POINTS CASH', desc: 'Konfirmasi notifikasi pembayaran yang dikirim langsung ke smartphone Anda.' };
      default:
        return { name: 'CASH DI KASIR BAR', desc: 'Silakan membawa struk belanja ini ke petugas kasir untuk pembayaran manual.' };
    }
  };

  return (
    <div className="bg-[#0F0F0F] text-stone-200 min-h-screen flex flex-col font-sans" id="cafe-app-layout">
      
      {/* BRAND HEADER BAR */}
      <header className="h-16 px-4 md:px-8 border-b border-white/10 flex items-center justify-between bg-[#161616] sticky top-0 z-40 shadow-md">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-[#C8A97E] rounded-lg flex items-center justify-center text-[#0F0F0F] font-black text-lg cursor-pointer" onClick={() => handleSwitchRoleAttempt('Customer')}>
            B
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-[9px] bg-amber-500/15 text-[#C8A97E] font-mono px-1.5 py-0.2 rounded font-bold">QR ORDER</span>
              <h1 className="text-sm md:text-md font-bold tracking-tight text-white uppercase">BEAN & BEYOND</h1>
            </div>
            <p className="text-[8px] text-[#C8A97E] font-medium uppercase tracking-widest leading-none">Modern specialty coffee</p>
          </div>
        </div>

        {/* ROLE SWAP PANEL (ONLY SHOWN FOR LOGGED-IN STAFF / ADMIN, NOT ON CUSTOMER PAGE) */}
        {activeRole !== 'Customer' ? (
          <div className="flex items-center gap-1 bg-[#0F0F0F] p-1 rounded-full border border-white/5 overflow-x-auto max-w-[340px] md:max-w-none">
            <button
              onClick={() => handleSwitchRoleAttempt('Customer')}
              className={`px-3 py-1 rounded-full text-xs font-medium cursor-pointer transition ${
                activeRole === 'Customer' ? 'bg-[#C8A97E] text-slate-950 font-bold' : 'text-stone-400 hover:text-stone-200'
              }`}
              id="role-customer-sel"
            >
              ☕ Menu
            </button>
            
            <button
              onClick={() => handleSwitchRoleAttempt('Kasir')}
              className={`px-3 py-1 rounded-full text-xs font-medium cursor-pointer transition flex items-center gap-1 ${
                activeRole === 'Kasir' ? 'bg-[#C8A97E] text-slate-950 font-bold' : 'text-stone-400 hover:text-stone-200'
              }`}
              id="role-kasir-sel"
            >
              💵 Kasir
              {orderHistory.filter(o => o.paymentStatus === 'Unpaid' && o.paymentMethod === 'Cash').length > 0 && (
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse"></span>
              )}
            </button>

            <button
              onClick={() => handleSwitchRoleAttempt('Kitchen')}
              className={`px-3 py-1 rounded-full text-xs font-medium cursor-pointer transition flex items-center gap-1 ${
                activeRole === 'Kitchen' ? 'bg-[#C8A97E] text-slate-950 font-bold' : 'text-stone-400 hover:text-stone-200'
              }`}
              id="role-kitchen-sel"
            >
              👩‍🍳 Dapur
              {orderHistory.filter(o => o.orderStatus === 'Pending' || o.orderStatus === 'Paid').length > 0 && (
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
              )}
            </button>

            <button
              onClick={() => handleSwitchRoleAttempt('Admin')}
              className={`px-3 py-1 rounded-full text-xs font-mono transition ${
                activeRole === 'Admin' ? 'bg-amber-600/30 text-amber-300 font-bold' : 'text-stone-500 hover:text-stone-300'
              }`}
              id="role-admin-sel"
            >
              ⚙ Admin
            </button>
          </div>
        ) : (
          /* Customer Call Waiter Button */
          <div className="hidden md:flex items-center gap-3">
            <div className="text-[11px] text-stone-500 italic font-mono uppercase tracking-widest bg-stone-950 px-4 py-1.5 rounded-full border border-white/5 shadow-inner">
              E-Menu Mandiri Meja {currentTableNum}
            </div>
            {deliveryType === 'Diantar ke Meja' && (
              <button
                onClick={handleCallWaiter}
                disabled={isCallingWaiter}
                className="bg-[#C8A97E] text-slate-950 px-4 py-1.5 rounded-full text-xs font-bold font-mono hover:bg-[#b5966b] transition cursor-pointer disabled:opacity-50 animate-pulse-slow"
              >
                🔔 Panggil Pelayan
              </button>
            )}
          </div>
        )}

        {/* SECURE THREE-DOT PORTAL MENU NAVIGATION */}
        <div className="relative">
          <button
            onClick={() => setIsMenuDropdownOpen(!isMenuDropdownOpen)}
            className="w-10 h-10 rounded-full bg-[#0F0F0F] hover:bg-white/5 flex items-center justify-center text-stone-400 hover:text-[#C8A97E] transition cursor-pointer border border-white/10 shadow-lg"
            id="three-dot-menu-toggle"
            title="Pilih Portal Sistem"
          >
            <MoreVertical className="w-5 h-5" />
          </button>
          
          <AnimatePresence>
            {isMenuDropdownOpen && (
              <>
                <div 
                  className="fixed inset-0 z-40" 
                  onClick={() => setIsMenuDropdownOpen(false)} 
                />
                
                <motion.div
                  initial={{ opacity: 0, y: -12, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -12, scale: 0.96 }}
                  transition={{ duration: 0.15, ease: 'easeOut' }}
                  className="absolute right-0 mt-2.5 w-56 rounded-2xl bg-[#161616] border border-white/10 shadow-2xl z-50 overflow-hidden divide-y divide-white/5"
                >
                  <div className="px-4 py-2.5 bg-gradient-to-r from-stone-900 to-stone-950 text-[10px] text-stone-400 font-mono font-bold tracking-widest uppercase flex items-center gap-1.5 border-b border-white/5">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#C8A97E]"></span>
                    Pilih Portal Cafe
                  </div>
                  
                  <div className="py-1">
                    <button
                      onClick={() => {
                        setIsMenuDropdownOpen(false);
                        handleSwitchRoleAttempt('Customer');
                      }}
                      className="w-full text-left px-4 py-3 text-xs text-stone-300 hover:text-white hover:bg-white/5 font-semibold transition flex items-center gap-2 px-4 cursor-pointer"
                    >
                      ☕ Menu Pelanggan (Customer)
                    </button>
                    
                    <button
                      onClick={() => {
                        setIsMenuDropdownOpen(false);
                        handleSwitchRoleAttempt('Kasir');
                      }}
                      className="w-full text-left px-4 py-3 text-xs text-stone-300 hover:text-white hover:bg-white/5 font-semibold transition flex items-center gap-2 px-4 cursor-pointer"
                    >
                      💵 Portal Kasir (Staff Pin)
                    </button>
                    
                    <button
                      onClick={() => {
                        setIsMenuDropdownOpen(false);
                        handleSwitchRoleAttempt('Kitchen');
                      }}
                      className="w-full text-left px-4 py-3 text-xs text-stone-300 hover:text-white hover:bg-white/5 font-semibold transition flex items-center gap-2 px-4 cursor-pointer"
                    >
                      👩‍🍳 Portal Dapur (Kitchen Pin)
                    </button>
                    
                    <button
                      onClick={() => {
                        setIsMenuDropdownOpen(false);
                        handleSwitchRoleAttempt('Admin');
                      }}
                      className="w-full text-left px-4 py-3 text-xs text-amber-400 hover:text-amber-300 hover:bg-white/5 font-mono font-bold transition flex items-center gap-2 px-4 cursor-pointer"
                    >
                      ⚙ Portal Admin (Owner Pin)
                    </button>
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>

        {/* RE-INITIALIZER TABLE CONFIGS */}
        <div className="hidden lg:flex items-center gap-2">
          <div className="bg-white/5 px-3 py-1 rounded-lg border border-white/10 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
            <span className="text-xs text-stone-300 font-bold">TABLE # {currentTableNum}</span>
          </div>
          
          <button 
            onClick={handleResetDatabase}
            className="text-[10px] text-rose-400 hover:text-rose-300 bg-rose-500/5 px-2.0 py-1.0 rounded border border-rose-500/20 cursor-pointer"
          >
            Reset DB
          </button>
        </div>
      </header>

      {/* EMERGENCY NOTIFICATION BAR */}
      {notifications.length > 0 && (
        <div className="bg-amber-500 text-slate-950 text-xs px-4 py-1.5 flex items-center justify-between font-mono">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping"></span>
            <span><strong>DAPUR REAL-TIME:</strong> {notifications[0].message}</span>
          </div>
          <button 
            onClick={() => { setNotifications([]); }}
            className="underline font-bold text-[9px] uppercase cursor-pointer"
          >
            Clear
          </button>
        </div>
      )}

      {/* CORE FRAMEWORK WORKSPACE */}
      <main className="flex-1 flex flex-col xl:flex-row overflow-hidden">
        
        {/* ========================================================
            1. CUSTOMER PORTAL
            ======================================================== */}
        {activeRole === 'Customer' && (
          <div className="flex-1 flex flex-col lg:flex-row overflow-hidden" id="customer-portal-view">
            
            {/* LEFT CATEGORIES SELECTOR */}
            <aside className="w-full lg:w-60 border-b lg:border-b-0 lg:border-r border-white/5 bg-[#121212] p-4 flex flex-col shrink-0 space-y-4">
              <span className="text-[10px] text-stone-500 font-mono uppercase tracking-wider block font-bold">Categories</span>
              
              <div className="flex lg:flex-col gap-1 overflow-x-auto lg:overflow-x-visible pb-2 lg:pb-0">
                {(['All', 'Coffee', 'Non Coffee', 'Tea', 'Snack', 'Dessert', 'Main Course'] as const).map(cat => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-3 py-2 rounded-xl text-xs font-semibold text-left transition whitespace-nowrap cursor-pointer flex justify-between ${
                      selectedCategory === cat 
                        ? 'bg-[#C8A97E] text-slate-950 font-bold' 
                        : 'text-stone-400 hover:bg-white/5'
                    }`}
                  >
                    <span>{cat === 'All' ? '🌟 Semua Menu' : cat}</span>
                    <span className="text-[10px] opacity-60 ml-2">
                      {cat === 'All' ? products.length : products.filter(p => p.category === cat).length}
                    </span>
                  </button>
                ))}
              </div>

              {/* SPECIAL OFFERS / DISCOUNT CODES */}
              <div className="mt-auto bg-[#181818] p-4 border border-white/5 rounded-2xl space-y-3">
                <div className="flex items-center gap-1.5 pb-1 border-b border-white/5">
                  <Star className="w-4 h-4 text-amber-400" />
                  <span className="text-[10.5px] font-bold uppercase tracking-wider text-white">Promo & Diskon</span>
                </div>
                
                <p className="text-[9.5px] text-stone-400 leading-relaxed">
                  Gunakan kode voucher di bawah saat checkout belanja untuk klaim diskon instan rasa kopi barista Anda.
                </p>

                <div className="space-y-2">
                  {vouchers.map((item) => (
                    <div 
                      key={item.code} 
                      onClick={() => applyVoucherByCode(item.code)}
                      className="p-2 bg-gradient-to-r from-amber-600/10 to-transparent border border-[#C8A97E]/10 rounded-xl cursor-pointer hover:border-[#C8A97E]/55 transition group flex flex-col gap-1 text-left relative overflow-hidden"
                    >
                      <div className="flex justify-between items-center">
                        <span className="font-mono text-[10px] font-bold text-[#C8A97E] group-hover:text-white transition tracking-wide">
                          🎟 {item.code}
                        </span>
                        <span className="text-[9.5px] bg-[#C8A97E] text-slate-950 font-black font-sans px-1.5 py-0.2 rounded">
                          {item.discountPercentage}% OFF
                        </span>
                      </div>
                      
                      <div className="flex justify-between text-[8px] text-stone-400 font-mono">
                        <span>Min. Transaksi Rp{item.minTransaction.toLocaleString('id-ID')}</span>
                        <span className="text-[#C8A97E] group-hover:underline">Klaim Promo</span>
                      </div>
                    </div>
                  ))}
                  {vouchers.length === 0 && (
                    <div className="text-center py-2 text-[10px] text-stone-500 font-mono">
                      Tidak ada voucher promo aktif
                    </div>
                  )}
                </div>

                {appliedVoucher && (
                  <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-2 text-center animate-pulse">
                    <p className="text-[10px] font-bold text-emerald-400">
                      ✔ Voucher {appliedVoucher.code} Aktif!
                    </p>
                    <p className="text-[8px] text-stone-400 font-mono">
                      Potongan {appliedVoucher.discountPercentage}% otomatis terhitung
                    </p>
                  </div>
                )}
              </div>
            </aside>

            {/* MIDDLE CATALOG LISTINGS */}
            <section className="flex-1 p-4 md:p-6 overflow-y-auto bg-[#0F0F0F] space-y-6">
              
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-serif italic text-white flex items-center gap-2">Pilih Menu Digital</h2>
                  <p className="text-xs text-stone-400">Pesanan langsung terhubung ke bagian Dapur & Kasir cafe.</p>
                </div>

                <div className="relative w-full md:w-72">
                  <Search className="w-4 h-4 text-stone-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Cari kopi, mie, kentang..."
                    className="w-full bg-[#161616] pl-9 pr-4 py-2 border border-white/5 rounded-full text-xs text-stone-200 focus:outline-none focus:border-[#C8A97E] placeholder-stone-500"
                  />
                </div>
              </div>

              {/* REAL-TIME ORDER TRACKING BANNER AT THE TOP OF CUSTOMER CATALOG */}
              {activeTrackingId && trackingOrder && trackingOrder.orderStatus !== 'Pending' && (
                <div className="bg-[#161616] border border-[#C8A97E]/35 rounded-2xl p-5 shadow-2xl relative overflow-hidden space-y-4 animate-fadeIn">
                  {/* Subtle ambient light indicator */}
                  <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-amber-500 via-[#C8A97E] to-emerald-500"></div>

                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="flex h-2.5 w-2.5 relative">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#C8A97E] opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#C8A97E]"></span>
                        </span>
                        <h4 className="text-xs font-mono font-bold text-stone-200 tracking-wider">
                          STATUS PESANAN REALTIME: ORDER #{trackingOrder.shortId}
                        </h4>
                      </div>
                      <p className="text-[11px] text-stone-400">
                        Pesanan atas nama <strong className="text-white">{trackingOrder.customerName}</strong> ({trackingOrder.deliveryType}) sedang aktif diproses oleh tim kami.
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button 
                        onClick={() => handleSwitchRoleAttempt(trackingOrder.orderStatus === 'Ready' ? 'Kasir' : 'Kitchen')}
                        className="px-3 py-1.5 bg-[#C8A97E]/10 hover:bg-[#C8A97E]/15 border border-[#C8A97E]/30 rounded-xl text-[10.5px] text-[#C8A97E] font-bold transition flex items-center gap-1 cursor-pointer"
                      >
                        ⚡ Bantu Kerjakan di {trackingOrder.orderStatus === 'Ready' ? 'Kasir' : 'Dapur'}
                      </button>
                      <button 
                        onClick={() => setActiveTrackingId(null)}
                        className="text-[10px] text-stone-500 hover:text-stone-300 font-mono"
                      >
                        Sembunyikan
                      </button>
                    </div>
                  </div>

                  {/* PROGRESS ROADMAP VISUAL */}
                  <div className="grid grid-cols-4 gap-2 pt-2 text-center relative">
                    {[
                      { key: 'confirm', label: 'Diterima', desc: 'Lunas Kasir', active: ['Paid', 'Preparing', 'Ready', 'Completed', 'Delivered'].includes(trackingOrder.orderStatus) },
                      { key: 'cook', label: 'Dimasak', desc: 'Dapur Racik', active: ['Preparing', 'Ready', 'Completed', 'Delivered'].includes(trackingOrder.orderStatus) },
                      { key: 'ready', label: 'Selesai', desc: 'Siap Saji', active: ['Ready', 'Completed', 'Delivered'].includes(trackingOrder.orderStatus) },
                      { key: 'done', label: 'Disajikan', desc: 'Selesai Nikmati', active: ['Completed', 'Delivered'].includes(trackingOrder.orderStatus) }
                    ].map((step, idx, arr) => (
                      <div key={step.key} className="space-y-1.5 relative">
                        {/* Connector Line */}
                        {idx < arr.length - 1 && (
                          <div className={`hidden sm:block absolute top-4 left-[50%] right-[-50%] h-[2px] z-0 ${
                            arr[idx + 1].active ? 'bg-gradient-to-r from-[#C8A97E] to-emerald-500' : 'bg-stone-800'
                          }`} />
                        )}
                        <div className="relative z-10 flex justify-center">
                          <span className={`w-8 h-8 rounded-full flex items-center justify-center border font-mono text-xs font-black transition-all ${
                            step.active 
                              ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white border-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.4)]' 
                              : 'bg-stone-900 text-stone-600 border-white/5'
                          }`}>
                            {step.active ? '✓' : idx + 1}
                          </span>
                        </div>
                        <div className="space-y-0.5">
                          <span className={`block text-[10px] font-bold ${step.active ? 'text-white' : 'text-stone-500'}`}>
                            {step.label}
                          </span>
                          <span className="block text-[8px] text-stone-550 tracking-tight leading-none uppercase font-mono">
                            {step.desc}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* STATUS DESCRIPTION BAR */}
                  <div className="bg-[#121212] p-3 rounded-xl border border-white/5 flex flex-col sm:flex-row justify-between items-center gap-2">
                    <div className="flex items-center gap-2 text-xs">
                      <span className="animate-pulse w-2 h-2 rounded-full bg-[#C8A97E]"></span>
                      <span className="text-stone-300 font-medium">
                        {trackingOrder.orderStatus === 'Paid' && "💵 Transaksi Lunas! Pesanan terkirim ke dapur, menunggu giliran masak."}
                        {trackingOrder.orderStatus === 'Preparing' && "🍳 Barista / Koki sedang meracik bahan kopi & hidangan Anda dengan presisi."}
                        {trackingOrder.orderStatus === 'Ready' && (
                          trackingOrder.deliveryType === 'Diantar ke Meja' 
                            ? "🏃 Hidangan Anda Siap! Waiter sedang mengantarkan pesanan langsung ke Meja " + trackingOrder.tableNumber
                            : "☕ Hidangan Anda Siap! Silakan ambil langsung di meja barista counter."
                        )}
                        {['Completed', 'Delivered'].includes(trackingOrder.orderStatus) && "✔ Nikmati hidangan spesial Anda! Jangan lupa kirim ulasan bintang di bawah ya."}
                      </span>
                    </div>
                    {['Completed', 'Delivered'].includes(trackingOrder.orderStatus) && (
                      <span className="text-[10px] bg-emerald-500/10 text-emerald-400 font-bold px-2 py-0.5 rounded uppercase tracking-wide font-mono">
                        Selesai disajikan
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* MENU CARDS */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4" id="cafe-menu-grid">
                {filteredProducts.map(p => {
                  const isFav = favorites.includes(p.id);
                  return (
                    <div key={p.id} className="bg-[#161616] rounded-2xl border border-white/5 overflow-hidden hover:border-white/15 transition flex flex-col shadow-sm">
                      <div className="h-40 bg-stone-900 relative">
                        <img src={p.image} alt={p.name} className="w-full h-full object-cover" />
                        
                        <span className="absolute top-2 left-2 bg-[#0F0F0F]/85 text-[#C8A97E] text-[10px] px-2 py-0.5 font-mono rounded">
                          {p.category}
                        </span>

                        {p.isPopular && (
                          <span className="absolute top-2 right-2 bg-rose-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded">
                            BEST SELLER
                          </span>
                        )}

                        <button 
                          onClick={() => toggleFavorite(p.id)}
                          className="absolute bottom-2 right-2 w-7 h-7 bg-black/75 rounded-full flex items-center justify-center text-white hover:text-amber-400"
                        >
                          ★
                        </button>
                      </div>

                      <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                        <div>
                          <div className="flex justify-between items-start gap-1">
                            <h3 className="font-bold text-xs text-stone-100">{p.name}</h3>
                            <span className="text-xs font-mono font-bold text-[#C8A97E] whitespace-nowrap">Rp{p.price.toLocaleString('id-ID')}</span>
                          </div>
                          <p className="text-[11px] text-stone-400 h-8 overflow-hidden line-clamp-2 mt-1">{p.description}</p>
                        </div>

                        <div className="flex items-center justify-between pt-2 border-t border-white/5">
                          <span className="text-[10px] text-stone-500 font-mono">Ada: {p.stock} porsi</span>
                          
                          <button
                            onClick={() => addToCart(p)}
                            disabled={p.stock <= 0}
                            className={`px-3 py-1 rounded text-[11px] font-bold uppercase tracking-wider transition ${
                              p.stock > 0 
                                ? 'bg-white/5 hover:bg-[#C8A97E] hover:text-slate-950 border border-white/10 cursor-pointer' 
                                : 'bg-rose-500/10 text-rose-500 cursor-not-allowed'
                            }`}
                          >
                            {p.stock > 0 ? '+ Keranjang' : 'HABIS (Out of Stock)'}
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* RIGHT CART SIDEBAR REMOVED TO PREVENT CONFLICTS AND MAINTAIN ONE SINGLE BOTTOM OVERLAY */}

            {/* FLOATING ACTION FLOATER FOR SHOPPING CART */}
            {cart.length > 0 && (
              <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40">
                <button
                  onClick={() => setIsCartOpen(true)}
                  className="bg-[#C8A97E] hover:bg-[#b5986f] text-slate-950 px-6 py-3.5 rounded-full shadow-2xl flex items-center gap-2.5 font-bold cursor-pointer transition transform hover:scale-105 active:scale-95 duration-200"
                  id="floating-cart-toggler"
                >
                  <div className="relative">
                    <ShoppingCart className="w-5 h-5 text-slate-950" />
                    <span className="absolute -top-3.5 -right-3.5 bg-rose-600 text-white border border-[#121212] text-[10px] w-6 h-6 rounded-full flex items-center justify-center font-extrabold font-mono">
                      {cart.reduce((s, it) => s + it.quantity, 0)}
                    </span>
                  </div>
                  <span className="text-xs uppercase tracking-widest font-extrabold ml-1">Keranjang</span>
                </button>
              </div>
            )}

            {/* SLIDING ANIMATED BOTTOM SHEET DRAWER PANEL */}
            <AnimatePresence>
              {isCartOpen && (
                <>
                  {/* Backdrop Overlay */}
                  <motion.div
                    key="cart-drawer-backdrop"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={() => setIsCartOpen(false)}
                    className="fixed inset-0 bg-black/80 backdrop-blur-xs z-50 pointer-events-auto"
                  />
                  
                  {/* Sliding Bottom Sheet Container */}
                  <motion.div
                    key="cart-drawer-slider"
                    initial={{ y: '100%' }}
                    animate={{ y: 0 }}
                    exit={{ y: '100%' }}
                    transition={{ type: 'spring', damping: 30, stiffness: 250 }}
                    className="fixed bottom-0 left-0 right-0 max-h-[85vh] w-full max-w-lg mx-auto bg-[#121212] border-t border-white/10 rounded-t-3xl shadow-3xl flex flex-col z-50 pointer-events-auto"
                    id="cart-aside-drawer"
                  >
                    {/* Drag Handle Indicator */}
                    <div className="w-12 h-1.5 bg-stone-700/60 rounded-full mx-auto mt-3.5 shrink-0 mb-1"></div>

                    <div className="p-4 border-b border-white/5 flex items-center justify-between">
                      <div>
                        <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                          <ShoppingCart className="w-4 h-4 text-[#C8A97E]" /> Keranjang Belanja
                        </h3>
                        <span className="text-[10px] text-stone-500 font-mono">Daftar item terpilih</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs bg-[#C8A97E]/10 border border-[#C8A97E]/30 text-[#C8A97E] px-2 py-0.5 rounded font-bold font-mono">
                          {cart.reduce((s, it) => s + it.quantity, 0)} Porsi
                        </span>
                        <button
                          onClick={() => setIsCartOpen(false)}
                          className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-stone-400 hover:text-white text-xs cursor-pointer transition"
                        >
                          ✕
                        </button>
                      </div>
                    </div>

                    {/* SHOPPING LIST */}
                    <div className="flex-1 p-4 space-y-3 overflow-y-auto min-h-[200px]">
                      {cart.map((item) => (
                        <div key={item.productId} className="bg-[#161616] p-3 rounded-xl border border-white/5 space-y-2">
                          <div className="flex justify-between items-start gap-1">
                            <div>
                              <h4 className="text-xs font-semibold text-white">{item.name}</h4>
                              <p className="text-xs font-mono font-bold text-[#C8A97E]">Rp{item.price.toLocaleString('id-ID')}</p>
                            </div>
                            
                            <button onClick={() => removeFromCart(item.productId)} className="text-stone-500 hover:text-rose-400 cursor-pointer p-0.5 transition">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          <div className="flex items-center gap-1">
                            <span className="text-[9px] text-stone-500 font-mono">Catatan:</span>
                            <input
                              type="text"
                              value={item.notes}
                              onChange={(e) => updateItemNotes(item.productId, e.target.value)}
                              placeholder="Less sugar, no ice..."
                              className="flex-1 bg-[#0f0f0f] text-[10px] border border-white/5 rounded px-1.5 py-0.5 focus:outline-none focus:border-[#C8A97E] text-stone-305 text-stone-300"
                            />
                          </div>

                          <div className="flex justify-between items-center pt-1 border-t border-white/5">
                            <span className="text-[10px] text-stone-500">Jumlah:</span>
                            <div className="flex items-center gap-1.5">
                              <button onClick={() => updateQuantity(item.productId, -1)} className="w-5 h-5 rounded border border-white/10 flex items-center justify-center text-xs text-stone-400 hover:text-white cursor-pointer hover:border-white">-</button>
                              <span className="text-xs font-mono font-bold text-white w-4 text-center">{item.quantity}</span>
                              <button onClick={() => updateQuantity(item.productId, 1)} className="w-5 h-5 rounded border border-white/10 flex items-center justify-center text-xs text-stone-400 hover:text-white cursor-pointer hover:border-white">+</button>
                            </div>
                          </div>
                        </div>
                      ))}

                      {cart.length === 0 && (
                        <div className="text-center py-24 text-stone-600">
                          <ShoppingCart className="w-10 h-10 mx-auto mb-3 opacity-20" />
                          <p className="text-xs">Keranjang belanja kosong.</p>
                          <button
                            onClick={() => setIsCartOpen(false)}
                            className="mt-4 px-4 py-1.5 bg-white/5 text-stone-400 rounded-full text-xs hover:text-white transition cursor-pointer"
                          >
                            Pilih Menu Kopi
                          </button>
                        </div>
                      )}
                    </div>

                    {/* BILL SUMMARY */}
                    {cart.length > 0 && (
                      <div className="p-4 bg-[#161616] border-t border-white/10 space-y-4">
                        
                        {/* Opsi Pengantaran */}
                        <div className="space-y-1">
                          <span className="text-[10px] text-stone-400 uppercase font-mono block font-bold">Cara Pengambilan:</span>
                          <div className="grid grid-cols-2 gap-1.5">
                            <button
                              onClick={() => setDeliveryType('Ambil Sendiri')}
                              className={`py-1.5 px-1 rounded text-[10.5px] border cursor-pointer font-medium transition ${
                                deliveryType === 'Ambil Sendiri' ? 'bg-[#C8A97E]/10 border-[#C8A97E] text-[#C8A97E] font-bold' : 'bg-stone-900 border-white/5 text-stone-400 hover:text-white'
                              }`}
                            >
                              Take-Away (No Fee)
                            </button>
                            <button
                              onClick={() => setDeliveryType('Diantar ke Meja')}
                              className={`py-1.5 px-1 rounded text-[10.5px] border cursor-pointer font-medium transition ${
                                deliveryType === 'Diantar ke Meja' ? 'bg-[#C8A97E]/10 border-[#C8A97E] text-[#C8A97E] font-bold' : 'bg-stone-900 border-white/5 text-stone-400 hover:text-white'
                              }`}
                            >
                              Antar Meja (+2% fee)
                            </button>
                          </div>
                        </div>

                        {/* Voucher input */}
                        <div className="space-y-1">
                          <span className="text-[10px] text-stone-400 uppercase font-mono block font-bold">Kode Voucher:</span>
                          <div className="flex gap-1">
                            <input
                              type="text"
                              value={voucherCode}
                              onChange={(e) => setVoucherCode(e.target.value)}
                              placeholder="CONTOH: COFFEELOVER"
                              className="flex-1 bg-[#121212] border border-white/10 rounded px-2-5 px-3 py-1.5 text-xs text-white placeholder-stone-600 focus:outline-none focus:border-[#C8A97E]"
                            />
                            <button onClick={applyVoucher} className="px-3 bg-white/5 hover:bg-[#C8A97E] hover:text-slate-950 text-xs rounded font-bold cursor-pointer border border-white/10 transition">Klaim</button>
                          </div>
                          {appliedVoucher && <p className="text-[10px] text-emerald-400">✔ Voucher aktif! Hemat {appliedVoucher.discountPercentage}%</p>}
                          {voucherError && <p className="text-[10px] text-rose-500">⚠ {voucherError}</p>}
                        </div>

                        {/* Subtotals */}
                        <div className="bg-[#121212] p-3 rounded font-mono text-xs space-y-1 border border-white/5">
                          <div className="flex justify-between text-stone-500">
                            <span>Subtotal</span>
                            <span>Rp{getSubtotal().toLocaleString('id-ID')}</span>
                          </div>
                          {deliveryType === 'Diantar ke Meja' && (
                            <div className="flex justify-between text-[#C8A97E]">
                              <span>Waitress Fee (2%) ({currentTableNum !== 'Ambil Sendiri' ? `Meja ${currentTableNum}` : 'Meja'})</span>
                              <span>+Rp{getWaitressFee().toLocaleString('id-ID')}</span>
                            </div>
                          )}
                          {appliedVoucher && (
                            <div className="flex justify-between text-emerald-400">
                              <span>Diskon</span>
                              <span>-Rp{getDiscount().toLocaleString('id-ID')}</span>
                            </div>
                          )}
                          <hr className="border-stone-800 my-1" />
                          <div className="flex justify-between font-bold text-[#C8A97E]">
                            <span>Grand Total</span>
                            <span>Rp{getGrandTotal().toLocaleString('id-ID')}</span>
                          </div>
                        </div>

                        <button
                          onClick={handleProceedCheckout}
                          disabled={cart.length === 0}
                          className={`w-full py-3 bg-[#C8A97E] text-[#0F0F0F] rounded-xl font-bold uppercase tracking-wider text-xs active:scale-95 transition cursor-pointer ${
                            cart.length > 0 ? '' : 'opacity-40 cursor-not-allowed'
                          }`}
                        >
                          Checkout Belanja Rp{getGrandTotal().toLocaleString('id-ID')}
                        </button>
                      </div>
                    )}
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* ========================================================
            2. KASIR SCREEN
            ======================================================== */}
        {activeRole === 'Kasir' && (
          <div className="flex-1 p-6 space-y-6 overflow-y-auto animate-fadeIn" id="kasir-portal-view">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-1.5 uppercase">💵 Portal Kasir & Keuangan Cafe</h2>
              <p className="text-xs text-stone-400">Kelola persetujuan order masuk, cetak struk belanja, dan sajikan menu matang.</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              <div className="lg:col-span-2 space-y-6">
                
                {/* SECTION 1: PENDING APPROVALS */}
                <div className="bg-[#161616] p-5 rounded-2xl border border-white/5 space-y-4">
                  <div className="flex justify-between items-center border-b border-white/5 pb-2">
                    <span className="text-xs uppercase font-mono tracking-widest text-amber-500 block font-bold">1. Antrean Persetujuan Pesanan Baru</span>
                    <span className="text-[10px] bg-amber-500/10 text-amber-500 font-mono px-2 py-0.5 rounded font-bold">
                      {orderHistory.filter(o => o.orderStatus === 'Pending').length} Pending
                    </span>
                  </div>
                  
                  <div className="space-y-3">
                    {orderHistory.filter(o => o.orderStatus === 'Pending').map(o => (
                      <div key={o.id} className="p-4 bg-[#121212] rounded-xl border border-white/10 space-y-3">
                        <div className="flex justify-between items-start gap-1 flex-wrap">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-amber-500 font-mono font-bold">ORDER #{o.shortId}</span>
                              <span className="text-[10px] bg-white/5 font-mono text-[#C8A97E] px-1.5 py-0.5 rounded uppercase">{o.deliveryType}</span>
                            </div>
                            <span className="block text-xs font-bold text-white mt-1">Pemesan: {o.customerName}</span>
                            <span className="block text-[10px] text-stone-400 font-mono">Metode: {o.paymentMethod} | Meja: {o.tableNumber}</span>
                          </div>

                          <div className="text-right">
                            <span className="text-[10px] text-stone-500 block">Total Tagihan:</span>
                            <span className="text-sm font-mono font-bold text-emerald-400">Rp{o.grandTotal.toLocaleString('id-ID')}</span>
                          </div>
                        </div>

                        <div className="bg-[#161616] p-2.5 rounded text-xs text-stone-400 space-y-0.5">
                          {o.items.map((it, idx) => (
                            <div key={idx} className="flex justify-between">
                              <span>{it.quantity}x {it.name} <span className="text-[#C8A97E] italic font-serif text-[10px]">{it.notes ? `(${it.notes})` : ''}</span></span>
                              <span>Rp{(it.price * it.quantity).toLocaleString('id-ID')}</span>
                            </div>
                          ))}
                        </div>

                        <div className="flex justify-end gap-2 pt-2 border-t border-white/5">
                          <button
                            onClick={() => updateOrderStatus(o.id, { paymentStatus: 'Paid', orderStatus: 'Preparing' })}
                            className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-sans font-bold text-xs rounded-xl cursor-pointer transition flex items-center gap-1 shadow-md"
                          >
                            Setujui & Kirim ke Dapur (Cooking) ✔
                          </button>

                          <button
                            onClick={() => {
                              alert(`\n=== BEAN & BEYOND ===\nCustomer: ${o.customerName}\nTable: ${o.tableNumber}\nReceipt: #${o.shortId}\n=====================\n${o.items.map(i=>`${i.quantity}x ${i.name}`).join('\n')}\n=====================\nTotal: Rp${o.grandTotal.toLocaleString('id-ID')}\n=====================\nStatus: UNAPPROVED`);
                            }}
                            className="px-3 py-1.5 bg-stone-800 text-stone-300 border border-white/10 text-xs rounded-lg cursor-pointer flex items-center gap-1 hover:text-white transition"
                          >
                            <FileText className="w-3.5 h-3.5" /> Pra-Cetak
                          </button>

                          <button 
                            onClick={() => updateOrderStatus(o.id, { orderStatus: 'Cancelled' })} 
                            className="px-2.5 py-1 text-rose-500 hover:bg-rose-500/10 text-xs font-bold rounded-lg cursor-pointer transition"
                          >
                            Tolak
                          </button>
                        </div>
                      </div>
                    ))}

                    {orderHistory.filter(o => o.orderStatus === 'Pending').length === 0 && (
                      <div className="text-center py-10 text-stone-500 bg-[#121212] rounded-xl border border-white/5">
                        <CheckCircle className="w-8 h-8 text-emerald-500/20 mx-auto mb-2" />
                        <p className="text-xs font-mono">Belum ada pesanan baru masuk menanti persetujuan Kasir.</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* SECTION 2: COOKED / READY FOR PICKUP */}
                <div className="bg-[#161616] p-5 rounded-2xl border border-white/5 space-y-4">
                  <div className="flex justify-between items-center border-b border-white/5 pb-2">
                    <span className="text-xs uppercase font-mono tracking-widest text-emerald-400 block font-bold">2. Sajian Matang dari Dapur (Siap Saji / Ambil)</span>
                    <span className="text-[10px] bg-emerald-500/10 text-emerald-400 font-mono px-2 py-0.5 rounded font-bold">
                      {orderHistory.filter(o => o.orderStatus === 'Ready').length} Siap
                    </span>
                  </div>
                  
                  <div className="space-y-3">
                    {orderHistory.filter(o => o.orderStatus === 'Ready').map(o => (
                      <div key={o.id} className="p-4 bg-[#121212] rounded-xl border border-emerald-500/15 space-y-3">
                        <div className="flex justify-between items-start gap-1 flex-wrap">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-emerald-400 font-mono font-bold animate-pulse">● MATANG # {o.shortId}</span>
                              <span className="text-[10px] bg-emerald-500/10 font-mono text-emerald-400 px-1.5 py-0.5 rounded uppercase">{o.deliveryType} Meja {o.tableNumber}</span>
                            </div>
                            <span className="block text-xs font-bold text-white mt-1">Pemesan: {o.customerName}</span>
                          </div>

                          <div className="text-right">
                            <span className="text-[10px] text-stone-500 block">Total Tagihan:</span>
                            <span className="text-sm font-mono font-bold text-emerald-400">Rp{o.grandTotal.toLocaleString('id-ID')}</span>
                          </div>
                        </div>

                        <div className="bg-[#161616] p-2.5 rounded text-xs text-stone-400 space-y-0.5 border border-white/5">
                          {o.items.map((it, idx) => (
                            <div key={idx} className="flex justify-between">
                              <span>{it.quantity}x {it.name} <span className="text-[#C8A97E] italic font-serif text-[10px]">{it.notes ? `(${it.notes})` : ''}</span></span>
                            </div>
                          ))}
                        </div>

                        <div className="flex justify-end gap-2 pt-2 border-t border-white/5">
                          <button
                            onClick={() => updateOrderStatus(o.id, { orderStatus: 'Completed' })}
                            className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-sans font-black text-xs rounded-xl cursor-pointer transition flex items-center gap-1 shadow-md"
                          >
                            Selesai & Serahkan ke Meja Pelanggan ✔
                          </button>

                          <button
                            onClick={() => {
                              alert(`\n=== STRUK BEAN & BEYOND ===\nCustomer: ${o.customerName}\nTable: ${o.tableNumber}\nReceipt: #${o.shortId}\n=====================\n${o.items.map(i=>`${i.quantity}x ${i.name}`).join('\n')}\n=====================\nTotal Tagihan: Rp${o.grandTotal.toLocaleString('id-ID')}\n=====================\nSTATUS: SELESAI DISAJIKAN`);
                            }}
                            className="px-3 py-1.5 bg-stone-800 text-white border border-white/10 text-xs rounded-lg cursor-pointer flex items-center gap-1 hover:bg-stone-750 transition"
                          >
                            <FileText className="w-3.5 h-3.5" /> Cetak Struk Belanja
                          </button>
                        </div>
                      </div>
                    ))}

                    {orderHistory.filter(o => o.orderStatus === 'Ready').length === 0 && (
                      <div className="text-center py-10 text-stone-500 bg-[#121212] rounded-xl border border-white/5">
                        <CheckCircle className="w-8 h-8 text-stone-600/20 mx-auto mb-2" />
                        <p className="text-xs font-mono">Belum ada makanan matang di counter saji.</p>
                      </div>
                    )}
                  </div>
                </div>

              </div>

              {/* SIDEBAR WIDGETS */}
              <div className="space-y-6">
                
                {/* WAITER CALLS */}
                <div className="bg-[#161616] p-5 rounded-2xl border border-white/5 space-y-4">
                  <span className="text-xs uppercase font-mono tracking-widest text-[#C8A97E] block font-bold flex items-center justify-between">
                    <span>Panggilan Waiter</span>
                    {waiterCalls.filter(c => c.status === 'Waiting').length > 0 && (
                      <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse"></span>
                    )}
                  </span>
                  
                  <div className="space-y-2.5 max-h-[300px] overflow-y-auto">
                    {waiterCalls.filter(c => c.status !== 'Completed').map(c => (
                      <div key={c.id} className="p-3 bg-[#121212] rounded text-xs items-center font-mono border border-white/5 space-y-2">
                        <div className="flex justify-between items-start">
                          <div>
                            <span className="text-white font-bold block">Meja #{c.tableNumber}</span>
                            <span className="text-[9px] text-stone-500 block">{new Date(c.createdAt).toLocaleTimeString('id-ID')}</span>
                          </div>
                          <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase ${c.status === 'Waiting' ? 'bg-rose-500/10 text-rose-500 animate-pulse' : 'bg-amber-500/10 text-amber-500'}`}>
                            {c.status}
                          </span>
                        </div>
                        <div className="flex gap-2">
                          {c.status === 'Waiting' ? (
                             <button
                               onClick={async () => {
                                  const { supabase } = await import('./supabaseClient');
                                  await supabase.from('waiter_calls').update({ status: 'Accepted' }).eq('id', c.id);
                               }}
                               className="flex-1 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-lg text-[10px] cursor-pointer transition"
                             >
                               Otw Ke Meja
                             </button>
                          ) : (
                             <button
                               onClick={async () => {
                                  const { supabase } = await import('./supabaseClient');
                                  await supabase.from('waiter_calls').update({ status: 'Completed', completedAt: new Date().toISOString() }).eq('id', c.id);
                               }}
                               className="flex-1 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold rounded-lg text-[10px] cursor-pointer transition"
                             >
                               Selesai ✔
                             </button>
                          )}
                        </div>
                      </div>
                    ))}
                    {waiterCalls.filter(c => c.status !== 'Completed').length === 0 && (
                      <div className="text-center py-4 text-stone-600 text-[10px] font-mono">
                        Tidak ada panggilan meja.
                      </div>
                    )}
                  </div>
                </div>

                {/* SUMMARY BOOK */}
                <div className="bg-[#161616] p-5 rounded-2xl border border-white/5 space-y-4">
                  <span className="text-xs uppercase font-mono tracking-widest text-[#C8A97E] block font-bold">Riwayat Bayar Lunas</span>
                  
                  <div className="space-y-2.5 max-h-[500px] overflow-y-auto">
                  {orderHistory.filter(o => o.paymentStatus === 'Paid' || o.orderStatus === 'Completed').map(o => (
                    <div key={o.id} className="p-3 bg-[#121212] rounded text-xs flex justify-between items-center font-mono border border-white/5">
                      <div>
                        <div className="flex items-center gap-1">
                          <span className="text-stone-300 font-bold block">Invoice: #{o.shortId}</span>
                          <span className={`text-[8px] px-1 rounded uppercase ${o.orderStatus === 'Completed' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-500'}`}>
                            {o.orderStatus === 'Completed' ? 'Done' : 'Cook'}
                          </span>
                        </div>
                        <span className="text-stone-550 text-[10px] text-stone-500">Meja: {o.tableNumber} | {o.customerName}</span>
                      </div>
                      <span className="text-[#C8A97E] font-bold">Rp{o.grandTotal.toLocaleString('id-ID')}</span>
                    </div>
                  ))}
                </div>
              </div>

              </div>
            </div>
          </div>
        )}

        {/* ========================================================
            3. KITCHEN BAR SECTION
            ======================================================== */}
        {activeRole === 'Kitchen' && (
          <div className="flex-1 p-4 md:p-6 space-y-6 overflow-y-auto animate-fadeIn" id="kitchen-portal-view">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-1.5 uppercase">👨‍🍳 Antrean Chef & Dapur Cafe</h2>
              <p className="text-xs text-stone-400">Siapkan menu pesanan (Dalam Proses Cooking) sesuai kustom rasa pelanggan tanpa nominal harga.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4" id="kitchen-queue">
              {orderHistory.filter(o => o.orderStatus === 'Preparing').map(o => (
                <div key={o.id} className="bg-[#161616] p-4 rounded-xl border border-white/5 flex flex-col justify-between space-y-4">
                  <div>
                    <div className="flex justify-between items-start border-b border-white/5 pb-2 mb-2">
                      <div>
                        <span className="text-xs font-mono font-bold text-amber-500">ORDER #{o.shortId}</span>
                        <p className="text-[10px] text-stone-500">Metode: {o.deliveryType}</p>
                      </div>
                      <span className="text-xs text-white font-mono bg-stone-900 border border-white/10 px-2 py-0.5 rounded">Meja: {o.tableNumber}</span>
                    </div>

                    <div className="space-y-1.5">
                      {o.items.map((it, idx) => (
                        <div key={idx} className="bg-[#121212] p-2 rounded border border-white/5 text-xs">
                          <span className="text-white font-bold">{it.quantity}x {it.name}</span>
                          {it.notes && (
                            <p className="text-[10px] font-bold text-amber-400 mt-1 bg-amber-500/5 px-2 py-1 rounded font-mono">➡ Catatan: {it.notes}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-1.5 pt-2 border-t border-white/5">
                    <div className="flex justify-between text-[11px] text-stone-500 font-mono">
                      <span>Progres Masak:</span>
                      <span className="text-amber-500 font-bold animate-pulse">🍳 Dalam Proses Cooking</span>
                    </div>

                    <button
                      onClick={() => updateOrderStatus(o.id, { orderStatus: 'Ready' })}
                      className="w-full bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-black py-2.5 rounded-xl text-xs font-mono cursor-pointer transition uppercase"
                    >
                      Selesai Masak (Matang) ✔
                    </button>
                  </div>
                </div>
              ))}

              {orderHistory.filter(o => o.orderStatus === 'Preparing').length === 0 && (
                <div className="col-span-full py-16 text-center text-stone-500 bg-[#161616] rounded-xl border border-white/5">
                  <ChefHat className="w-10 h-10 mx-auto mb-2 text-stone-600 opacity-30" />
                  <p className="text-xs">Hebat! Semua antrean masak di Dapur sudah selesai.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* GONE: Waitress has been deleted as requested */}

        {/* ========================================================
            5. ADMIN HUB
            ======================================================== */}
        {activeRole === 'Admin' && (
          <div className="flex-1 p-6 space-y-6 overflow-y-auto animate-fadeIn" id="admin-portal-view">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/5 pb-4">
              <div>
                <h2 className="text-lg font-bold text-white flex items-center gap-1.5 font-mono">⚡ KONTROL ADMINISTRASI BACKOFFICE CAFE</h2>
                <p className="text-xs text-stone-400">Pantau peredaran bahan baku kupon voucher serta laporan penjualan harian.</p>
              </div>

              <div className="flex gap-1.5">
                <button
                  onClick={() => setAdminActiveTab('menus')}
                  className={`px-3 py-1.5 rounded text-xs font-mono cursor-pointer ${
                    adminActiveTab === 'menus' ? 'bg-[#C8A97E] text-slate-950 font-bold' : 'bg-[#161616] text-stone-300'
                  }`}
                >
                  📋 Katalog & Stok
                </button>
                <button
                  onClick={() => setAdminActiveTab('vouchers')}
                  className={`px-3 py-1.5 rounded text-xs font-mono cursor-pointer ${
                    adminActiveTab === 'vouchers' ? 'bg-[#C8A97E] text-slate-950 font-bold' : 'bg-[#161616] text-stone-300'
                  }`}
                >
                  🎟 Voucher Promo
                </button>
                <button
                  onClick={() => setAdminActiveTab('reports')}
                  className={`px-3 py-1.5 rounded text-xs font-mono cursor-pointer ${
                    adminActiveTab === 'reports' ? 'bg-[#C8A97E] text-slate-950 font-bold' : 'bg-[#161616] text-stone-300'
                  }`}
                >
                  📈 Laba Omzet
                </button>
                <button
                  onClick={() => setAdminActiveTab('sheets')}
                  className={`px-3 py-1.5 rounded text-xs font-mono cursor-pointer ${
                    adminActiveTab === 'sheets' ? 'bg-[#C8A97E] text-slate-950 font-bold' : 'bg-[#161616] text-stone-300'
                  }`}
                >
                  🟢 Google Spreadsheet DB
                </button>
                <button
                  onClick={() => setAdminActiveTab('settings')}
                  className={`px-3 py-1.5 rounded text-xs font-mono cursor-pointer ${
                    adminActiveTab === 'settings' ? 'bg-[#C8A97E] text-slate-950 font-bold' : 'bg-[#161616] text-stone-300'
                  }`}
                >
                  ⚙⚙ Pengaturan
                </button>
                <button
                  onClick={() => setAdminActiveTab('stock')}
                  className={`px-3 py-1.5 rounded text-xs font-mono cursor-pointer ${
                    adminActiveTab === 'stock' ? 'bg-[#C8A97E] text-slate-950 font-bold' : 'bg-[#161616] text-stone-300'
                  }`}
                >
                  📦 Manajemen Stok
                </button>
              </div>
            </div>

            {adminActiveTab === 'menus' && (
              <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                
                <div className="bg-[#161616] p-5 rounded-2xl border border-white/5 space-y-4">
                  <h3 className="text-xs font-bold text-[#C8A97E] uppercase font-mono tracking-widest">
                    {editingProduct ? '✏ Edit Item Menu' : '📋 Tambah Item Menu'}
                  </h3>
                  
                  {editingProduct ? (
                    <form onSubmit={handleUpdateProduct} className="space-y-3">
                      <div>
                        <label className="text-[10px] text-stone-400 block mb-1">Nama Produk:*</label>
                        <input
                          type="text"
                          required
                          value={editingProduct.name}
                          onChange={(e) => setEditingProduct({ ...editingProduct, name: e.target.value })}
                          className="w-full bg-[#121212] border border-white/10 rounded p-2 text-xs text-white"
                          placeholder="Premium Macchiato"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[10px] text-stone-400 block mb-1">Kategori:*</label>
                          <select
                            value={editingProduct.category}
                            onChange={(e) => setEditingProduct({ ...editingProduct, category: e.target.value as MenuCategory })}
                            className="w-full bg-[#121212] border border-white/10 rounded p-2 text-xs text-white"
                          >
                            {['Coffee', 'Non Coffee', 'Tea', 'Snack', 'Dessert', 'Main Course'].map(cat => (
                              <option key={cat} value={cat}>{cat}</option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="text-[10px] text-stone-400 block mb-1">Harga (IDR):*</label>
                          <input
                            type="number"
                            required
                            value={editingProduct.price}
                            onChange={(e) => setEditingProduct({ ...editingProduct, price: Number(e.target.value) })}
                            className="w-full bg-[#121212] border border-white/10 rounded p-2 text-xs text-white"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[10px] text-stone-400 block mb-1">Stok saat ini:*</label>
                          <input
                            type="number"
                            required
                            min="0"
                            value={editingProduct.stock}
                            onChange={(e) => setEditingProduct({ ...editingProduct, stock: Number(e.target.value) })}
                            className="w-full bg-[#121212] border border-white/10 rounded p-2 text-xs text-white"
                          />
                        </div>

                        <div className="flex flex-col justify-end pb-1 space-y-1">
                          <label className="flex items-center gap-1.5 text-[10px] text-stone-300 cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={!!editingProduct.isPopular}
                              onChange={(e) => setEditingProduct({ ...editingProduct, isPopular: e.target.checked })}
                              className="accent-[#C8A97E] h-3 w-3"
                            />
                            Menu Terlaris (Popular)
                          </label>
                          <label className="flex items-center gap-1.5 text-[10px] text-stone-300 cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={!!editingProduct.isPromo}
                              onChange={(e) => setEditingProduct({ ...editingProduct, isPromo: e.target.checked })}
                              className="accent-[#C8A97E] h-3 w-3"
                            />
                            Sedang Promo (Promo)
                          </label>
                        </div>
                      </div>

                      {/* Photo Upload container */}
                      <div className="bg-[#121212] p-2.5 rounded border border-white/10 space-y-2">
                        <label className="text-[10px] text-[#C8A97E] font-bold block font-mono uppercase">🖼 Foto / Gambar Menu</label>
                        
                        {editingProduct.image ? (
                          <div className="relative group w-full h-24 bg-stone-900 rounded overflow-hidden flex items-center justify-center border border-white/5">
                            <img src={editingProduct.image} alt="Preview" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition flex items-center justify-center gap-2">
                              <button
                                type="button"
                                onClick={() => setEditingProduct({ ...editingProduct, image: '' })}
                                className="px-2 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded text-[10px] font-sans font-bold cursor-pointer transition select-none"
                              >
                                Hapus Foto X
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="py-4 px-2 border border-dashed border-white/10 rounded text-center text-stone-500 flex flex-col items-center justify-center gap-1">
                            <Upload className="w-5 h-5 text-stone-400" />
                            <span className="text-[10px] block">Pilih file foto dari device Anda</span>
                          </div>
                        )}

                        <div className="flex items-center gap-1.5">
                          <input
                            type="file"
                            accept="image/*"
                            id="edit-product-file-input"
                            className="hidden"
                            onChange={handleImageUpload}
                          />
                          <label
                            htmlFor="edit-product-file-input"
                            className="flex-1 text-center py-1.5 bg-stone-800 hover:bg-stone-750 text-[#C8A97E] rounded text-[10.5px] font-bold cursor-pointer border border-[#C8A97E]/10 select-none transition"
                          >
                            📁 Upload File Foto
                          </label>
                        </div>

                        <div>
                          <label className="text-[9px] text-stone-500 block mb-1">Atau masukkan URL Foto Manual:</label>
                          <input
                            type="text"
                            value={editingProduct.image}
                            onChange={(e) => setEditingProduct({ ...editingProduct, image: e.target.value })}
                            className="w-full bg-stone-950 border border-white/5 rounded p-1.5 text-[10.5px] text-stone-300 font-mono"
                            placeholder="https://..."
                          />
                        </div>
                      </div>

                      <div>
                        <label className="text-[10px] text-stone-400 block mb-1">Kuliner Deskripsi:</label>
                        <textarea
                          value={editingProduct.description}
                          onChange={(e) => setEditingProduct({ ...editingProduct, description: e.target.value })}
                          className="w-full h-14 bg-[#121212] border border-white/10 rounded p-2 text-xs text-white"
                          placeholder="Deskripsi cita rasa menu..."
                        />
                      </div>

                      <div className="flex gap-2">
                        <button
                          type="submit"
                          className="flex-1 py-2 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold text-xs uppercase tracking-wider rounded font-mono cursor-pointer transition shadow-md"
                        >
                          Simpan Perubahan ✔
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingProduct(null)}
                          className="px-3.5 py-2 bg-stone-800 hover:bg-stone-750 text-white rounded text-xs transition cursor-pointer"
                        >
                          Batal
                        </button>
                      </div>
                    </form>
                  ) : (
                    <form onSubmit={handleAddProduct} className="space-y-3">
                      <div>
                        <label className="text-[10px] text-stone-400 block mb-1">Nama Produk:*</label>
                        <input
                          type="text"
                          required
                          value={newMenuForm.name}
                          onChange={(e) => setNewMenuForm({ ...newMenuForm, name: e.target.value })}
                          className="w-full bg-[#121212] border border-white/10 rounded p-2 text-xs text-white"
                          placeholder="Premium Macchiato"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[10px] text-stone-400 block mb-1">Kategori:*</label>
                          <select
                            value={newMenuForm.category}
                            onChange={(e) => setNewMenuForm({ ...newMenuForm, category: e.target.value as MenuCategory })}
                            className="w-full bg-[#121212] border border-white/10 rounded p-2 text-xs text-white"
                          >
                            {['Coffee', 'Non Coffee', 'Tea', 'Snack', 'Dessert', 'Main Course'].map(cat => (
                              <option key={cat} value={cat}>{cat}</option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="text-[10px] text-stone-400 block mb-1">Harga (IDR):*</label>
                          <input
                            type="number"
                            required
                            placeholder="25000"
                            value={newMenuForm.price}
                            onChange={(e) => setNewMenuForm({ ...newMenuForm, price: e.target.value })}
                            className="w-full bg-[#121212] border border-white/10 rounded p-2 text-xs text-white"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[10px] text-stone-400 block mb-1">Stok Awal:*</label>
                          <input
                            type="number"
                            required
                            min="0"
                            value={newMenuForm.stock}
                            onChange={(e) => setNewMenuForm({ ...newMenuForm, stock: e.target.value })}
                            className="w-full bg-[#121212] border border-white/10 rounded p-2 text-xs text-white"
                          />
                        </div>

                        <div className="flex flex-col justify-end pb-1 space-y-1">
                          <label className="flex items-center gap-1.5 text-[10px] text-stone-300 cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={newMenuForm.isPopular}
                              onChange={(e) => setNewMenuForm({ ...newMenuForm, isPopular: e.target.checked })}
                              className="accent-[#C8A97E] h-3 w-3"
                            />
                            Menu Terlaris (Popular)
                          </label>
                          <label className="flex items-center gap-1.5 text-[10px] text-stone-300 cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={newMenuForm.isPromo}
                              onChange={(e) => setNewMenuForm({ ...newMenuForm, isPromo: e.target.checked })}
                              className="accent-[#C8A97E] h-3 w-3"
                            />
                            Sedang Promo (Promo)
                          </label>
                        </div>
                      </div>

                      {/* Photo Upload container */}
                      <div className="bg-[#121212] p-2.5 rounded border border-white/10 space-y-2">
                        <label className="text-[10px] text-[#C8A97E] font-bold block font-mono uppercase">🖼 Foto / Gambar Menu</label>
                        
                        {newMenuForm.image ? (
                          <div className="relative group w-full h-24 bg-stone-900 rounded overflow-hidden flex items-center justify-center border border-white/5">
                            <img src={newMenuForm.image} alt="Preview" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition flex items-center justify-center gap-2">
                              <button
                                type="button"
                                onClick={() => setNewMenuForm({ ...newMenuForm, image: '' })}
                                className="px-2 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded text-[10px] font-sans font-bold cursor-pointer transition select-none"
                              >
                                Hapus Foto X
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="py-4 px-2 border border-dashed border-white/10 rounded text-center text-stone-500 flex flex-col items-center justify-center gap-1">
                            <Upload className="w-5 h-5 text-stone-400" />
                            <span className="text-[10px] block">Pilih file foto dari device Anda</span>
                          </div>
                        )}

                        <div className="flex items-center gap-1.5">
                          <input
                            type="file"
                            accept="image/*"
                            id="add-product-file-input"
                            className="hidden"
                            onChange={handleImageUpload}
                          />
                          <label
                            htmlFor="add-product-file-input"
                            className="flex-1 text-center py-1.5 bg-stone-800 hover:bg-stone-750 text-[#C8A97E] rounded text-[10.5px] font-bold cursor-pointer border border-[#C8A97E]/10 select-none transition"
                          >
                            📁 Pilih File Gambar / Upload Foto
                          </label>
                        </div>

                        <div>
                          <label className="text-[9px] text-stone-500 block mb-1">Atau masukkan URL Foto Manual:</label>
                          <input
                            type="text"
                            value={newMenuForm.image}
                            onChange={(e) => setNewMenuForm({ ...newMenuForm, image: e.target.value })}
                            className="w-full bg-stone-950 border border-white/5 rounded p-1.5 text-[10.5px] text-stone-300 font-mono"
                            placeholder="https://..."
                          />
                        </div>
                      </div>

                      <div>
                        <label className="text-[10px] text-stone-400 block mb-1">Kuliner Deskripsi:</label>
                        <textarea
                          value={newMenuForm.description}
                          onChange={(e) => setNewMenuForm({ ...newMenuForm, description: e.target.value })}
                          className="w-full h-14 bg-[#121212] border border-white/10 rounded p-2 text-xs text-white"
                          placeholder="Deskripsi cita rasa menu..."
                        />
                      </div>

                      <button
                        type="submit"
                        className="w-full py-2 bg-[#C8A97E] hover:bg-[#b5966b] text-slate-950 font-bold text-xs uppercase tracking-wider rounded font-mono cursor-pointer transition select-none"
                      >
                        Simpan Menu ✔
                      </button>
                    </form>
                  )}
                </div>

                <div className="col-span-full xl:col-span-2 bg-[#161616] p-5 rounded-2xl border border-white/5 space-y-4">
                  <h3 className="text-xs font-bold text-[#C8A97E] uppercase font-mono tracking-widest">Daftar Menu Digital</h3>
                  
                  <div className="divide-y divide-white/5 max-h-[460px] overflow-y-auto pr-2">
                    {products.map(p => (
                      <div key={p.id} className="py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-center gap-2.5">
                          <img src={p.image} alt={p.name} className="w-10 h-10 rounded object-cover shrink-0 bg-stone-800" referrerPolicy="no-referrer" />
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="text-[9px] bg-white/5 px-1.5 py-0.2 rounded text-[#C8A97E] font-mono">{p.category}</span>
                              {p.isPopular && <span className="text-[8px] bg-amber-500/10 text-amber-500 border border-amber-500/10 px-1 py-0.1 rounded font-bold uppercase font-mono">POPULAR</span>}
                              {p.isPromo && <span className="text-[8px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/10 px-1 py-0.1 rounded font-bold uppercase font-mono">PROMO</span>}
                            </div>
                            <h4 className="text-xs font-bold text-white mt-0.5">{p.name}</h4>
                            <p className="text-[11px] text-stone-400">Rp{p.price.toLocaleString('id-ID')}</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <div className="bg-[#121212] px-2 py-1 rounded border border-white/10 flex items-center gap-2">
                            <span className="text-[10px] text-stone-500">Stok:</span>
                            <span className="text-xs font-mono font-bold text-white w-4 text-center">{p.stock}</span>
                            <div className="flex flex-col">
                              <button onClick={() => handleUpdateStock(p.id, p.stock + 1)} className="text-[9px] text-[#C8A97E] px-1 font-bold cursor-pointer select-none">+</button>
                              <button onClick={() => handleUpdateStock(p.id, Math.max(0, p.stock - 1))} className="text-[9px] text-stone-500 px-1 font-bold cursor-pointer select-none">-</button>
                            </div>
                          </div>

                          <button
                            onClick={() => setEditingProduct(p)}
                            className="px-2.5 py-1 text-xs bg-stone-850 hover:bg-stone-850 border border-white/10 hover:border-white/20 text-stone-300 rounded cursor-pointer transition select-none"
                          >
                            Edit ✏
                          </button>

                          <button onClick={() => handleDeleteProduct(p.id)} className="p-1.5 bg-rose-500/5 hover:bg-rose-500/20 border border-rose-500/20 text-rose-500 rounded cursor-pointer select-none">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

              </div>
            )}

            {adminActiveTab === 'vouchers' && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                  
                  {/* LEFT COLUMN: VOUCHER FORM */}
                  <div className="bg-[#161616] p-5 rounded-2xl border border-white/5 space-y-4">
                    <h3 className="text-xs font-bold text-[#C8A97E] uppercase font-mono tracking-widest">
                      {editingVoucher ? '✏ Edit Voucher Promo' : '🎟 Tambah Voucher Baru'}
                    </h3>

                    {editingVoucher ? (
                      <form onSubmit={handleUpdateVoucher} className="space-y-3">
                        <div>
                          <label className="text-[10px] text-stone-400 block mb-1">Kode Voucher (Tidak bisa diubah):</label>
                          <input
                            type="text"
                            disabled
                            value={editingVoucher.code}
                            className="w-full bg-[#121212] border border-white/10 rounded p-2 text-xs text-stone-550 text-stone-500 font-mono font-bold"
                          />
                        </div>

                        <div>
                          <label className="text-[10px] text-stone-400 block mb-1">Persentase Diskon (%):*</label>
                          <input
                            type="number"
                            required
                            min="1"
                            max="100"
                            value={editingVoucher.discountPercentage}
                            onChange={(e) => setEditingVoucher({ ...editingVoucher, discountPercentage: Number(e.target.value) })}
                            className="w-full bg-[#121212] border border-white/10 rounded p-2 text-xs text-white"
                          />
                        </div>

                        <div>
                          <label className="text-[10px] text-stone-400 block mb-1">Min. Transaksi Belanja (Rp) (Opsional):</label>
                          <input
                            type="number"
                            min="0"
                            value={editingVoucher.minTransaction || ''}
                            onChange={(e) => setEditingVoucher({ ...editingVoucher, minTransaction: Number(e.target.value) })}
                            className="w-full bg-[#121212] border border-white/10 rounded p-2 text-xs text-white"
                          />
                        </div>

                        <div>
                          <label className="text-[10px] text-stone-400 block mb-1">Deskripsi Tambahan:*</label>
                          <textarea
                            required
                            value={editingVoucher.description}
                            onChange={(e) => setEditingVoucher({ ...editingVoucher, description: e.target.value })}
                            className="w-full h-16 bg-[#121212] border border-white/10 rounded p-2 text-xs text-white"
                          />
                        </div>

                        <div className="flex gap-2">
                          <button
                            type="submit"
                            className="flex-1 py-2 bg-emerald-500 text-slate-950 font-bold text-xs uppercase tracking-wider rounded font-mono cursor-pointer"
                          >
                            Simpan Perubahan ✔
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingVoucher(null)}
                            className="px-3 py-2 bg-stone-800 text-stone-400 hover:text-white rounded text-xs"
                          >
                            Batal
                          </button>
                        </div>
                      </form>
                    ) : (
                      <form onSubmit={handleAddVoucher} className="space-y-3">
                        <div>
                          <label className="text-[10px] text-stone-400 block mb-1">Kode Voucher (e.g. KOPIHEMAT):*</label>
                          <input
                            type="text"
                            required
                            placeholder="KOPIHEMAT"
                            value={newVoucherForm.code}
                            onChange={(e) => setNewVoucherForm({ ...newVoucherForm, code: e.target.value.toUpperCase() })}
                            className="w-full bg-[#121212] border border-white/10 rounded p-2 text-xs text-white font-mono"
                          />
                        </div>

                        <div>
                          <label className="text-[10px] text-stone-400 block mb-1">Persentase Diskon (%):*</label>
                          <input
                            type="number"
                            required
                            min="1"
                            max="100"
                            placeholder="15"
                            value={newVoucherForm.discountPercentage}
                            onChange={(e) => setNewVoucherForm({ ...newVoucherForm, discountPercentage: e.target.value })}
                            className="w-full bg-[#121212] border border-white/10 rounded p-2 text-xs text-white"
                          />
                        </div>

                        <div>
                          <label className="text-[10px] text-stone-400 block mb-1">Min. Transaksi Belanja (Rp) (Opsional):</label>
                          <input
                            type="number"
                            min="0"
                            placeholder="Opsional, misal: 30000"
                            value={newVoucherForm.minTransaction}
                            onChange={(e) => setNewVoucherForm({ ...newVoucherForm, minTransaction: e.target.value })}
                            className="w-full bg-[#121212] border border-white/10 rounded p-2 text-xs text-white"
                          />
                        </div>

                        <div>
                          <label className="text-[10px] text-stone-400 block mb-1">Deskripsi Tambahan:*</label>
                          <textarea
                            required
                            placeholder="Diskon khusus akhir pekan"
                            value={newVoucherForm.description}
                            onChange={(e) => setNewVoucherForm({ ...newVoucherForm, description: e.target.value })}
                            className="w-full h-16 bg-[#121212] border border-white/10 rounded p-2 text-xs text-white"
                          />
                        </div>

                        <button
                          type="submit"
                          className="w-full py-2 bg-[#C8A97E] text-slate-950 font-bold text-xs uppercase tracking-wider rounded font-mono cursor-pointer"
                        >
                          Simpan Voucher ✔
                        </button>
                      </form>
                    )}
                  </div>

                  {/* RIGHT COLUMN: LISTING */}
                  <div className="col-span-full xl:col-span-2 bg-[#161616] p-5 rounded-2xl border border-white/5 space-y-4">
                    <h3 className="text-xs font-bold text-[#C8A97E] uppercase font-mono tracking-widest">Daftar Voucher Promo Aktif</h3>
                    
                    <div className="divide-y divide-white/5 max-h-[460px] overflow-y-auto pr-2">
                      {vouchers.map(item => (
                        <div key={item.code} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-xs font-black text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded">
                                🎟 {item.code}
                              </span>
                              <span className="text-[10 px] text-stone-400 text-[10px]">
                                Diskon {item.discountPercentage}%
                              </span>
                            </div>
                            <p className="text-[11px] text-stone-300 leading-relaxed font-sans">
                              {item.description}
                            </p>
                            <div className="text-[10px] text-stone-500 font-mono space-x-3">
                              <span>Min Belanja: {item.minTransaction ? `Rp${item.minTransaction.toLocaleString('id-ID')}` : 'Tidak ada'}</span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => setEditingVoucher(item)}
                              className="px-2.5 py-1 text-xs bg-stone-850 hover:bg-stone-800 text-stone-300 rounded border border-white/10 transition cursor-pointer"
                            >
                              Edit ✏
                            </button>
                            <button
                              onClick={() => handleDeleteVoucher(item.code)}
                              className="p-1 text-rose-500 hover:bg-rose-500/15 border border-rose-500/10 rounded cursor-pointer transition"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}

                      {vouchers.length === 0 && (
                        <div className="text-center py-16 text-stone-550 text-stone-500 bg-[#121212] rounded-xl border border-white/5">
                          Tidak ada voucher promo aktif di database.
                        </div>
                      )}
                    </div>
                  </div>

                </div>

                {/* GENERATE PER-TABLE QR LINK */}
                <div className="bg-[#161616] p-5 border border-white/5 rounded-2xl space-y-3">
                  <h4 className="text-[11px] font-bold text-[#C8A97E] uppercase font-mono">Simulasi link scan QR Code meja</h4>
                  <p className="text-xs text-stone-400">Setiap meja memuat parameter URL unik. Klik tombol tes di bawah ini untuk membuka halaman auto-meja.</p>
                  <div className="grid grid-cols-2 sm:grid-cols-5 xl:grid-cols-10 gap-2">
                    {Array.from({ length: 10 }, (_, i) => String(i + 1).padStart(2, '0')).map(n => (
                      <div key={n} className="bg-[#121212] p-2 rounded border border-white/5 text-center space-y-1.5 flex flex-col items-center">
                        <QrCode className="w-5 h-5 text-amber-500" />
                        <span className="text-[10.5px] font-bold font-mono text-white block">Meja {n}</span>
                        <a href={`/?table=${n}`} className="text-[9px] bg-[#C8A97E] text-slate-950 px-2 py-0.5 rounded font-black uppercase inline-block hover:bg-[#b09267] transition">Tes Url</a>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {adminActiveTab === 'reports' && reportData && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="p-4 bg-[#161616] border border-white/5 rounded-2xl">
                    <span className="text-[10px] text-stone-500 font-mono font-bold block">TOTAL LABA OMZET</span>
                    <h4 className="text-lg font-mono font-bold text-emerald-400">Rp{(reportData.totalOmzet || 0).toLocaleString('id-ID')}</h4>
                  </div>
                  <div className="p-4 bg-[#161616] border border-white/5 rounded-2xl">
                    <span className="text-[10px] text-indigo-400 font-mono font-bold block">TOTAL WAITRESS FEE</span>
                    <h4 className="text-lg font-mono font-bold text-indigo-455 text-indigo-400">Rp{(reportData.totalWaitressFee || 0).toLocaleString('id-ID')}</h4>
                  </div>
                  <div className="p-4 bg-[#161616] border border-white/5 rounded-2xl">
                    <span className="text-[10px] text-amber-500 font-mono font-bold block">VOLUME TRANSAKSI</span>
                    <h4 className="text-lg font-mono font-bold text-amber-500">{reportData.totalOrdersCount || 0} Invoice</h4>
                  </div>
                  <div className="p-4 bg-[#161616] border border-white/5 rounded-2xl">
                    <span className="text-[10px] text-orange-400 font-mono font-bold block">ANTREAN DAPUR</span>
                    <h4 className="text-lg font-mono font-bold text-orange-400">{reportData.preparingCount || 0} Preparing</h4>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  
                  <div className="bg-[#161616] p-5 rounded-2xl border border-white/5 space-y-3">
                    <h4 className="text-xs font-bold font-mono tracking-widest uppercase text-[#C8A97E]">Tren Laba Omzet Kopi</h4>
                    <div className="space-y-3">
                      {reportData.dailySales && reportData.dailySales.map((day: any, i: number) => (
                        <div key={i} className="space-y-1 text-xs">
                          <div className="flex justify-between font-mono text-stone-400">
                            <span>📅 Tanggal: {day.date}</span>
                            <span className="font-bold text-white">Rp{day.omzet.toLocaleString('id-ID')}</span>
                          </div>
                          <div className="h-2 w-full bg-[#121212] rounded-full overflow-hidden">
                            <div className="h-full bg-amber-500 rounded-full" style={{ width: `${Math.min(100, (day.omzet / 150000) * 100)}%` }}></div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="bg-[#161616] p-5 rounded-2xl border border-white/5 space-y-3">
                    <h4 className="text-xs font-bold font-mono tracking-widest uppercase text-[#C8A97E]">Klaim Menu Terlaris</h4>
                    <div className="divide-y divide-white/5 max-h-[300px] overflow-y-auto pr-1">
                      {reportData.bestSellers && reportData.bestSellers.map((item: any, i: number) => (
                        <div key={i} className="py-2 flex items-center justify-between text-xs text-stone-300">
                          <div>
                            <span className="font-bold text-white block">{item.name}</span>
                            <span className="text-[10px] text-stone-500">Kategori: {item.category}</span>
                          </div>
                          <div className="text-right">
                            <span className="font-bold text-[#C8A97E] block">{item.quantity} Terporsi</span>
                            <span className="text-[11px] font-mono text-emerald-400">Rp{item.revenue.toLocaleString('id-ID')}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                </div>

                {/* SYSTEM SECURITY LOGS */}
                <div className="bg-[#161616] p-5 rounded-2xl border border-white/5 space-y-3">
                  <h4 className="text-xs font-bold font-mono text-[#C8A97E]">Log Audit Keamanan Server</h4>
                  <div className="p-3 bg-stone-950 rounded font-mono text-[10.5px] max-h-40 overflow-y-auto space-y-1 text-stone-500 scrollbar-thin">
                    {reportData.logs && reportData.logs.map((log: any) => (
                      <div key={log.id} className="hover:text-stone-300 transition">
                        <span>[{new Date(log.timestamp).toLocaleTimeString()}]</span> <span className="text-indigo-400">{log.user}:</span> {log.action}
                      </div>
                    ))}
                  </div>
                </div>

              </div>
            )}

            {adminActiveTab === 'sheets' && (
              <div className="space-y-6 animate-fadeIn">
                
                {/* GOOGLE SHEET CONNECTION PANEL */}
                <div className="bg-[#161616] border border-white/5 p-6 rounded-2xl space-y-6">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div className="space-y-1">
                      <span className="text-[10px] font-mono font-bold tracking-wider text-[#C8A97E] uppercase block">Integrasi Google Workspace</span>
                      <h3 className="text-lg font-bold text-white flex items-center gap-2">
                        <Database className="w-5 h-5 text-[#C8A97E]" /> Google Drive & Google Sheets Database
                      </h3>
                      <p className="text-xs text-stone-400">Hubungkan dan jadikan Google Spreadsheet pribadi Anda sebagai basis data utama katering cafe Anda.</p>
                    </div>

                    {googleUser ? (
                      <div className="flex items-center gap-3 bg-[#121212] p-2.5 rounded-xl border border-white/5 w-full sm:w-auto justify-between sm:justify-start">
                        <div className="text-left">
                          <span className="text-[9px] bg-emerald-500/10 text-emerald-400 font-mono px-2 py-0.5 rounded font-bold">● TERHUBUNG</span>
                          <p className="text-xs font-bold text-white mt-1">{googleUser.email}</p>
                        </div>
                        <button
                          onClick={handleGoogleLogout}
                          className="px-3 py-1.5 bg-[#1f1f1f] hover:bg-[#2e2e2e] border border-white/5 text-stone-350 rounded text-xs cursor-pointer transition select-none font-mono"
                        >
                          Putus Link
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={handleGoogleLogin}
                        disabled={isSyncingSheets}
                        className="w-full sm:w-auto bg-[#C8A97E] hover:bg-[#bba075] text-[#0F0F0F] font-bold text-xs py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 transition select-none cursor-pointer shadow-lg disabled:opacity-50"
                      >
                        <Share2 className="w-4 h-4" />
                        {isSyncingSheets ? 'Menghubungkan...' : 'Hubungkan Akun Google'}
                      </button>
                    )}
                  </div>

                  {!googleUser && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-white/5 text-xs text-stone-400">
                      <div className="bg-[#121212] p-4 rounded-xl space-y-2 border border-white/5">
                        <span className="font-bold text-[#C8A97E] block">🛡 Privasi Aman & Cepat (Drive.File)</span>
                        <p className="leading-relaxed">
                          Keamanan akun Anda terjamin. Aplikasi kami hanya memohon izin cakupan <strong>drive.file</strong>, yang berarti hanya diotorisasi untuk mengakses spreadsheet yang dibuat oleh web ini sendiri.
                        </p>
                      </div>
                      <div className="bg-[#121212] p-4 rounded-xl space-y-2 border border-white/5">
                        <span className="font-bold text-[#C8A97E] block">📊 Dual-Sync Real Time Database</span>
                        <p className="leading-relaxed">
                          Anda dapat mengedit daftar rasa produk, harga, stok, dan promo lewat Google Sheets serta memperbarui menu web secara instan dengan satu klik saja.
                        </p>
                      </div>
                    </div>
                  )}

                  {googleUser && (
                    <div className="space-y-4 pt-4 border-t border-white/5">
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        
                        {/* LEFT COLUMN: ATUR TARGET SPREADSHEET */}
                        <div className="bg-[#121212] p-5 rounded-xl border border-white/5 space-y-4">
                          <span className="text-[10px] font-mono tracking-widest uppercase text-stone-400 block">1. Pengaturan Lembar Kerja Sheets</span>
                          
                          {googleSpreadsheetId ? (
                            <div className="space-y-3">
                              <div className="space-y-1.5">
                                <span className="text-[10px] text-stone-500 font-mono">Spreadsheet ID Terhubung:</span>
                                <div className="p-2.5 bg-stone-950 font-mono text-[10px] text-emerald-400 rounded border border-white/5 break-all">
                                  {googleSpreadsheetId}
                                </div>
                              </div>

                              <div className="flex flex-wrap gap-2 pt-1">
                                <a
                                  href={`https://docs.google.com/spreadsheets/d/${googleSpreadsheetId}/edit`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold rounded text-xs flex items-center gap-1.5 transition select-none"
                                >
                                  🔗 Buka di Google Sheets
                                </a>
                                <button
                                  onClick={() => {
                                    setGoogleSpreadsheetId('');
                                    localStorage.removeItem('google_spreadsheet_id');
                                  }}
                                  className="px-3 py-1.5 bg-[#1f1f1f] hover:bg-[#2e2e2e] border border-white/10 text-stone-400 hover:text-white rounded text-xs cursor-pointer transition select-none font-mono"
                                >
                                  Ganti File
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="space-y-4">
                              <div className="p-4 bg-emerald-950/20 text-emerald-400 text-xs rounded-lg border border-emerald-950/40">
                                Belum ada spreadsheet yang dikoneksikan. Buat otomatis berkas baru, atau pilih dari Drive Anda.
                              </div>

                              <button
                                onClick={handleCreateSpreadsheet}
                                disabled={isSyncingSheets}
                                className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold text-xs uppercase rounded-xl flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 transition"
                              >
                                ✨ Buat Baru Otomatis Spreadsheet Cafe
                              </button>

                              {availableSpreadsheets.length > 0 && (
                                <div className="space-y-2 pt-2 border-t border-white/5">
                                  <label className="block text-[10px] uppercase font-mono tracking-wide text-stone-500">Pilih Spreadsheet Dari Drive Anda:</label>
                                  <div className="max-h-36 overflow-y-auto space-y-1.5 pr-1">
                                    {availableSpreadsheets.map((sheet) => (
                                      <div
                                        key={sheet.id}
                                        onClick={() => handleSelectSpreadsheet(sheet.id)}
                                        className="p-2 bg-[#161616] hover:bg-[#222] border border-white/5 rounded-lg flex justify-between items-center text-xs text-stone-300 cursor-pointer select-none transition"
                                      >
                                        <span className="font-medium truncate max-w-[200px]">{sheet.name}</span>
                                        <span className="text-[10px] text-[#C8A97E] font-mono">Pilih →</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>

                        {/* RIGHT COLUMN: MANUAL INPUT SECTION */}
                        {!googleSpreadsheetId && (
                          <div className="bg-[#121212] p-5 rounded-xl border border-white/5 space-y-4 flex flex-col justify-center">
                            <span className="text-[10px] font-mono tracking-widest uppercase text-stone-400 block">Atau Input Spreadsheet ID Secara Manual</span>
                            <div className="space-y-2">
                              <input
                                type="text"
                                className="w-full bg-[#161616] p-2 border border-white/10 rounded-lg text-xs placeholder-stone-600 text-white focus:outline-none focus:border-[#C8A97E]"
                                placeholder="Salin spreadsheet ID dari tautan browser Anda..."
                                value={googleSpreadsheetId}
                                onChange={(e) => {
                                  const val = e.target.value.trim();
                                  setGoogleSpreadsheetId(val);
                                  localStorage.setItem('google_spreadsheet_id', val);
                                }}
                              />
                              <p className="text-[10px] text-stone-500 leading-relaxed">
                                ID Spreadsheet adalah baris karakter acak di tautan Google Sheets Anda:<br />
                                <span className="font-mono text-stone-400">docs.google.com/spreadsheets/d/<strong className="text-[#C8A97E]">[SPREADSHEET_ID_DISINI]</strong>/edit</span>
                              </p>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* SYNC ACTIONS CONTROL GRID */}
                      {googleSpreadsheetId && (
                        <div className="pt-6 border-t border-white/5">
                          <h4 className="text-[11px] font-mono tracking-widest uppercase text-stone-400 mb-4 block">🔌 PUSAT SINKRONISASI DATABASE (SINKRON)</h4>
                          
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            
                            {/* BLOCK A: MENUS EXPORT */}
                            <div className="bg-[#121212] p-4.5 rounded-xl border border-white/5 space-y-3 flex flex-col justify-between">
                              <div className="space-y-1">
                                <span className="text-[9px] bg-amber-500/10 text-amber-500 font-mono px-2 py-0.5 rounded font-bold">EKSPOR (MENUS)</span>
                                <h5 className="text-xs font-bold text-white pt-1">Ekspor Menu Lokal ke Google Sheets</h5>
                                <p className="text-[11px] text-stone-400">Unggah seluruh daftar katering ({products.length} menu) beserta detail harga, gambar & stok untuk menimpa lembar kerja <strong>'Menus'</strong> di Google Sheet.</p>
                              </div>
                              <button
                                onClick={handleExportMenus}
                                disabled={isSyncingSheets}
                                className="w-full py-2 bg-[#C8A97E] hover:bg-[#bba075] text-[#0F0F0F] font-black text-xs uppercase rounded-lg transition select-none disabled:opacity-50 cursor-pointer"
                              >
                                {isSyncingSheets ? 'Mengunggah...' : 'Ekspor Katalog Menu 📤'}
                              </button>
                            </div>

                            {/* BLOCK B: MENUS IMPORT */}
                            <div className="bg-[#121212] p-4.5 rounded-xl border border-white/5 space-y-3 flex flex-col justify-between">
                              <div className="space-y-1">
                                <span className="text-[9px] bg-emerald-500/10 text-emerald-400 font-mono px-2 py-0.5 rounded font-bold">IMPOR (MENUS)</span>
                                <h5 className="text-xs font-bold text-white pt-1">Impor Menu dari Google Sheets</h5>
                                <p className="text-[11px] text-stone-400">Muat seluruh data produk dari tab <strong>'Menus'</strong> di Google Sheets untuk menggantikan katalog web saat ini. Silakan sunting harga & menu di Sheets lalu pencet ini.</p>
                              </div>
                              <button
                                onClick={handleImportMenus}
                                disabled={isSyncingSheets}
                                className="w-full py-2 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-black text-xs uppercase rounded-lg transition select-none disabled:opacity-50 cursor-pointer"
                              >
                                {isSyncingSheets ? 'Memuat Data...' : 'Impor Katalog Menu 📥'}
                              </button>
                            </div>

                            {/* BLOCK C: ORDERS EXPORT */}
                            <div className="bg-[#121212] p-4.5 rounded-xl border border-white/5 space-y-3 flex flex-col justify-between col-span-1 md:col-span-2 lg:col-span-1">
                              <div className="space-y-1">
                                <span className="text-[9px] bg-indigo-500/10 text-indigo-400 font-mono px-2 py-0.5 rounded font-bold">EKSPOR (ORDERS)</span>
                                <h5 className="text-xs font-bold text-white pt-1">Ekspor Riwayat Pesanan</h5>
                                <p className="text-[11px] text-stone-400">Sinkronisasikan detail log tagihan, pajak, kupon diskon, waitress fee, dan status pesanan ({orderHistory.length} rincian) ke lab <strong>'Orders'</strong> Google Sheets.</p>
                              </div>
                              <button
                                onClick={handleExportOrders}
                                disabled={isSyncingSheets}
                                className="w-full py-2 bg-indigo-500 hover:bg-indigo-600 text-white font-black text-xs uppercase rounded-lg transition select-none disabled:opacity-50 cursor-pointer"
                              >
                                {isSyncingSheets ? 'Mengirim Data...' : 'Kirim Riwayat Pesanan 📊'}
                              </button>
                            </div>

                          </div>
                        </div>
                      )}
                    </div>
                  )}

                </div>
              </div>
            )}

            {adminActiveTab === 'settings' && (
              <div className="space-y-6 animate-fadeIn">
                <div className="bg-[#161616] border border-white/5 p-6 rounded-2xl space-y-6 max-w-lg">
                  <div className="space-y-1">
                    <span className="text-[10px] font-mono font-bold tracking-wider text-[#C8A97E] uppercase block">Pengaturan Akses</span>
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                      ⚙️ Ganti PIN Portal
                    </h3>
                  </div>

                  <form onSubmit={async (e) => {
                    e.preventDefault();
                    if (pinForm.current !== globalPin) {
                      alert('PIN saat ini salah.');
                      return;
                    }
                    if (pinForm.new.length !== 4) {
                      alert('PIN baru harus 4 digit.');
                      return;
                    }
                    if (pinForm.new !== pinForm.confirm) {
                      alert('Konfirmasi PIN baru tidak cocok.');
                      return;
                    }
                    try {
                      const { supabase } = await import('./supabaseClient');
                      await supabase.from('settings').update({ value: pinForm.new }).eq('key', 'admin_pin');
                      setGlobalPin(pinForm.new);
                      alert('PIN berhasil diubah!');
                      setPinForm({ current: '', new: '', confirm: '' });
                    } catch (err) {
                      console.error(err);
                      alert('Terjadi kesalahan, periksa konsol.');
                    }
                  }} className="space-y-4">
                    <div>
                      <label className="text-[10px] text-stone-400 block mb-1">PIN Saat Ini:</label>
                      <input
                        type="password"
                        maxLength={4}
                        required
                        value={pinForm.current}
                        onChange={(e) => setPinForm({...pinForm, current: e.target.value})}
                        className="w-full bg-[#121212] border border-white/10 rounded p-2 text-xs text-white"
                        placeholder="Masukkan PIN saat ini"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-stone-400 block mb-1">PIN Baru (4 Digit):</label>
                      <input
                        type="password"
                        maxLength={4}
                        required
                        value={pinForm.new}
                        onChange={(e) => setPinForm({...pinForm, new: e.target.value})}
                        className="w-full bg-[#121212] border border-white/10 rounded p-2 text-xs text-white"
                        placeholder="Masukkan PIN baru"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-stone-400 block mb-1">Konfirmasi PIN Baru:</label>
                      <input
                        type="password"
                        maxLength={4}
                        required
                        value={pinForm.confirm}
                        onChange={(e) => setPinForm({...pinForm, confirm: e.target.value})}
                        className="w-full bg-[#121212] border border-white/10 rounded p-2 text-xs text-white"
                        placeholder="Ketik ulang PIN baru"
                      />
                    </div>
                    <button
                      type="submit"
                      className="w-full py-2 bg-[#C8A97E] text-slate-950 font-bold text-xs uppercase tracking-wider rounded font-mono cursor-pointer transition hover:bg-[#b5966b]"
                    >
                      Ubah PIN
                    </button>
                  </form>
                </div>
              </div>
            )}
            
            {adminActiveTab === 'stock' && (
              <div className="space-y-6 animate-fadeIn">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  
                  {/* STOCK FORM */}
                  <div className="bg-[#161616] border border-white/5 p-6 rounded-2xl space-y-6">
                    <h3 className="text-sm font-bold text-white uppercase tracking-wide">Adjust Stok</h3>
                    <form onSubmit={handleStockAdjust} className="space-y-4">
                      <div>
                        <label className="text-[10px] text-stone-400 block mb-1">Pilih Produk:</label>
                        <select
                          required
                          value={stockForm.productId}
                          onChange={(e) => setStockForm({...stockForm, productId: e.target.value})}
                          className="w-full bg-[#121212] border border-white/10 rounded p-2 text-xs text-white"
                        >
                          <option value="">-- Pilih Produk --</option>
                          {products.map(p => (
                            <option key={p.id} value={p.id}>
                              {p.name} (Sisa: {p.stock} | Min: {p.min_stock_alert || 0})
                            </option>
                          ))}
                        </select>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-[10px] text-stone-400 block mb-1">Tipe:</label>
                          <select
                            required
                            value={stockForm.type}
                            onChange={(e) => setStockForm({...stockForm, type: e.target.value})}
                            className="w-full bg-[#121212] border border-white/10 rounded p-2 text-xs text-white"
                          >
                            <option value="IN">Masuk (IN)</option>
                            <option value="OUT">Keluar (OUT)</option>
                          </select>
                        </div>
                        <div>
                          <label className="text-[10px] text-stone-400 block mb-1">Jumlah:</label>
                          <input
                            type="number"
                            min="1"
                            required
                            value={stockForm.quantity}
                            onChange={(e) => setStockForm({...stockForm, quantity: e.target.value})}
                            className="w-full bg-[#121212] border border-white/10 rounded p-2 text-xs text-white"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="text-[10px] text-stone-400 block mb-1">Catatan:</label>
                        <input
                          type="text"
                          required
                          value={stockForm.notes}
                          onChange={(e) => setStockForm({...stockForm, notes: e.target.value})}
                          className="w-full bg-[#121212] border border-white/10 rounded p-2 text-xs text-white"
                          placeholder="Misal: Restock Harian"
                        />
                      </div>

                      <button type="submit" className="w-full py-2 bg-[#C8A97E] text-slate-950 font-bold rounded cursor-pointer transition hover:bg-[#b5966b]">Simpan</button>
                    </form>
                  </div>

                  {/* ALERTS & LOGS */}
                  <div className="lg:col-span-2 space-y-6">
                    {products.filter(p => p.stock <= (p.min_stock_alert || 10)).length > 0 && (
                      <div className="bg-rose-500/10 border border-rose-500/30 p-4 rounded-xl">
                        <h4 className="text-xs text-rose-500 font-bold uppercase mb-2">Peringatan: Stok Menipis!</h4>
                        <div className="space-y-1">
                          {products.filter(p => p.stock <= (p.min_stock_alert || 10)).map(p => (
                            <div key={p.id} className="text-[10px] text-rose-300 font-mono">
                              ⚠️ {p.name} — Sisa: <strong className="text-white">{p.stock}</strong> (Batas: {p.min_stock_alert || 10})
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    <div className="bg-[#161616] border border-white/5 p-6 rounded-2xl">
                      <h3 className="text-sm font-bold text-white uppercase tracking-wide mb-4">Log Riwayat Stok</h3>
                      <div className="max-h-96 overflow-y-auto space-y-2">
                        {stockLogs.map(log => (
                          <div key={log.id} className="flex items-center justify-between p-3 bg-[#121212] rounded-lg border border-white/5">
                            <div>
                              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded mr-2 ${log.type === 'IN' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}`}>
                                {log.type}
                              </span>
                              <span className="text-xs font-bold text-stone-200">{log.products?.name}</span>
                              <span className="block text-[10px] text-stone-500 mt-1">{log.notes}</span>
                            </div>
                            <div className="text-right">
                              <span className="text-xs font-mono font-bold text-white">{log.type === 'IN' ? '+' : '-'}{log.quantity}</span>
                              <span className="block text-[9px] text-stone-600 mt-1">{new Date(log.createdAt).toLocaleDateString('id-ID')}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

      </main>

      {/* ========================================================
          6. PAYMENT GATEWAY SIMULATION GATE (QRIS ONLY WITH CUSTOM DETAILS)
          ======================================================== */}
      {isCheckoutOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeIn" id="checkout-gateway-modal">
          <div className="bg-[#161616] rounded-2xl border border-white/10 p-5 md:p-6 w-full max-w-md space-y-4 shadow-2xl relative">
            
            <div className="flex justify-between items-start border-b border-white/5 pb-3">
              <div>
                <h3 className="text-sm font-bold text-white uppercase font-sans tracking-wide">Bean & Beyond Gateway</h3>
                <p className="text-[10px] text-stone-400">Gerbang Pembayaran Instan QRIS</p>
              </div>
              <button onClick={() => setIsCheckoutOpen(false)} className="text-stone-400 hover:text-white font-bold cursor-pointer w-6 h-6 rounded-full bg-white/5 flex items-center justify-center transition">✕</button>
            </div>

            {/* STEP 1: SETTING NAMA PELANGGAN DAN MEJA */}
            <div className="bg-[#121212] p-4 rounded-xl border border-white/5 space-y-3">
              <span className="text-[10.5px] text-[#C8A97E] font-bold font-mono uppercase tracking-wider block">1. Profil & Meja Pelanggan</span>
              
              <div className="space-y-3">
                {/* Nama Pelanggan */}
                <div>
                  <label className="block text-[9.5px] text-stone-400 font-mono mb-1">Nama Pelanggan:</label>
                  <div className="relative">
                    <User className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-stone-500" />
                    <input
                      type="text"
                      value={customerName === 'Pelanggan' ? '' : customerName}
                      onChange={(e) => setCustomerName(e.target.value || 'Pelanggan')}
                      className="w-full bg-[#161616] pl-8 pr-3 py-1.5 border border-white/10 rounded-lg text-xs font-medium focus:outline-none focus:border-[#C8A97E] text-white"
                      placeholder="Masukkan nama lengkap Anda..."
                    />
                  </div>
                </div>

                {/* Cara Pengambilan & Nomor Meja */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[9.5px] text-stone-400 font-mono mb-1">Cara Pengambilan:</label>
                    <select
                      value={deliveryType}
                      onChange={(e) => {
                        const typeVal = e.target.value as DeliveryType;
                        setDeliveryType(typeVal);
                        if (typeVal === 'Ambil Sendiri') {
                          setCurrentTableNum('Ambil Sendiri');
                        } else if (currentTableNum === 'Ambil Sendiri') {
                          setCurrentTableNum('07');
                        }
                      }}
                      className="w-full bg-[#161616] p-1.5 border border-white/10 rounded-lg text-xs text-stone-200 focus:outline-none focus:border-[#C8A97E]"
                    >
                      <option value="Diantar ke Meja font-sans">Diantar ke Meja</option>
                      <option value="Ambil Sendiri font-sans">Take-Away</option>
                    </select>
                  </div>

                  {deliveryType === 'Diantar ke Meja' && (
                    <div>
                      <label className="block text-[9.5px] text-stone-400 font-mono mb-1">Nomor Meja:</label>
                      <select
                        value={currentTableNum === 'Ambil Sendiri' ? '07' : currentTableNum}
                        onChange={(e) => setCurrentTableNum(e.target.value)}
                        className="w-full bg-[#161616] p-1.5 border border-white/10 rounded-lg text-xs text-stone-200 focus:outline-none focus:border-[#C8A97E]"
                      >
                        {Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0')).map(num => (
                          <option key={num} value={num}>Meja {num}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* STEP 2: SELECT PAYMENT METHOD */}
            <div className="bg-[#121212] p-4 rounded-xl border border-white/5 space-y-3">
              <span className="text-[10.5px] text-[#C8A97E] font-bold font-mono uppercase tracking-wider block">2. Pilih Metode Pembayaran</span>
              
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setSelectedPayment('Cash')}
                  className={`p-3 rounded-xl border flex flex-col items-center justify-center gap-2 transition cursor-pointer ${
                    selectedPayment === 'Cash' 
                      ? 'bg-[#C8A97E]/10 border-[#C8A97E] text-white' 
                      : 'bg-[#161616] border-white/5 text-stone-400 hover:bg-white/5'
                  }`}
                >
                  <span className="text-xl">💵</span>
                  <span className="font-bold text-[11px] uppercase tracking-wider">Tunai (Cash)</span>
                </button>
                
                <button
                  onClick={() => setSelectedPayment('Cashless')}
                  className={`p-3 rounded-xl border flex flex-col items-center justify-center gap-2 transition cursor-pointer ${
                    selectedPayment === 'Cashless' 
                      ? 'bg-[#C8A97E]/10 border-[#C8A97E] text-white' 
                      : 'bg-[#161616] border-white/5 text-stone-400 hover:bg-white/5'
                  }`}
                >
                  <span className="text-xl">📱</span>
                  <span className="font-bold text-[11px] uppercase tracking-wider">Cashless / QRIS</span>
                </button>
              </div>

              {selectedPayment === 'Cashless' && (
                <div className="mt-4 bg-white/5 border border-dashed border-[#C8A97E]/30 rounded-lg p-3 flex flex-col items-center space-y-3 animate-fadeIn">
                  <div className="bg-white p-2.5 rounded-xl shrink-0 w-32 h-32 flex items-center justify-center relative shadow-lg overflow-hidden">
                    <QrCode className="w-28 h-28 text-stone-900" />
                    <div className="absolute left-0 right-0 h-1 bg-rose-500 opacity-60 shadow-[0_0_10px_#f43f5e] animate-scanner-bar" />
                  </div>
                  <div className="text-center space-y-1">
                    <span className="text-[10px] text-stone-500 font-mono">NMID: ID1026065555541</span>
                    <p className="text-[9px] text-stone-400">Silakan scan QRIS untuk pembayaran Cashless.</p>
                  </div>
                </div>
              )}
              
              {selectedPayment === 'Cash' && (
                <div className="mt-4 bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 text-center animate-fadeIn">
                  <p className="text-[10px] text-amber-500">Anda Memilih Pembayaran Tunai</p>
                  <p className="text-[9px] text-stone-400">Silakan bayar di kasir setelah mengkonfirmasi pesanan.</p>
                </div>
              )}

              <div className="pt-2 border-t border-stone-880 border-white/5 flex justify-between text-xs text-stone-400 font-mono">
                <span>Nilai Tagihan:</span>
                <span className="font-bold text-white text-sm">Rp{getGrandTotal().toLocaleString('id-ID')}</span>
              </div>
            </div>

            <div className="flex gap-2.5">
              <button 
                onClick={() => setIsCheckoutOpen(false)} 
                className="px-4 bg-stone-900 hover:bg-stone-850 text-stone-300 rounded-xl text-xs font-semibold cursor-pointer transition border border-white/5"
              >
                Batal
              </button>
              
              <button
                onClick={() => executeOrderCheckout()}
                disabled={isProcessingPayment || !selectedPayment}
                className="flex-1 py-3 bg-[#C8A97E] hover:bg-[#bba075] text-[#0F0F0F] font-bold text-xs uppercase rounded-xl cursor-pointer transition transform active:scale-95 duration-100 shadow-md disabled:opacity-50"
                id="modal-payment-button"
              >
                {isProcessingPayment ? 'Memproses Transaksi...' : selectedPayment ? 'Konfirmasi Pesanan ✔' : 'Pilih Metode Bayar'}
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ========================================================
          7. HISTORICAL REVIEW FOR COMPLETE STATUS
          ======================================================== */}
      {orderHistory.filter(o => o.orderStatus === 'Completed' && !o.rating).length > 0 && (
        <div className="bg-[#161616] border-t border-[#C8A97E]/40 p-4 sticky bottom-0 z-30 animate-slideUp">
          {orderHistory.filter(o => o.orderStatus === 'Completed' && !o.rating).slice(0, 1).map(o => (
            <div key={o.id} className="max-w-4xl mx-auto flex flex-col md:flex-row items-center justify-between gap-3 text-xs">
              <div>
                <span className="text-[10px] uppercase font-mono px-1.5 py-0.2 bg-emerald-500 text-slate-950 font-bold rounded">SAJIAN SELESAI</span>
                <h4 className="font-bold text-stone-300 mt-1">Halo {o.customerName}, bagaimana cita-rasa menu #{o.shortId} kami?</h4>
                <p className="text-stone-500 text-[11px] mt-0.5">Beri ulasan Anda untuk meningkatkan servis barista cafe kami.</p>
              </div>

              <div className="flex items-center gap-2.5 flex-wrap">
                <div className="flex gap-1 bg-[#0F0F0F] p-1 rounded border border-white/5">
                  {[1,2,3,4,5].map(val => (
                    <button
                      key={val}
                      onClick={() => setRatingVal(val)}
                      className={`text-xs cursor-pointer transition ${ratingVal >= val ? 'text-amber-400' : 'text-stone-600'}`}
                    >
                      ★
                    </button>
                  ))}
                </div>

                <div className="flex gap-1">
                  <input
                    type="text"
                    value={reviewTxt}
                    onChange={(e) => setReviewTxt(e.target.value)}
                    placeholder="Feedback rasa..."
                    className="bg-[#0F0F0F] border border-white/10 rounded px-2.5 py-1 text-stone-200 text-xs text-white"
                  />
                  <button
                    onClick={() => updateOrderStatus(o.id, { rating: ratingVal, review: reviewTxt })}
                    className="px-3 py-1 bg-[#C8A97E] text-slate-955 text-slate-950 font-bold rounded uppercase cursor-pointer"
                  >
                    Kirim
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ========================================================
          8. REVIEWS PANEL LANDING
          ======================================================== */}
      {activeRole === 'Customer' && (
        <section className="bg-[#121212] p-4 md:p-8 border-t border-white/5" id="customer-reviews">
          <div className="max-w-7xl mx-auto space-y-4">
            <h3 className="text-sm font-serif italic text-white flex items-center gap-2 border-b border-white/5 pb-2">
              <MessageSquare className="w-4 h-4 text-[#C8A97E]" /> Review & Opini Otentik Customer
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {orderHistory.filter(o => o.rating).map(o => (
                <div key={o.id} className="bg-[#161616] p-3 rounded-lg border border-white/5 space-y-1 text-xs">
                  <div className="flex justify-between items-center text-stone-400 font-bold">
                    <span>{o.customerName}</span>
                    <span className="text-amber-400">{'★'.repeat(o.rating || 5)}</span>
                  </div>
                  <p className="text-stone-300 italic">" {o.review} "</p>
                  <p className="text-[10px] text-stone-500 font-mono">Pesanan: {o.items.map(it => it.name).join(', ')}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}



      {/* ========================================================
          PIN PORTAL SECURITY MODAL (STAFF / ADMIN PROTECTION)
          ======================================================== */}
      {isPinModalOpen && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-md flex items-center justify-center p-4 z-[9999] animate-fadeIn" id="staff-pin-modal">
          <div className="bg-[#161616] rounded-3xl border border-white/10 p-6 w-full max-w-sm space-y-5 shadow-2xl relative">
            
            <button 
              onClick={() => setIsPinModalOpen(false)}
              className="absolute top-4 right-4 text-stone-400 hover:text-white font-bold cursor-pointer w-7 h-7 rounded-full bg-white/5 flex items-center justify-center transition border border-white/5"
            >
              ✕
            </button>

            <div className="text-center space-y-1.5">
              <div className="w-12 h-12 bg-[#C8A97E]/10 border border-[#C8A97E]/20 rounded-full flex items-center justify-center mx-auto mb-1">
                <Lock className="w-5 h-5 text-[#C8A97E]" />
              </div>
              <h3 className="text-sm font-bold text-white uppercase tracking-wider font-sans">
                Verifikasi Portal {pendingRole}
              </h3>
              <p className="text-[10px] text-stone-400">
                Masukkan 4 digit PIN Staff untuk melanjutkan.
              </p>
            </div>

            {/* PIN DISPLAY INDICATORS */}
            <div className="flex justify-center gap-4 py-3">
              {[0, 1, 2, 3].map((idx) => (
                <div 
                  key={idx}
                  className={`w-3.5 h-3.5 rounded-full border transition-all duration-150 ${
                    pinInput.length > idx 
                      ? 'bg-[#C8A97E] border-[#C8A97E] scale-110 shadow-[0_0_8px_rgba(200,169,126,0.5)]' 
                      : 'border-white/20 bg-transparent'
                  }`}
                />
              ))}
            </div>

            {/* ERROR STATS DISPLAY */}
            {pinError ? (
              <div className="text-center text-[10.5px] text-rose-500 font-medium py-1 animate-pulse h-6 flex items-center justify-center">
                {pinError}
              </div>
            ) : (
              <div className="h-6"></div>
            )}

            {/* NUMPAD GRID */}
            <div className="grid grid-cols-3 gap-2.5 max-w-[210px] mx-auto">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((num) => (
                <button
                  key={num}
                  onClick={() => handleKeyPress(num)}
                  className="w-14 h-14 rounded-full bg-[#1F1F1F] hover:bg-white/10 active:bg-white/15 text-lg font-bold text-white transition flex items-center justify-center cursor-pointer shadow-md select-none"
                >
                  {num}
                </button>
              ))}
              <button
                onClick={() => {
                  setPinInput('');
                  setPinError('');
                }}
                className="w-14 h-14 rounded-full text-stone-400 hover:text-white transition flex items-center justify-center text-[10px] uppercase font-bold cursor-pointer font-sans select-none"
              >
                Clear
              </button>
              <button
                onClick={() => handleKeyPress('0')}
                className="w-14 h-14 rounded-full bg-[#1F1F1F] hover:bg-white/10 active:bg-white/15 text-lg font-bold text-white transition flex items-center justify-center cursor-pointer shadow-md select-none"
              >
                0
              </button>
              <button
                onClick={handleDeletePress}
                className="w-14 h-14 rounded-full text-stone-400 hover:text-rose-450 hover:text-rose-400 transition flex items-center justify-center text-[9px] uppercase font-bold cursor-pointer font-sans select-none"
              >
                Del
              </button>
            </div>

          </div>
        </div>
      )}

      {/* STATIC FOOTER STATS */}
      <footer className="bg-[#0f0f0f] border-t border-white/5 px-6 py-4 text-[10px] text-stone-600 flex flex-col md:flex-row justify-between items-center gap-2 mt-auto">
        <span>ONLINE CAFE ORDER SYSTEM ● PREMIUM ARTISAN REFERENCE</span>
        <span>CHANNEL REAL-TIME CONNECTED ● EST. 2026</span>
      </footer>

    </div>
  );
}
