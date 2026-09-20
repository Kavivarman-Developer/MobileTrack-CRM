# 🛍️ Kadai Kanakku · Smart Cloud POS & Retail Management
## Complete Enterprise System Architecture & Client Technical Dossier

---

> [!NOTE]
> **Document Purpose:** This technical dossier provides an end-to-end overview of the **Kadai Kanakku** platform, detailing its core business modules, technical workflows, Google Cloud Platform (GCP) infrastructure, third-party integrations, and security frameworks for client presentation and enterprise evaluation.

---

## 📑 Executive Summary

**Kadai Kanakku** (கடை கணக்கு) is a high-performance, multi-tenant cloud Retail POS (Point of Sale), inventory automation, and store management platform designed for modern Indian retail enterprises, supermarkets, grocery chains, electronics outlets, and departmental stores. 

It provides instant sub-second barcode billing, live stock synchronization across devices, automated GST invoicing, customer khata credit tracking, supplier call logging, and profit-and-loss business intelligence.

---

## 🏗️ 1. End-to-End Enterprise Architecture

```mermaid
flowchart TD
    subgraph Clients["📱 Client Touchpoints (Web & Mobile)"]
        MobileApp["📱 Mobile POS / Web App\n(Smartphones & Tablets)"]
        DesktopPOS["💻 Desktop POS Terminal\n(Laptops & PCs)"]
        StoreFront["🛒 Online Storefront Catalog\n(Customer Self-Order)"]
    end

    subgraph CDN["⚡ Global Edge Acceleration (Google Cloud)"]
        FirebaseCDN["🌐 Firebase Hosting CDN Edge\n(app.kadaikanakku.in)"]
        SSL["🔒 SSL 256-Bit Encrypted Tunnel"]
    end

    subgraph AuthSecurity["🔐 Identity & Access Layer"]
        FirebaseAuth["🔥 Firebase Authentication Engine\n(Phone SMS OTP / Google OAuth)"]
        Recaptcha["🛡️ Invisible Google Recaptcha v3"]
        JWT["🔑 JWT Role-Based Token Gateway\n(15-Min Access + Refresh Tokens)"]
    end

    subgraph CoreBackend["⚙️ Cloud Microservices (Google Cloud Run)"]
        APIServer["☁️ Express.js REST API Microservice\n(Region: Mumbai asia-south1)"]
        SocketEngine["⚡ Socket.IO Real-time Engine\n(Tenant Room Isolation: org:id)"]
        ReportWorker["📊 Automated PDF & Excel Report Generator"]
    end

    subgraph DataLayer["🗄️ Storage & Database Layer"]
        MongoDB[("🍃 High-Availability Database\n(Cluster: retail_inventory / 19 Collections)")]
        CloudStorage["🪣 Google Cloud Storage Bucket\n(kadaikanakku.firebasestorage.app)"]
    end

    subgraph Integrations["🔌 Business Integrations"]
        UPI["💳 Dynamic UPI Payment QR (NPCI)"]
        BarcodeScan["📷 Barcode & Camera Scanner Engine"]
        Landing["🌍 Marketing & Web Portal (kadaikanakku.in)"]
    end

    Clients --> SSL
    SSL --> FirebaseCDN
    FirebaseCDN --> FirebaseAuth
    FirebaseAuth --> Recaptcha
    FirebaseCDN --> APIServer

    APIServer --> JWT
    APIServer <--> SocketEngine
    APIServer --> ReportWorker

    JWT --> MongoDB
    APIServer --> CloudStorage

    APIServer --> UPI
    Clients --> BarcodeScan
    Landing -.-> FirebaseCDN
```

---

## 💼 2. Core Business Features & How the App Works

```mermaid
flowchart LR
    subgraph Flow1["1. Procurement"]
        A["Vendor Setup"] --> B["Purchase Orders"]
        B --> C["Stock Receiving"]
    end

    subgraph Flow2["2. Inventory"]
        C --> D["Barcoded Catalog"]
        D --> E["Low-Stock Alerts"]
    end

    subgraph Flow3["3. Retail Billing"]
        D --> F["Instant Barcode Scan"]
        F --> G["GST & Discounts"]
        G --> H["UPI QR / Cash Payment"]
    end

    subgraph Flow4["4. Ledger & Accounts"]
        H --> I["Customer Khata Balance"]
        H --> J["Expense Tracking"]
        I & J --> K["Daily Profit Analytics"]
    end
```

