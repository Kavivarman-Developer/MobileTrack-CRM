# Retail Inventory & Billing App

Commercial-grade MVP scaffold for a retail/shop inventory and billing workflow.

## Structure

- `mobile` - Expo React Native app with TypeScript, React Navigation, Redux Toolkit, React Query, Axios, form validation, and charting.
- `backend` - Node.js, Express, MongoDB/Mongoose API with JWT auth, inventory, sales, customers, dashboard aggregation, Socket.IO, and Cloudinary config.

## Backend Setup

1. Copy `backend/.env.example` to `backend/.env`.
2. Set `MONGO_URI`, `JWT_SECRET`, and `JWT_REFRESH_SECRET`.
3. Start MongoDB locally or point `MONGO_URI` at MongoDB Atlas.
4. Seed test data:

```bash
cd backend
npm run seed
```

Seed login:

```text
admin@example.com
password123
```

Run the API:

```bash
cd backend
npm run dev
```

Health check: `http://localhost:5000/health`

## Mobile Setup

For Android emulator, `localhost` usually works through Expo web but a phone on Expo Go needs your computer LAN IP.

```bash
cd mobile
npm start
```

To point the app at another API URL:

```bash
set EXPO_PUBLIC_API_URL=http://YOUR_LAN_IP:5000/api
npm start
```

PowerShell:

```powershell
$env:EXPO_PUBLIC_API_URL="http://YOUR_LAN_IP:5000/api"
npm start
```

## Implemented MVP Flow

- Login connected to `/api/auth/login`.
- Protected inventory CRUD APIs and product list/add/edit/delete UI.
- Sales invoice UI that selects products, builds a cart, saves an order, calculates totals, and decrements stock.
- Customer add/list API and UI.
- Dashboard aggregation for product count, sales totals, today profit, low stock count, low stock list, and monthly chart.
- Loading, empty, and basic error states on primary screens.

## Phase 2 Not Included

Barcode scanning, supplier purchases, expense UI, advanced reports, push notifications, and offline sync are intentionally out of scope for this MVP.
