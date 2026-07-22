// importing all tables
import { createUserTable } from "../models/userTable.js";
import { createOrdersTable } from "../models/ordersTable.js";
import { createShippingInfoTable } from "../models/shippingInfoTable.js";
import { createProductsTable } from "../models/productTable.js";
import { createProductReviewsTable } from "../models/productReviewsTable.js";
import { createPaymentsTable } from "../models/paymentsTable.js";
import { createOrderItemTable } from "../models/orderItemsTable.js";

export const createTables = async () => {
  try {
    await createUserTable();
    await createProductsTable();
    await createOrdersTable();
    await createShippingInfoTable();
    await createProductReviewsTable();
    await createPaymentsTable();
    await createOrderItemTable();
    console.log("All tables created successfully");
  } catch (err) {
    console.log("Error creating tables:", err);
  }
};
