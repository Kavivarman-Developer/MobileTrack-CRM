# Migration Fix Report

## Issue

Running `node scripts\migrateToMultiTenant.js` failed with an `E11000 duplicate key` error on the `products` collection.

The failing index was:

```text
organizationId_1_barcode_1
```

MongoDB rejected the migration because multiple existing products had `barcode: null`. After those products were assigned the same `organizationId`, the old unique compound index treated them as duplicate values.

## Root Cause

The product model had unique indexes for `sku` and `barcode` per organization, but the index definition did not safely exclude empty or missing values.

This caused duplicate key errors when multiple products had:

```js
barcode: null
sku: null
sku: ""
barcode: ""
```

## Files Changed

### `backend/models/Product.js`

Updated the `sku` and `barcode` indexes to use partial unique indexes.

Final index definitions:

```js
productSchema.index(
  { organizationId: 1, sku: 1 },
  { unique: true, partialFilterExpression: { sku: { $type: "string", $gt: "" } } }
);

productSchema.index(
  { organizationId: 1, barcode: 1 },
  { unique: true, partialFilterExpression: { barcode: { $type: "string", $gt: "" } } }
);
```

Note: `$gt: ""` was used instead of `$ne: ""` because MongoDB rejected `$ne` in the partial index expression.

### `backend/scripts/migrateToMultiTenant.js`

Moved product index cleanup to the start of the migration, immediately after database connection.

Indexes dropped before migration updates:

```js
await Product.collection.dropIndex("organizationId_1_barcode_1").catch(() => {});
await Product.collection.dropIndex("organizationId_1_sku_1").catch(() => {});
await Product.collection.dropIndex("sku_1").catch(() => {});
await Product.collection.dropIndex("barcode_1").catch(() => {});
```

At the end of the migration, `Product.syncIndexes()` recreates the corrected indexes from the updated schema.

## Verification

The migration was rerun successfully:

```text
MongoDB connected
Migration complete {
  organizationId: '6a6d8d146291d2b222410b26',
  ownerEmail: 'kavin@gmail.com',
  updated: {
    products: 0,
    orders: 0,
    orderItems: 0,
    customers: 0,
    expenses: 0,
    vendors: 0,
    purchaseOrders: 0,
    inventoryAdjustments: 0,
    stockMovements: 0
  }
}
```

The `0` update counts are expected because the earlier partial migration had already assigned tenant fields to the records.

Live MongoDB indexes were also checked and confirmed:

```json
[
  {
    "name": "organizationId_1_sku_1",
    "unique": true,
    "partialFilterExpression": {
      "sku": {
        "$type": "string",
        "$gt": ""
      }
    }
  },
  {
    "name": "organizationId_1_barcode_1",
    "unique": true,
    "partialFilterExpression": {
      "barcode": {
        "$type": "string",
        "$gt": ""
      }
    }
  }
]
```

## Result

The migration now completes without the `E11000 duplicate key` error.

`sku` and `barcode` remain unique per organization when real values are provided, while null, missing, or empty values no longer block migration.
