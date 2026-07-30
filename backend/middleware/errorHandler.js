function notFound(req, res, next) {
  res.status(404);
  next(new Error(`Route not found: ${req.originalUrl}`));
}

function errorHandler(error, req, res, next) {
  const status = res.statusCode === 200 ? 500 : res.statusCode;
  res.status(status).json({ message: error.message || "Server error" });
}

module.exports = { notFound, errorHandler };
