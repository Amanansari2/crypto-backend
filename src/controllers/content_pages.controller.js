
const sequelize = require("../config/db");
const { QueryTypes } = require("sequelize");

// GET /api/content-pages
// Returns all published content pages.
exports.getAllContentPages = async (req, res) => {
  try {
    const pages = await sequelize.query(
      `SELECT id, slug, title, description, status,
              created_at, updated_at
       FROM content_pages
       ORDER BY id ASC`,
       { type: QueryTypes.SELECT }
      );
      //  WHERE status = 'published'

    return res.status(200).json({
      success: true,
      count: pages.length,
      data: pages
    });
  } catch (error) {
    console.error("Get content pages error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to fetch content pages"
    });
  }
};

// GET /api/content-pages/:slug
// Returns one published page and its complete content.
exports.getContentPageBySlug = async (req, res) => {
  try {
    const { slug } = req.params;

    const pages = await sequelize.query(
      `SELECT id, slug, title, description, status,
          created_at, updated_at
   FROM content_pages
   WHERE slug = :slug
   LIMIT 1`,
      {
        replacements: { slug }, 
        type: QueryTypes.SELECT
      }
    );

    if (pages.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Page not found"
      });
    }

    const page = pages[0];

    // FAQ page: return categories and their questions.
    if (page.slug === "faq") {
      const categories = await sequelize.query(
        `SELECT id, category, sort_order
         FROM faq_categories
         WHERE page_id = :pageId
         ORDER BY sort_order ASC, id ASC`,
        {
          replacements: { pageId: page.id },
          type: QueryTypes.SELECT
        }
      );

      const faqs = await sequelize.query(
        `SELECT f.id, f.category_id, f.question,
                f.answer, f.sort_order
         FROM faqs f
         INNER JOIN faq_categories c
           ON c.id = f.category_id
         WHERE c.page_id = :pageId
           AND f.is_active = 1
         ORDER BY c.sort_order ASC,
                  f.sort_order ASC, f.id ASC`,
        {
          replacements: { pageId: page.id },
          type: QueryTypes.SELECT
        }
      );

      const faqData = categories.map((category) => ({
        id: category.id,
        category: category.category,
        questions: faqs
          .filter((faq) => faq.category_id === category.id)
          .map((faq) => ({
            id: faq.id,
            question: faq.question,
            answer: faq.answer
          }))
      }));

      return res.status(200).json({
        success: true,
        data: {
          ...page,
          categories: faqData
        }
      });
    }

    // All other pages: return ordered sections and content blocks.
    const sections = await sequelize.query(
  `SELECT id, eyebrow, title, icon_name, section_order, flutter_icon
   FROM content_sections
   WHERE page_id = :pageId
   ORDER BY section_order ASC, id ASC`,
  {
    replacements: { pageId: page.id },
    type: QueryTypes.SELECT
  }
);  

   const blocks = await sequelize.query(
  `SELECT b.id, b.section_id, b.block_type,
          b.content, b.icon_name, b.block_order
   FROM content_blocks b
   INNER JOIN content_sections s
     ON s.id = b.section_id
   WHERE s.page_id = :pageId
   ORDER BY s.section_order ASC,
            b.block_order ASC, b.id ASC`,
  {
    replacements: { pageId: page.id },
    type: QueryTypes.SELECT
  }
);

    const pageSections = sections.map((section) => ({
  id: section.id,
  eyebrow: section.eyebrow,
  title: section.title,
  icon_name: section.icon_name,
  flutter_icon: section.flutter_icon,
  section_order: section.section_order,

 blocks: blocks
  .filter((block) => block.section_id === section.id)
  .sort((a, b) => {
    // Sort by order first
    if (a.block_order !== b.block_order) {
      return a.block_order - b.block_order;
    }

    // If order is the same, show subheading first
    if (a.block_type === "subheading" && b.block_type === "text") {
      return -1;
    }

    if (a.block_type === "text" && b.block_type === "subheading") {
      return 1;
    }

    return a.id - b.id;
  })
  .map((block) => ({
    id: block.id,
    type: block.block_type,
    content: block.content,
    icon_name: block.icon_name,
    order: block.block_order
  }))
}));

    return res.status(200).json({
      success: true,
      data: {
        ...page,
        sections: pageSections
      }
    });
  } catch (error) {
    console.error("Get content page error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to fetch page content"
    });
  }
};
