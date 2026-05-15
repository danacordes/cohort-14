import { configureStore } from '@reduxjs/toolkit';
import errorsReducer from './errorsSlice.js';
import authReducer from './authSlice.js';
import kbReducer from './kbSlice.js';
import reportingReducer from './reportingSlice.js';

const store = configureStore({
  reducer: {
    auth: authReducer,
    errors: errorsReducer,
    kb: kbReducer,
    reporting: reportingReducer,
  },
});

export default store;
