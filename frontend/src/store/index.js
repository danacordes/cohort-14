import { configureStore } from '@reduxjs/toolkit';
import errorsReducer from './errorsSlice.js';
import authReducer from './authSlice.js';

const store = configureStore({
  reducer: {
    auth: authReducer,
    errors: errorsReducer,
  },
});

export default store;
