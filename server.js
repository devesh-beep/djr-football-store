const express = require("express");
const path = require("path");
const fs = require("fs");
const Database = require("better-sqlite3");
const multer = require("multer");

const app = express();
const PORT = process.env.PORT || 3000;
const ROOT = __dirname;
const PUBLIC = path.join(ROOT, "public");
const DATA = path.join(ROOT, "data");
fs.mkdirSync(DATA, { recursive: true });
fs.mkdirSync(path.join(PUBLIC, "uploads"), { recursive: true });

const db = new Database(path.join(DATA, "store.db"));
db.pragma("journal_mode = WAL");

db.exec(`
CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  price REAL NOT NULL,
  mrp REAL DEFAULT 0,
  discount INTEGER DEFAULT 0,
  sizes TEXT DEFAULT '',
  stock INTEGER DEFAULT 0,
  image TEXT DEFAULT '',
  description TEXT DEFAULT '',
  featured INTEGER DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_no TEXT UNIQUE NOT NULL,
  customer_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT DEFAULT '',
  address TEXT NOT NULL,
  city TEXT NOT NULL,
  pincode TEXT NOT NULL,
  items TEXT NOT NULL,
  subtotal REAL NOT NULL,
  total REAL NOT NULL,
  utr TEXT NOT NULL,
  status TEXT DEFAULT 'Payment Submitted',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
`);

const productCount = db.prepare("SELECT COUNT(*) AS c FROM products").get().c;
if (productCount === 0) {
  const insert = db.prepare(`
    INSERT INTO products
    (name, category, price, mrp, discount, sizes, stock, image, description, featured)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const seed = [
    ["D.JR Match Football", "Football", 899, 1199, 25, "5", 20, "", "Training and match-ready football.", 1],
    ["D.JR Elite Football Jersey", "Jerseys", 1299, 1799, 28, "S,M,L,XL", 25, "", "Premium football jersey for match day.", 1],
    ["D.JR Training Shorts", "Apparel", 699, 999, 30, "S,M,L,XL", 30, "", "Lightweight football training shorts.", 0],
    ["D.JR Goalkeeper Gloves", "Accessories", 999, 1399, 29, "7,8,9,10", 15, "", "Grip-focused goalkeeper gloves.", 1],
    ["D.JR Football Socks", "Accessories", 299, 449, 33, "S,M,L", 50, "", "Comfortable match socks.", 0],
    ["D.JR Training Kit", "Apparel", 1699, 2299, 26, "S,M,L,XL", 18, "", "Complete football training kit.", 1]
  ];
  const tx = db.transaction(() => seed.forEach(p => insert.run(...p)));
  tx();
}

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, path.join(PUBLIC, "uploads")),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      cb(null, `product-${Date.now()}-${Math.random().toString(36).slice(2,8)}${ext}`);
    }
  }),
  limits: { fileSize: 5 * 1024 * 1024 }
});

app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(PUBLIC));

function adminOK(req) {
  const expectedUser = process.env.ADMIN_USERNAME || "admin";
  const expectedPass = process.env.ADMIN_PASSWORD || "change-this-password";
  return req.headers["x-admin-user"] === expectedUser &&
         req.headers["x-admin-pass"] === expectedPass;
}
function requireAdmin(req, res, next) {
  if (!adminOK(req)) return res.status(401).json({ error: "Admin authentication required." });
  next();
}
function cleanProduct(p) {
  return {
    ...p,
    sizes: p.sizes ? p.sizes.split(",").map(s => s.trim()).filter(Boolean) : [],
    featured: !!p.featured
  };
}

app.get("/api/products", (req,res) => {
  const rows = db.prepare("SELECT * FROM products ORDER BY featured DESC, id DESC").all();
  res.json(rows.map(cleanProduct));
});

app.get("/api/products/:id", (req,res) => {
  const p = db.prepare("SELECT * FROM products WHERE id=?").get(req.params.id);
  if (!p) return res.status(404).json({error:"Product not found"});
  res.json(cleanProduct(p));
});

app.post("/api/orders", (req,res) => {
  const { customer, items, utr } = req.body || {};
  if (!customer || !items || !items.length || !utr) {
    return res.status(400).json({error:"Customer details, cart items and UTR are required."});
  }
  if (!customer.name || !customer.phone || !customer.address || !customer.city || !customer.pincode) {
    return res.status(400).json({error:"Please complete all required delivery details."});
  }

  let subtotal = 0;
  const normalized = [];
  const tx = db.transaction(() => {
    for (const item of items) {
      const p = db.prepare("SELECT * FROM products WHERE id=?").get(item.id);
      if (!p) throw new Error(`Product ${item.id} no longer exists.`);
      const qty = Math.max(1, Math.floor(Number(item.qty) || 1));
      if (qty > p.stock) throw new Error(`${p.name}: only ${p.stock} left in stock.`);
      const price = Number(p.price);
      subtotal += price * qty;
      normalized.push({
        id: p.id, name: p.name, price, qty, size: item.size || "", image: p.image || ""
      });
    }
    const orderNo = "DJR" + Date.now().toString().slice(-8) + Math.random().toString(36).slice(2,5).toUpperCase();
    const stmt = db.prepare(`
      INSERT INTO orders
      (order_no, customer_name, phone, email, address, city, pincode, items, subtotal, total, utr, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      orderNo, customer.name, customer.phone, customer.email || "",
      customer.address, customer.city, customer.pincode,
      JSON.stringify(normalized), subtotal, subtotal, String(utr).trim(), "Payment Submitted"
    );
    for (const item of normalized) {
      db.prepare("UPDATE products SET stock=stock-? WHERE id=?").run(item.qty, item.id);
    }
    return orderNo;
  });

  try {
    const orderNo = tx();
    res.json({success:true, orderNo});
  } catch (e) {
    res.status(400).json({error:e.message});
  }
});

