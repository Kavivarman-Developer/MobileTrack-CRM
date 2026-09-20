const path = require("path");
const crypto = require("crypto");
const { storage } = require("./firebase");

const PRODUCT_IMAGE_FOLDER = "mobitrack-crm";

async function uploadImageFile(localFilePath, originalName) {
  const bucket = storage().bucket();
  const ext = path.extname(originalName || localFilePath) || ".jpg";
  const destination = `${PRODUCT_IMAGE_FOLDER}/${Date.now()}-${crypto.randomBytes(8).toString("hex")}${ext}`;

  await bucket.upload(localFilePath, {
    destination,
    metadata: { cacheControl: "public, max-age=31536000" },
  });
  const file = bucket.file(destination);
  await file.makePublic();
  return `https://storage.googleapis.com/${bucket.name}/${destination}`;
}

module.exports = { uploadImageFile };
