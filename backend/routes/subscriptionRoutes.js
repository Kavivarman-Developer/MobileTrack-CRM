const express = require('express');
const { auth } = require('../middleware/auth');
const { tenantScope } = require('../middleware/tenantScope');
const {
  createActivationOrder,
  verifyActivation,
  getSubscriptionStatus,
  renderCheckoutPage,
} = require('../controllers/subscriptionController');

const router = express.Router();

router.get('/checkout/:orderId', renderCheckoutPage);

router.use(auth);
router.use(tenantScope);

router.get('/status', getSubscriptionStatus);
router.post('/create-activation-order', createActivationOrder);
router.post('/verify-activation', verifyActivation);

module.exports = router;
