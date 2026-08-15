import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { axiosInstance } from "../../lib/axios";
import { toast } from "react-toastify";
import { toggleAIModal } from "./popupSlice";

// ========== Async Thunks ==========

// Fetch all products with filters
export const fetchAllProducts = createAsyncThunk(
  "product/fetchAll",
  async (
    {
      category = "",
      availability = "",
      price = "0-10000",
      ratings = "",
      search = "",
      page = 1,
    },
    thunkAPI,
  ) => {
    try {
      const params = new URLSearchParams();
      if (category) params.append("category", category);
      if (price) params.append("price", price);
      if (search) params.append("search", search);
      if (ratings) params.append("ratings", ratings);
      if (availability) params.append("availability", availability);
      if (page) params.append("page", page);

      const res = await axiosInstance.get(`/product?${params.toString()}`);
      return res.data;
    } catch (error) {
      return thunkAPI.rejectWithValue(
        error.response?.data?.message || "Failed to fetch products"
      );
    }
  }
);

// Fetch single product with reviews
export const fetchSingleProduct = createAsyncThunk(
  "product/fetchSingle",
  async (productId, thunkAPI) => {
    try {
      const res = await axiosInstance.get(`/product/singleProduct/${productId}`);
      return res.data.product;
    } catch (error) {
      return thunkAPI.rejectWithValue(
        error.response?.data?.message || "Failed to fetch product details"
      );
    }
  }
);

// Create product (Admin only)
export const createProduct = createAsyncThunk(
  "product/create",
  async (formData, thunkAPI) => {
    try {
      const res = await axiosInstance.post("/product/admin/create", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });
      toast.success(res.data.message);
      return res.data.product;
    } catch (error) {
      const errorMessage = error.response?.data?.message || "Failed to create product";
      toast.error(errorMessage);
      return thunkAPI.rejectWithValue(errorMessage);
    }
  }
);

// Update product (Admin only)
export const updateProduct = createAsyncThunk(
  "product/update",
  async ({ productId, formData }, thunkAPI) => {
    try {
      const res = await axiosInstance.put(
        `/product/admin/update/${productId}`,
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        }
      );
      toast.success(res.data.message);
      return res.data.updateProduct;
    } catch (error) {
      const errorMessage = error.response?.data?.message || "Failed to update product";
      toast.error(errorMessage);
      return thunkAPI.rejectWithValue(errorMessage);
    }
  }
);

// Delete product (Admin only)
export const deleteProduct = createAsyncThunk(
  "product/delete",
  async (productId, thunkAPI) => {
    try {
      const res = await axiosInstance.delete(`/product/admin/delete/${productId}`);
      toast.success(res.data.message);
      return res.data.updateProduct;
    } catch (error) {
      const errorMessage = error.response?.data?.message || "Failed to delete product";
      toast.error(errorMessage);
      return thunkAPI.rejectWithValue(errorMessage);
    }
  }
);

// Post product review
export const postProductReview = createAsyncThunk(
  "product/postReview",
  async ({ productId, rating, comment }, thunkAPI) => {
    try {
      const res = await axiosInstance.put(
        `/product/post-new/review/${productId}`,
        { rating, comment }
      );
      toast.success(res.data.message);
      return res.data.review;
    } catch (error) {
      const errorMessage = error.response?.data?.message || "Failed to post review";
      toast.error(errorMessage);
      return thunkAPI.rejectWithValue(errorMessage);
    }
  }
);

// Delete product review
export const deleteReview = createAsyncThunk(
  "product/deleteReview",
  async (productId, thunkAPI) => {
    try {
      const res = await axiosInstance.delete(
        `/product/delete/review/${productId}`
      );
      toast.success(res.data.message);
      return res.data;
    } catch (error) {
      const errorMessage = error.response?.data?.message || "Failed to delete review";
      toast.error(errorMessage);
      return thunkAPI.rejectWithValue(errorMessage);
    }
  }
);

// Fetch AI filtered products
export const fetchAIFilteredProducts = createAsyncThunk(
  "product/fetchAIFiltered",
  async (userPrompt, thunkAPI) => {
    try {
      const res = await axiosInstance.post("/product/ai-search", {
        userPrompt,
      });
      thunkAPI.dispatch(toggleAIModal());
      return res.data;
    } catch (error) {
      toast.error(error.response.data.message);
      return thunkAPI.rejectWithValue(
        error.response?.data?.message || "AI search failed"
      );
    }
  }
);

// ========== Product Slice ==========

