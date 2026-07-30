const Brand = require("../models/Brand");
const Category = require("../models/Category");
const Product = require("../models/Product");

function absoluteUploadUrl(req, path) {
  return `${req.protocol}://${req.get("host")}${path}`;
}

async function listProducts(req, res, next) {
  try {
    const { search, category } = req.query;
    const query = {};
    if (search) query.$or = [{ name: new RegExp(search, "i") }, { sku: new RegExp(search, "i") }];
    if (category) query.category = category;
    const products = await Product.find(query).populate("category brand").sort({ createdAt: -1 });
    res.json(products);
  } catch (error) {
    next(error);
  }
}

async function createProduct(req, res, next) {
  try {
    const product = await Product.create(req.body);
    req.app.get("io")?.emit("inventory:changed", product);
    res.status(201).json(await product.populate("category brand"));
  } catch (error) {
    next(error);
  }
}

async function uploadProductImage(req, res, next) {
  try {
    if (!req.file) return res.status(400).json({ message: "Image file is required" });
    const imageUrl = absoluteUploadUrl(req, `/uploads/${req.file.filename}`);
    const product = await Product.findByIdAndUpdate(
      req.params.id,
      { $push: { images: imageUrl } },
      { returnDocument: "after" }
    ).populate("category brand");
    if (!product) return res.status(404).json({ message: "Product not found" });
    req.app.get("io")?.emit("inventory:changed", product);
    res.status(201).json({ imageUrl, product });
  } catch (error) {
    next(error);
  }
}

async function getProduct(req, res, next) {
  try {
    const product = await Product.findById(req.params.id).populate("category brand");
    if (!product) return res.status(404).json({ message: "Product not found" });
    res.json(product);
  } catch (error) {
    next(error);
  }
}

async function updateProduct(req, res, next) {
  try {
    const product = await Product.findByIdAndUpdate(req.params.id, req.body, { returnDocument: "after" }).populate("category brand");
    if (!product) return res.status(404).json({ message: "Product not found" });
    req.app.get("io")?.emit("inventory:changed", product);
    res.json(product);
  } catch (error) {
    next(error);
  }
}

async function deleteProduct(req, res, next) {
  try {
    const product = await Product.findByIdAndDelete(req.params.id);
    if (!product) return res.status(404).json({ message: "Product not found" });
    req.app.get("io")?.emit("inventory:changed", { id: req.params.id });
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
  getProduct,
  updateProduct,
  deleteProduct,
  listCategories,
  createCategory,
  listBrands,
  createBrand,
};
