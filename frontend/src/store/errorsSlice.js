import { createSlice } from '@reduxjs/toolkit';

let nextId = 1;

const errorsSlice = createSlice({
  name: 'errors',
  initialState: {
    networkError: false,
    errors: [],
  },
  reducers: {
    setNetworkError(state, action) {
      state.networkError = action.payload;
    },
    addError(state, action) {
      state.errors.push({ id: nextId++, ...action.payload });
    },
    removeError(state, action) {
      state.errors = state.errors.filter((e) => e.id !== action.payload);
    },
    clearErrors(state) {
      state.errors = [];
      state.networkError = false;
    },
  },
});

export const { setNetworkError, addError, removeError, clearErrors } = errorsSlice.actions;

export const selectNetworkError = (state) => state.errors.networkError;
export const selectErrors = (state) => state.errors.errors;

export default errorsSlice.reducer;