const productSlice = createSlice({
  name: "product",
  initialState: {
    // Product listing states
    loading: false,
    products: [],
    totalProducts: 0,
    
    // Featured products
    newProducts: [],
    topRatedProducts: [],
    
    // Single product state
    productDetails: {},
    productDetailsLoading: false,
    
    // Product management states (Admin)
    isCreating: false,
    isUpdating: false,
    isDeleting: false,
    
    // Review states
    isPostingReview: false,
    isReviewDeleting: false,
    productReviews: [],
    
    // AI search state
    aiSearching: false,
    aiSearchResults: [],
    
    // Error state
    error: null,
  },
  extraReducers: (builder) => {
    builder
      // ========== Fetch All Products ==========
      .addCase(fetchAllProducts.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchAllProducts.fulfilled, (state, action) => {
        state.loading = false;
        state.products = action.payload.products;
        state.newProducts = action.payload.newProducts;
        state.topRatedProducts = action.payload.topRatedProducts;
        state.totalProducts = action.payload.totalProducts;
      })
      .addCase(fetchAllProducts.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })

      // ========== Fetch Single Product ==========
      .addCase(fetchSingleProduct.pending, (state) => {
        state.productDetailsLoading = true;
        state.error = null;
      })
      .addCase(fetchSingleProduct.fulfilled, (state, action) => {
        state.productDetailsLoading = false;
        state.productDetails = action.payload;
        state.productReviews = action.payload?.reviews || [];
      })
      .addCase(fetchSingleProduct.rejected, (state, action) => {
        state.productDetailsLoading = false;
        state.error = action.payload;
      })

      // ========== Create Product ==========
      .addCase(createProduct.pending, (state) => {
        state.isCreating = true;
        state.error = null;
      })
      .addCase(createProduct.fulfilled, (state, action) => {
        state.isCreating = false;
        state.products.push(action.payload);
      })
      .addCase(createProduct.rejected, (state, action) => {
        state.isCreating = false;
        state.error = action.payload;
      })

      // ========== Update Product ==========
      .addCase(updateProduct.pending, (state) => {
        state.isUpdating = true;
        state.error = null;
      })
      .addCase(updateProduct.fulfilled, (state, action) => {
        state.isUpdating = false;
        const updatedProduct = action.payload;
        const index = state.products.findIndex((p) => p.id === updatedProduct.id);
        if (index !== -1) {
          state.products[index] = updatedProduct;
        }
        if (state.productDetails.id === updatedProduct.id) {
          state.productDetails = updatedProduct;
        }
      })
      .addCase(updateProduct.rejected, (state, action) => {
        state.isUpdating = false;
        state.error = action.payload;
      })

      // ========== Delete Product ==========
      .addCase(deleteProduct.pending, (state) => {
        state.isDeleting = true;
        state.error = null;
      })
      .addCase(deleteProduct.fulfilled, (state, action) => {
        state.isDeleting = false;
        const deletedProductId = action.payload.id;
        state.products = state.products.filter((p) => p.id !== deletedProductId);
      })
      .addCase(deleteProduct.rejected, (state, action) => {
        state.isDeleting = false;
        state.error = action.payload;
      })

      // ========== Post Product Review ==========
      .addCase(postProductReview.pending, (state) => {
        state.isPostingReview = true;
        state.error = null;
      })
      .addCase(postProductReview.fulfilled, (state, action) => {
        state.isPostingReview = false;
        const updatedProduct = action.payload.product;
        
        // Update product in list
        const index = state.products.findIndex((p) => p.id === updatedProduct.id);
        if (index !== -1) {
          state.products[index] = updatedProduct;
        }
        
        // Update product details
        if (state.productDetails.id === updatedProduct.id) {
          state.productDetails = updatedProduct;
          state.productReviews = updatedProduct.reviews || [];
        }
      })
      .addCase(postProductReview.rejected, (state, action) => {
        state.isPostingReview = false;
        state.error = action.payload;
      })

      // ========== Delete Review ==========
      .addCase(deleteReview.pending, (state) => {
        state.isReviewDeleting = true;
        state.error = null;
      })
      .addCase(deleteReview.fulfilled, (state, action) => {
        state.isReviewDeleting = false;
        const updatedProduct = action.payload.product;
        
        // Update product in list
        const index = state.products.findIndex((p) => p.id === updatedProduct.id);
        if (index !== -1) {
          state.products[index] = updatedProduct;
        }
        
        // Update product details
        if (state.productDetails.id === updatedProduct.id) {
          state.productDetails = updatedProduct;
          state.productReviews = updatedProduct.reviews || [];
        }
      })
      .addCase(deleteReview.rejected, (state, action) => {
        state.isReviewDeleting = false;
        state.error = action.payload;
      })

      // ========== Fetch AI Filtered Products ==========
      .addCase(fetchAIFilteredProducts.pending, (state) => {
        state.aiSearching = true;
        state.error = null;
      })
      .addCase(fetchAIFilteredProducts.fulfilled, (state, action) => {
        state.aiSearching = false;
        state.aiSearchResults = action.payload.products;
      })
      .addCase(fetchAIFilteredProducts.rejected, (state, action) => {
        state.aiSearching = false;
        state.error = action.payload;
      });
  },
});

export default productSlice.reducer;