app.get("/api/orders/:orderNo", (req,res) => {
  const o = db.prepare("SELECT * FROM orders WHERE order_no=?").get(req.params.orderNo);
  if (!o) return res.status(404).json({error:"Order not found"});
  res.json({...o, items: JSON.parse(o.items)});
});

app.post("/api/admin/login", (req,res) => {
  const u = req.body.username;
  const p = req.body.password;
  const expectedUser = process.env.ADMIN_USERNAME || "admin";
  const expectedPass = process.env.ADMIN_PASSWORD || "change-this-password";
  if (u === expectedUser && p === expectedPass) return res.json({success:true});
  res.status(401).json({error:"Invalid admin login"});
});

app.get("/api/admin/orders", requireAdmin, (req,res) => {
  const orders = db.prepare("SELECT * FROM orders ORDER BY id DESC").all()
    .map(o => ({...o, items: JSON.parse(o.items)}));
  res.json(orders);
});

app.patch("/api/admin/orders/:id", requireAdmin, (req,res) => {
  const allowed = ["Payment Submitted","Payment Verified","Packed","Shipped","Delivered","Cancelled"];
  const status = String(req.body.status || "");
  if (!allowed.includes(status)) return res.status(400).json({error:"Invalid status"});
  db.prepare("UPDATE orders SET status=? WHERE id=?").run(status, req.params.id);
  res.json({success:true});
});

app.post("/api/admin/products", requireAdmin, upload.single("image"), (req,res) => {
  const b = req.body;
  if (!b.name || !b.category || b.price === undefined) return res.status(400).json({error:"Name, category and price are required."});
  const image = req.file ? "/uploads/" + req.file.filename : (b.image || "");
  const info = db.prepare(`
    INSERT INTO products (name,category,price,mrp,discount,sizes,stock,image,description,featured)
    VALUES (?,?,?,?,?,?,?,?,?,?)
  `).run(
    b.name, b.category, Number(b.price), Number(b.mrp || b.price),
    Number(b.discount || 0), b.sizes || "", Number(b.stock || 0),
    image, b.description || "", b.featured ? 1 : 0
  );
  res.json({success:true, id:info.lastInsertRowid});
});

app.put("/api/admin/products/:id", requireAdmin, upload.single("image"), (req,res) => {
  const old = db.prepare("SELECT * FROM products WHERE id=?").get(req.params.id);
  if (!old) return res.status(404).json({error:"Product not found"});
  const b = req.body;
  const image = req.file ? "/uploads/" + req.file.filename : (b.image ?? old.image);
  db.prepare(`
    UPDATE products SET name=?,category=?,price=?,mrp=?,discount=?,sizes=?,stock=?,image=?,description=?,featured=?
    WHERE id=?
  `).run(
    b.name, b.category, Number(b.price), Number(b.mrp || b.price),
    Number(b.discount || 0), b.sizes || "", Number(b.stock || 0),
    image, b.description || "", b.featured ? 1 : 0, req.params.id
  );
  res.json({success:true});
});

app.delete("/api/admin/products/:id", requireAdmin, (req,res) => {
  db.prepare("DELETE FROM products WHERE id=?").run(req.params.id);
  res.json({success:true});
});

app.get("/api/admin/stats", requireAdmin, (req,res) => {
  const productCount = db.prepare("SELECT COUNT(*) c FROM products").get().c;
  const orderCount = db.prepare("SELECT COUNT(*) c FROM orders").get().c;
  const sales = db.prepare("SELECT COALESCE(SUM(total),0) total FROM orders WHERE status != 'Cancelled'").get().total;
  const pending = db.prepare("SELECT COUNT(*) c FROM orders WHERE status IN ('Payment Submitted','Payment Verified','Packed','Shipped')").get().c;
  res.json({productCount, orderCount, sales, pending});
});

app.get("/api/store", (req,res) => {
  res.json({
    name: process.env.STORE_NAME || "d.jr Football Store",
    payment: { type: "UPI QR", qr: "/payment-qr.png", onlineOnly: true }
  });
});

app.get("*", (req,res) => {
  res.sendFile(path.join(PUBLIC, "index.html"));
});

app.listen(PORT, () => console.log(`d.jr Football Store running on port ${PORT}`));
