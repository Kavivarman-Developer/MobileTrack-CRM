const fs = require("fs/promises");
const Brand = require("../models/Brand");
const Category = require("../models/Category");
const Product = require("../models/Product");
const StockMovement = require("../models/StockMovement");
const cloudinary = require("../config/cloudinary");
const { emitToOrg } = require("../utils/emitEvent");

const PRODUCT_IMAGE_FOLDER = "mobitrack-crm";

function isObjectId(value) {
  return typeof value === "string" && /^[a-f\d]{24}$/i.test(value);
}

function normalizeOptionalObjectId(value) {
  if (!value) return undefined;
  if (typeof value === "object" && value._id) return value._id;
  return isObjectId(value) ? value : undefined;
}

async function findOrCreateNamedModel(Model, value) {
  if (!value) return undefined;
  if (isObjectId(value)) return value;
  if (typeof value === "object" && value._id) return value._id;
  if (typeof value !== "string") return undefined;
  const name = value.trim();
  if (!name) return undefined;
  const doc = await Model.findOneAndUpdate({ name }, { name }, { upsert: true, returnDocument: "after" });
  return doc._id;
}

function scoped(req, extra = {}) {
  return req.orgId ? { ...extra, organizationId: req.orgId } : { ...extra, _id: null };
}

async function productPayload(body, orgId) {
  const payload = { ...body };
  if (orgId) payload.organizationId = orgId;
  ["name", "sku", "barcode", "category", "brand"].forEach((field) => {
    if (typeof payload[field] === "string") payload[field] = payload[field].trim();
  });
  if (payload.compatibleWith && !Array.isArray(payload.compatibleWith)) {
    payload.compatibleWith = [payload.compatibleWith];
  }
  if (Array.isArray(payload.compatibleWith)) {
    payload.compatibleWith = payload.compatibleWith.map(normalizeOptionalObjectId).filter(Boolean);
  }
  if (payload.type && payload.type !== "accessory") payload.compatibleWith = [];
  if (!payload.barcode) delete payload.barcode;
  const preferredVendor = normalizeOptionalObjectId(payload.preferredVendor);
  if (preferredVendor) payload.preferredVendor = preferredVendor;
  else delete payload.preferredVendor;
  payload.category = await findOrCreateNamedModel(Category, payload.category);
  payload.brand = await findOrCreateNamedModel(Brand, payload.brand);
  if (!payload.category) delete payload.category;
  if (!payload.brand) delete payload.brand;
  if (payload.sellingPrice !== undefined) payload.price = Number(payload.sellingPrice);
  if (payload.price !== undefined) payload.sellingPrice = Number(payload.price);
  if (payload.reorderPoint !== undefined) payload.lowStockThreshold = Number(payload.reorderPoint);
  if (payload.lowStockThreshold !== undefined) payload.reorderPoint = Number(payload.lowStockThreshold);
  return payload;
}

function sendProductError(error, res, next) {
  if (error.code === 11000) {
    const field = Object.keys(error.keyPattern || error.keyValue || {})[0] || "field";
    return res.status(409).json({ message: `${field.toUpperCase()} already exists` });
  }
  if (error.name === "ValidationError") {
    return res.status(400).json({ message: Object.values(error.errors).map((item) => item.message).join(", ") });
  }
  if (error.name === "CastError") {
    return res.status(400).json({ message: `Invalid ${error.path}` });
  }
  return next(error);
}

async function listProducts(req, res, next) {
  try {
    const { search, category } = req.query;
    const query = scoped(req);
    if (search) query.$or = [{ name: new RegExp(search, "i") }, { sku: new RegExp(search, "i") }];
    if (category) query.category = category;
    const products = await Product.find(query).populate("category brand preferredVendor").sort({ createdAt: -1 });
    res.json(products);
  } catch (error) {
    next(error);
  }
}

async function createProduct(req, res, next) {
  try {
    const product = await Product.create(await productPayload(req.body, req.orgId));
    const saved = await product.populate("category brand preferredVendor");
    emitToOrg(req, "product:updated", saved);
    res.status(201).json(saved);
  } catch (error) {
    sendProductError(error, res, next);
  }
}

async function uploadProductImage(req, res, next) {
  try {
    if (!req.file) return res.status(400).json({ message: "Image file is required" });
    const product = await Product.findOne(scoped(req, { _id: req.params.id })).populate("category brand preferredVendor");
    if (!product) return res.status(404).json({ message: "Product not found" });

    const result = await cloudinary.uploader.upload(req.file.path, {
      folder: PRODUCT_IMAGE_FOLDER,
      resource_type: "image",
    });
    const imageUrl = result.secure_url;
    product.images.push(imageUrl);
    await product.save();
    emitToOrg(req, "product:updated", product);
    res.status(201).json({ imageUrl, product });
  } catch (error) {
    next(error);
  } finally {
    if (req.file?.path) {
      await fs.unlink(req.file.path).catch(() => {});
    }
  }
}

async function getProduct(req, res, next) {
  try {
    const product = await Product.findOne(scoped(req, { _id: req.params.id })).populate("category brand preferredVendor");
    if (!product) return res.status(404).json({ message: "Product not found" });
    res.json(product);
  } catch (error) {
    next(error);
  }
}

