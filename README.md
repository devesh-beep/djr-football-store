# d.jr Football Store — full-stack starter

This is a real Node.js + Express + SQLite football store, not just a static HTML mockup.

## Included

### Customer side
- Home page and product catalogue
- Search and category filters
- Product detail modal
- Size selection
- Shopping cart
- Online-only checkout
- Your supplied UPI QR code
- Customer details + UTR/transaction reference
- Order creation and order number
- Order tracking page
- Mobile responsive layout

### Admin side
Open `/admin.html`
- Admin login
- Add/edit/delete products
- Upload product images
- Change price, discount, stock and sizes
- View orders
- Update order status
- Simple sales summary

## Run locally

1. Install Node.js 18+.
2. Open a terminal in this folder.
3. Run:
   `npm install`
4. Copy `.env.example` to `.env` and change the admin password.
5. Run:
   `npm start`
6. Open:
   `http://localhost:3000`

Admin:
`http://localhost:3000/admin.html`

Default demo login from .env.example:
- username: admin
- password: change-this-password

## Important payment note

The supplied QR is used for UPI payment. Customers scan it, complete payment in their UPI app, and enter their UTR/transaction reference before placing the order.

This does NOT automatically verify that a payment reached your bank account. For automatic payment verification and a true gateway-style checkout, connect a payment gateway such as Razorpay later. The server-side order structure is ready for that upgrade.

## Deployment

For a public store, deploy the Node.js app on a Node-compatible host and use persistent storage for the SQLite database/uploads. For production, also add HTTPS, a strong admin password, automated payment verification, backups, and a proper domain.
