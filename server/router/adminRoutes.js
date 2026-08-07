import express from "express";
import { dashboardStats, deleteUser, getAllUsers } from "../controllers/adminController.js";
import { authorizedRoles, isAuthenticated } from "../middlewares/authMiddleware.js";

const router = express.Router();

//dashboard
router.get("/getallusers", isAuthenticated, authorizedRoles("Admin"), getAllUsers);
//delete user
router.delete("/deleteUser/:id", isAuthenticated, authorizedRoles("Admin"), deleteUser);
//dashboard stats
router.get("/fetch/dashboard-stats", isAuthenticated, authorizedRoles("Admin"), dashboardStats); 

export default router;