async function updateProduct(req, res, next) {
  try {
    const product = await Product.findOneAndUpdate(scoped(req, { _id: req.params.id }), await productPayload(req.body, req.orgId), { returnDocument: "after" }).populate("category brand preferredVendor");
    if (!product) return res.status(404).json({ message: "Product not found" });
    emitToOrg(req, "product:updated", product);
    res.json(product);
  } catch (error) {
    sendProductError(error, res, next);
  }
}

async function getCompatibleAccessories(req, res, next) {
  try {
    const accessories = await Product.find(scoped(req, { type: "accessory", compatibleWith: req.params.id }))
      .populate("category brand preferredVendor")
      .sort({ name: 1 });
    res.json(accessories);
  } catch (error) {
    next(error);
  }
}

async function scanProduct(req, res, next) {
  try {
    const product = await Product.findOne(scoped(req, {
      $or: [{ sku: req.params.code }, { barcode: req.params.code }],
    })).populate("category brand preferredVendor");
    if (!product) return res.status(404).json({ message: "Product not found" });
    res.json(product);
  } catch (error) {
    next(error);
  }
}

async function restockProduct(req, res, next) {
  const session = await Product.startSession();
  try {
    const quantity = Number(req.body.quantity);
    if (!Number.isInteger(quantity) || quantity <= 0) {
      return res.status(400).json({ message: "Quantity must be a positive whole number" });
    }

    let product;
    await session.withTransaction(async () => {
      product = await Product.findOne(scoped(req, { _id: req.params.id })).session(session);
      if (!product) {
        const error = new Error("Product not found");
        error.statusCode = 404;
        throw error;
      }
      product.stockQty += quantity;
      await product.save({ session });
      await StockMovement.create([{
        product: product._id,
        organizationId: req.orgId,
        type: "IN",
        quantity,
        reason: "purchase",
        note: req.body.note,
        createdBy: req.user?._id,
      }], { session });
    });

    const saved = await Product.findOne(scoped(req, { _id: product._id })).populate("category brand preferredVendor");
    emitToOrg(req, "product:updated", saved);
    res.json(saved);
  } catch (error) {
    if (error.statusCode) return res.status(error.statusCode).json({ message: error.message });
    next(error);
  } finally {
    await session.endSession();
  }
}

async function listStockMovements(req, res, next) {
  try {
    const page = Math.max(Number(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100);
    const [items, total] = await Promise.all([
      StockMovement.find(scoped(req, { product: req.params.id }))
        .populate("createdBy", "name email")
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      StockMovement.countDocuments(scoped(req, { product: req.params.id })),
    ]);
    res.json({ items, page, limit, total, hasMore: page * limit < total });
  } catch (error) {
    next(error);
  }
}

function dateRange(query) {
  const createdAt = {};
  if (query.from) createdAt.$gte = new Date(query.from);
  if (query.to) {
    const end = new Date(query.to);
    end.setHours(23, 59, 59, 999);
    createdAt.$lte = end;
  }
  return Object.keys(createdAt).length ? { createdAt } : {};
}

async function getStockSummary(req, res, next) {
  try {
    const match = scoped(req, dateRange(req.query));
    const rows = await StockMovement.aggregate([
      { $match: match },
      {
        $group: {
          _id: "$product",
          totalIn: { $sum: { $cond: [{ $eq: ["$type", "IN"] }, "$quantity", 0] } },
          totalOut: { $sum: { $cond: [{ $eq: ["$type", "OUT"] }, "$quantity", 0] } },
        },
      },
    ]);
    const products = await Product.find(scoped(req, { _id: { $in: rows.map((row) => row._id) } })).select("name sku stockQty lowStockThreshold images");
    const byId = new Map(products.map((product) => [product._id.toString(), product]));
    res.json(rows.map((row) => ({
      product: byId.get(row._id.toString()),
      totalIn: row.totalIn,
      totalOut: row.totalOut,
      currentStock: byId.get(row._id.toString())?.stockQty || 0,
    })));
  } catch (error) {
    next(error);
  }
}

async function deleteProduct(req, res, next) {
  try {
    const product = await Product.findOneAndDelete(scoped(req, { _id: req.params.id }));
    if (!product) return res.status(404).json({ message: "Product not found" });
    emitToOrg(req, "product:updated", { id: req.params.id, deleted: true });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
}

async function listCategories(req, res, next) {
  try {
    res.json(await Category.find().sort("name"));
  } catch (error) {
    next(error);
  }
}

async function createCategory(req, res, next) {
  try {
    res.status(201).json(await Category.create(req.body));
  } catch (error) {
    next(error);
  }
}

async function listBrands(req, res, next) {
  try {
    res.json(await Brand.find().sort("name"));
  } catch (error) {
    next(error);
  }
}

async function createBrand(req, res, next) {
  try {
    res.status(201).json(await Brand.create(req.body));
  } catch (error) {
    next(error);
  }
}

module.exports = {
  listProducts,
  createProduct,
  uploadProductImage,
  getCompatibleAccessories,
  scanProduct,
  restockProduct,
  listStockMovements,
  getStockSummary,
  getProduct,
  updateProduct,
  deleteProduct,
  listCategories,
  createCategory,
  listBrands,
  createBrand,
};