### 📦 Detailed Module Capabilities

| Module | Core Functionality | Business Impact |
| :--- | :--- | :--- |
| **🚀 Instant POS Billing** | • Sub-second barcode search & camera scanner.<br>• Custom discount percentages and multi-tier tax calculation.<br>• Instant thermal bill printing and digital receipt sharing. | Cuts counter billing wait time by **65%**. |
| **📦 Smart Inventory Management** | • Real-time stock decrement upon sale.<br>• Automated low-stock thresholds and restock reminders.<br>• Stock audit logs and manual adjustment tracking. | Eliminates out-of-stock and over-purchasing losses. |
| **📒 Customer Khata (Credit Ledger)** | • Complete record of customer credit and repayments.<br>• Instant balance lookups and overdue reminders.<br>• Customer transaction statement exports. | Recovers outstanding credit **2x faster**. |
| **🤝 Supplier & Vendor Procurement** | • Supplier purchase order generation.<br>• Receiving workflows that automatically increment stock.<br>• Vendor call and contact management logs. | Seamless vendor tracking without manual registers. |
| **💸 Shop Expense Tracking** | • Category-wise expense logging (Rent, Electricity, Salaries, Misc).<br>• Daily, monthly, and yearly operational cost totals. | Clear visibility into operational overheads. |
| **📈 Profit & Tax Reports** | • Gross vs. Net Profit analytics.<br>• Downloadable PDF invoices and Excel tax sheets. | 1-Click GST and accountant audit readiness. |

---

## ☁️ 3. Google Cloud Platform (GCP) Infrastructure Breakdown

The entire platform is architected natively on **Google Cloud Platform (GCP)** to ensure 99.99% uptime, sub-30ms latency in India, and infinite automatic scaling.

```mermaid
graph TD
    subgraph GCP["Google Cloud Platform (Mumbai Region asia-south1)"]
        GCR["🚀 Google Cloud Run\n(Auto-Scaling API Container)"]
        GCS["🪣 Google Cloud Storage\n(Media, Invoices & Assets)"]
        GAR["📦 Google Artifact Registry\n(Docker Production Builds)"]
        GCL["📑 Google Cloud Logging & Monitoring\n(Realtime Telemetry & Health)"]
    end

    subgraph FirebaseGCP["Firebase on GCP Infrastructure"]
        FBH["🌐 Firebase Hosting CDN Edge"]
        FBA["🔐 Firebase Identity & Auth Gateway"]
    end

    FBH --> GCR
    FBA --> GCR
    GCR --> GCS
    GCR --> GAR
    GCR --> GCL
```

### 🛠️ Infrastructure Component Matrix

| Infrastructure Layer | Google Cloud Component | Technical Specs & Role |
| :--- | :--- | :--- |
| **Frontend CDN** | **Google Firebase Hosting** | Global multi-region edge caching with automated HTTP/2 and 256-bit SSL certificate provisioning. |
| **Backend Compute** | **Google Cloud Run** | Serverless microservice running in **Mumbai (`asia-south1`)** with automatic zero-to-twenty instance autoscaling. |
| **Media Storage** | **Google Cloud Storage (Firebase)** | High-durability object storage (`kadaikanakku.firebasestorage.app`) for product photos, receipts, and invoice PDFs. |
| **Identity & Security** | **Google Firebase Auth + IAM** | Telecom-grade SMS OTP routing with invisible reCAPTCHA anti-bot protection and Google OAuth 2.0. |
| **Container Registry** | **Google Artifact Registry** | Secure Docker image repository (`asia-south1-docker.pkg.dev`) storing immutable production releases. |
| **Telemetry & Auditing** | **Google Cloud Logging / Monitoring** | Centralized structured logging, error analytics, and latency tracking. |

---

## 🔌 4. Integrations & Protocols

