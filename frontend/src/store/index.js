import { configureStore } from '@reduxjs/toolkit';
import errorsReducer from './errorsSlice.js';
import authReducer from './authSlice.js';
import kbReducer from './kbSlice.js';

const store = configureStore({
  reducer: {
    auth: authReducer,
    errors: errorsReducer,
    kb: kbReducer,
  },
});

export default store;
