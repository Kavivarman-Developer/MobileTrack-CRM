const express = require("express");
const multer = require("multer");
const path = require("path");
const {
  createBrand,
  createCategory,
  createProduct,
  deleteProduct,
  getProduct,
  listBrands,
  listCategories,
  listProducts,
  uploadProductImage,
  updateProduct,
} = require("../controllers/inventoryController");
const { protect } = require("../middleware/auth");

const router = express.Router();
const storage = multer.diskStorage({
  destination: "uploads/",
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || "");
    cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`);
  },
});
const upload = multer({ storage });

router.use(protect);
router.route("/products").get(listProducts).post(createProduct);
router.route("/products/:id").get(getProduct).put(updateProduct).delete(deleteProduct);
router.post("/products/:id/images", upload.single("image"), uploadProductImage);
router.route("/categories").get(listCategories).post(createCategory);
router.route("/brands").get(listBrands).post(createBrand);

module.exports = router;
