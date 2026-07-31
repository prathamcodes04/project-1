import express from "express";
import { 
    createProduct, 
    fetchAllProducts,
    updateProduct,
    deleteProduct,
    fetchSingleProduct,
    postProductReview,
    deleteReview,
    fetchAllFilteredProducts  
} from "../controllers/productController.js";
import { isAuthenticated, authorizedRoles } from "../middlewares/authMiddleware.js";

const router = express.Router();

// Public product routes
router.get("/", fetchAllProducts);
router.get("/filter", fetchAllFilteredProducts);
router.get("/:id", fetchSingleProduct);

// Admin product management
router.post("/admin/create", isAuthenticated, authorizedRoles("Admin"), createProduct);
router.put("/:id", isAuthenticated, authorizedRoles("Admin"), updateProduct);
router.delete("/:id", isAuthenticated, authorizedRoles("Admin"), deleteProduct);

// Product reviews
router.put("/review", isAuthenticated, postProductReview);
router.delete("/review", isAuthenticated, deleteReview);

export default router;

