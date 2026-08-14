import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { axiosInstance } from "../../lib/axios";
import { toast } from "react-toastify";
import { toggleAuthPopup } from "./popupSlice";

export const register = createAsyncThunk(
   "auth-register", 
   async (data, thunkAPI) => {
      try {
         const res = await axiosInstance.post("/auth/register", data);
         toast.success("Registration successful");
         thunkAPI.dispatch(toggleAuthPopup());
         return res.data.user;
      } catch (error) {
         toast.error(error.response.data.message);
         return thunkAPI.rejectWithValue(error.response.data.message);
      }
   }
);

export const login = createAsyncThunk(
   "auth-login", 
   async (data, thunkAPI) => {
      try {
         const res = await axiosInstance.post("/auth/login", data);
         toast.success("Login successful");
         thunkAPI.dispatch(toggleAuthPopup());
         return res.data.user;
      } catch (error) {
         toast.error(error.response.data.message);
         return thunkAPI.rejectWithValue(error.response.data.message);
      }
   }
);

export const getUser = createAsyncThunk(
   "auth-getUser", 
   async (_, thunkAPI) => {
      try {
         const res = await axiosInstance.get("/auth/getUser");
         return res.data.user;
      } catch (error) {
         return thunkAPI.rejectWithValue(error.response.data.message || "Failed to get user");
      }
   }
);

export const logout = createAsyncThunk(
   "auth-logout", 
   async (_, thunkAPI) => {
      try {
         await axiosInstance.get("/auth/logout");
         thunkAPI.dispatch(toggleAuthPopup());
         return null;
      } catch (error) {
         toast.error(error.response.data.message);
         return thunkAPI.rejectWithValue(error.response.data.message || "Failed to get user");
      }
   }
);

export const forgotPassword = createAsyncThunk(
   "auth-forgotPassword",

   async ({email}, thunkAPI) => {
      try {
         const res = await axiosInstance.post(
            "/auth/password/forgot",
            { email }
         );
         toast.success(res.data.message);
         return null;
      } catch (error) {
         const message =
            error.response?.data?.message ||
            "Something went wrong. Please try again.";
         toast.error(message);
         return thunkAPI.rejectWithValue(message);
      }
   }
);

export const resetPassword = createAsyncThunk(
   "auth-reset-password",
   async ({token, password, confirmPassword}, thunkAPI) => {
      try {
      const res = await axiosInstance.put(
         `/auth/password/reset/${token}`,
         {
            password, confirmPassword
         }
      );
      toast.success(res.data.message);
      return res.data.user;
      } catch (error) {
      const message =
         error.response?.data?.message ||
         "Something went wrong. Please try again.";
      toast.error(message);
      return thunkAPI.rejectWithValue(message);
      }
   }
);

export const updatePassword = createAsyncThunk(
   "auth-update-password",
   async (data, thunkAPI) => {
      try {
      const res = await axiosInstance.put(
         `/auth/password/update`,
         data
      );
      toast.success(res.data.message);
      return null;
      } catch (error) {
      const message =
         error.response?.data?.message;
      toast.error(message);
      return thunkAPI.rejectWithValue(message);
      }
   }
);

export const updateProfile = createAsyncThunk(
   "auth-update-profile",
   async (data, thunkAPI) => {
      try {
      const res = await axiosInstance.put(
         `/auth/me/update`,
         data
      );
      toast.success(res.data.message);
      return res.data.user;
      } catch (error) {
      const message =
         error.response?.data?.message;
      toast.error(message);
      return thunkAPI.rejectWithValue(message);
      }
   }
);

const authSlice = createSlice({
   name: "auth",
   initialState: {
      authUser: null,
      isSigningUp: false,
      isLoggingIn: false,
      isUpdatingProfile: false,
      isUpdatingPassword: false,
      isRequestingForToken: false,
      isCheckingAuth: true,
   },
   extraReducers: (builder) => {
      builder
         // register
         .addCase(register.pending, (state) => {
            state.isSigningUp = true;
         })
         .addCase(register.fulfilled, (state, action) => {
            state.isSigningUp = false;
            state.authUser = action.payload;
         })
         .addCase(register.rejected, (state) => {
            state.isSigningUp = false;
         })
         // login
         .addCase(login.pending, (state) => {
            state.isLoggingIn = true;
         })
         .addCase(login.fulfilled, (state, action) => {
            state.isLoggingIn = false;
            state.authUser = action.payload;
         })
         .addCase(login.rejected, (state) => {
            state.isLoggingIn = false;
         })
         // getUser
         .addCase(getUser.pending, (state, ) => {
            state.isCheckingAuth = true;
            state.authUser = null;
         })
         .addCase(getUser.fulfilled, (state, action) => {
            state.isCheckingAuth = false;
            state.authUser = action.payload;
         })
         .addCase(getUser.rejected, (state, ) => {
            state.isCheckingAuth = false;
            state.authUser = null;
         })
         // logout
         .addCase(logout.fulfilled, (state) => {
            state.authUser = {};
         })
         .addCase(logout.rejected, (state) => {
            state.authUser = null;
         })
         // forgot password
         .addCase(forgotPassword.pending, (state) => {
            state.isRequestingForToken = true;
         })
         .addCase(forgotPassword.fulfilled, (state, ) => {
            state.isRequestingForToken = false;
         })
         .addCase(forgotPassword.rejected, (state) => {
            state.isRequestingForToken = false;
         })
         // reset password
         .addCase(resetPassword.pending, (state) => {
            state.isUpdatingPassword = true;
         })
         .addCase(resetPassword.fulfilled, (state, action) => {
            state.isUpdatingPassword = false;
            state.authUser = action.payload;
         })
         .addCase(resetPassword.rejected, (state) => {
            state.isUpdatingPassword = false;
         })
         // update password
         .addCase(updatePassword.pending, (state) => {
            state.isUpdatingPassword = true;
         })
         .addCase(updatePassword.fulfilled, (state, ) => {
            state.isUpdatingPassword = false;
         })
         .addCase(updatePassword.rejected, (state) => {
            state.isUpdatingPassword = false;
         })
         // update profile
         .addCase(updateProfile.pending, (state) => {
            state.isUpdatingProfile = true;
         })
         .addCase(updateProfile.fulfilled, (state, action) => {
            state.isUpdatingProfile = false;
            state.authUser = action.payload;
         })
         .addCase(updateProfile.rejected, (state) => {
            state.isUpdatingProfile = false;
         })
   },
});

export default authSlice.reducer;