```mermaid
flowchart LR
    App["Kadai Kanakku Engine"]

    App <-->|Realtime Multi-Device Sync| Socket["⚡ WebSockets (Socket.IO)"]
    App <-->|1-Click Counter Payment| UPI["💳 NPCI Dynamic UPI QR"]
    App <-->|Hardware & Camera Optical Scan| Barcode["📷 Expo Barcode Engine"]
    App <-->|Instant Phone Auth| SMS["📲 Firebase Telecom SMS Gateway"]
    App <-->|Tax & Accounting Sheets| Export["📊 PDF & Excel Report Generator"]
```

1. **💳 Dynamic UPI Payments:** Instant generation of UPI QR codes on checkout counters linked to the shop merchant ID (`@okaxis`), enabling cashless payments with automatic verification.
2. **⚡ Real-Time Multi-Terminal Sync:** Powered by Socket.IO, enabling real-time stock updates across multiple cash registers, phone apps, and inventory terminals simultaneously.
3. **📷 Hardware & Camera Barcode Scanning:** Integrated with device cameras and Bluetooth/USB laser barcode scanners for rapid checkout.
4. **📊 Dual Report Exporter:** Direct server-side streaming of structured financial reports into **PDF format** (for printing) and **Excel `.xlsx`** (for accountant filing).

---

## 🔒 5. Enterprise Security & Multi-Tenant Data Isolation

> [!IMPORTANT]
> **Tenant Isolation Guarantee:** Every merchant store operates inside a dedicated cryptographic organization scope (`org:<organizationId>`). Cross-tenant data leaks are physically blocked at the database query and WebSocket room layers.

```mermaid
sequenceDiagram
    autonumber
    actor Merchant as Store Cashier / Owner
    participant App as Kadai Kanakku App
    participant Auth as Google Auth & Firebase
    participant API as GCP Cloud Run API
    participant DB as Isolated Database

    Merchant->>App: Enter Mobile Number
    App->>Auth: Request SMS OTP (with Recaptcha)
    Auth-->>Merchant: 6-Digit Verification Code
    Merchant->>App: Enter OTP Code
    App->>Auth: Verify Code & Obtain ID Token
    App->>API: Exchange Token for 15-Min JWT Session
    API->>DB: Validate User & Extract Organization Scope
    API-->>App: Return Encrypted Bearer Token
    App->>API: Request POS Data (with Bearer Token)
    API->>DB: Query restricted to `org: organizationId`
    DB-->>API: Return Shop Data
    API-->>App: Render Store Dashboard
```

1. **Authentication Security:**
   - Stateless 15-minute JWT session tokens paired with secure HTTP-only refresh tokens.
   - Brute-force rate limiting enforced by `express-rate-limit` on all authentication endpoints.
2. **Data Protection:**
   - All network traffic forced over TLS 1.3 / HTTPS.
   - Passwords hashed using salted `bcrypt` algorithms.
   - Bank-grade database security with restricted IP whitelisting and encrypted connections.

---

## 📋 6. Production URLs & Verification Matrix

| Service | Target Domain / Live URL | Infrastructure Layer | SLA / Health |
| :--- | :--- | :--- | :--- |
| **Merchant POS Web App** | [https://app.kadaikanakku.in/](https://app.kadaikanakku.in/) | Firebase Hosting CDN + Web App | **Live (200 OK)** |
| **Default Global CDN** | [https://app-kadaikanakku.web.app/](https://app-kadaikanakku.web.app/) | Firebase Default CDN URL | **Live (200 OK)** |
| **Backend REST API** | `https://kadaikanakku-api-775937258064.asia-south1.run.app` | Google Cloud Run (Mumbai `asia-south1`) | **Live (200 OK)** |
| **Public Portal & Landing** | [https://kadaikanakku.in/](https://kadaikanakku.in/) | Google Cloud Run + Firebase Edge | **Live (200 OK)** |
| **Cloud File Storage** | `gs://kadaikanakku.firebasestorage.app` | Google Cloud Storage Bucket | **Live (200 OK)** |

---

*© 2026 Kadai Kanakku. All Rights Reserved. Engineered for High-Reliability Retail Cloud Operations.*
