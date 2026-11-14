const express = require("express");
const router = express.Router();

const contactController = require("../controllers/contact_us.controller");
const optionalAuth = require("../middlewares/optionalAuth.middleware");

// Submit Contact Us form
router.post("/", optionalAuth, contactController.submitContactMessage);

module.exports = router;