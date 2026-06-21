export type MenuCategory = 'Coffee' | 'Non Coffee' | 'Tea' | 'Snack' | 'Dessert' | 'Main Course';

export interface Product {
  id: string;
  name: string;
  category: MenuCategory;
  price: number;
  originalPrice?: number; // for discount simulation
  description: string;
  image: string;
  stock: number;
  isPopular?: boolean;
  isPromo?: boolean;
}

export interface OrderItem {
  productId: string;
  name: string;
  price: number;
  quantity: number;
  notes: string; // e.g. Less sugar, No ice, Extra hot
}

export type OrderStatus = 'Pending' | 'Paid' | 'Preparing' | 'Ready' | 'Delivered' | 'Completed' | 'Cancelled';
export type PaymentStatus = 'Unpaid' | 'Waiting Payment' | 'Paid' | 'Failed' | 'Refunded';
export type DeliveryType = 'Ambil Sendiri' | 'Diantar ke Meja';
export type PaymentMethod = 'Cash' | 'QRIS' | 'GoPay' | 'OVO' | 'DANA' | 'ShopeePay' | 'Virtual Account' | 'Credit Card';

export interface Order {
  id: string;
  shortId: string; // e.g. A102
  tableNumber: string; // "Ambil Sendiri" or actual table like "03"
  deliveryType: DeliveryType;
  items: OrderItem[];
  subtotal: number;
  waitressFee: number; // 2% of subtotal if deliveryType = 'Diantar ke Meja'
  discount: number;
  grandTotal: number;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  orderStatus: OrderStatus;
  createdAt: string;
  customerName: string;
  customerPhone?: string;
  rating?: number;
  review?: string;
}

export interface Table {
  id: string;
  number: string;
  qrCodeUrl: string;
  status: 'Empty' | 'Occupied' | 'Reserved';
}

export interface Voucher {
  code: string;
  discountPercentage: number;
  maxDiscount: number;
  minTransaction: number;
  description: string;
}

export interface Review {
  id: string;
  orderId: string;
  customerName: string;
  rating: number;
  comment: string;
  createdAt: string;
  menuItemNames: string[];
}

export interface User {
  id: string;
  username: string;
  name: string;
  role: 'Admin' | 'Kasir' | 'Kitchen' | 'Waitress' | 'Customer';
}
