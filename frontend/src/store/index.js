import { configureStore } from '@reduxjs/toolkit';
import errorsReducer from './errorsSlice.js';

// authReducer will be added by WO #22 (Build Authentication UI)

const store = configureStore({
  reducer: {
    errors: errorsReducer,
  },
});

export default store;
