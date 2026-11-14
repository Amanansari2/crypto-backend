
const express = require("express");
const router = express.Router();

const {
  getAllContentPages,
  getContentPageBySlug
} = require("../controllers/content_pages.controller");

// GET all published pages
router.get("/", getAllContentPages);

// GET one page by slug
router.get("/:slug", getContentPageBySlug);

module.exports = router;
 