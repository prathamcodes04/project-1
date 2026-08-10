import { createSlice } from "@reduxjs/toolkit";

// create redux slice to manage state of different popups and ui elements in the application
const popupSlice = createSlice({
  name: "popup",
  initialState: {
    isAuthPopupOpen: false,
    isSidebarOpen: false,
    isSearchBarOpen: false,
    isCartOpen: false,
    isAIPopupOpen: false,
  },
  reducers: {
    toggleAuthPopup(state){
      state.isAuthPopupOpen = !state.isAuthPopupOpen;
    },
    toggleSidebar(state){
      state.isSidebarOpen = !state.isSidebarOpen;
    },
    toggleSearchBar(state){
      state.isSearchBarOpen = !state.isSearchBarOpen;
    },
    toggleCart(state){
      state.isCartOpen = !state.isCartOpen;
    },
    toggleAIModal(state){
      state.isAIPopupOpen = !state.isAIPopupOpen;
    },
  },
});

export const {
  toggleAuthPopup,
  toggleSidebar,
  toggleSearchBar,
  toggleCart,
  toggleAIModal,
} = popupSlice.actions;
export default popupSlice.reducer;
