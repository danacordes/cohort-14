import { configureStore } from '@reduxjs/toolkit';
import errorsReducer from './errorsSlice.js';
import authReducer from './authSlice.js';
import kbReducer from './kbSlice.js';
import reportingReducer from './reportingSlice.js';
import ticketQueueReducer from './ticketQueueSlice.js';

const store = configureStore({
  reducer: {
    auth: authReducer,
    errors: errorsReducer,
    kb: kbReducer,
    reporting: reportingReducer,
    ticketQueue: ticketQueueReducer,
  },
});

export default store;
