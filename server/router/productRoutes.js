import express from "express";
import { 
    createProduct, 
    fetchAllProducts,
    updateProduct,
    deleteProduct,
    fetchSingleProduct,
    postProductReview,
    deleteReview,
    fetchAIFilteredProducts  
} from "../controllers/productController.js";
import { isAuthenticated, authorizedRoles } from "../middlewares/authMiddleware.js";

const router = express.Router();

// Public product routes
router.get("/", fetchAllProducts);
router.post("/ai-search", fetchAIFilteredProducts);
router.get("/singleProduct/:productId", fetchSingleProduct);

// Admin product management
router.post("/admin/create", isAuthenticated, authorizedRoles("Admin"), createProduct);
router.put("/admin/update/:productId", isAuthenticated, authorizedRoles("Admin"), updateProduct);
router.delete("/admin/delete/:productId", isAuthenticated, authorizedRoles("Admin"), deleteProduct);

// Product reviews
router.put("/post-new/review/:productId", isAuthenticated, postProductReview);
router.delete("/delete/review/:productId", isAuthenticated, deleteReview);

export default router;

