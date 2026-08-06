import express from "express";
import { dashboardStats, deleteUser, getAllUsers } from "../controllers/adminController.js";
import { authorizedRoles, isAuthenticated } from "../middlewares/authMiddleware.js";

const router = express.Router();

router.get("/getallusers", isAuthenticated, authorizedRoles("Admin"), getAllUsers); //dashboard
router.delete("/deleteUser/:id", isAuthenticated, authorizedRoles("Admin"), deleteUser); //delete user
router.get("/fetch/dashboard-stats", isAuthenticated, authorizedRoles("Admin"), dashboardStats); //dashboard stats

export default router;