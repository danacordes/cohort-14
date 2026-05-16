import { gql } from '@apollo/client';

export const CLOSURE_CONFIG = gql`
  query ClosureConfig {
    closureConfig {
      autoCloseBusinessDays
      csatEnabled
    }
  }
`;

export const HOLIDAYS = gql`
  query Holidays {
    holidays {
      id
      date
      label
      createdBy
      createdAt
    }
  }
`;

export const UPDATE_CLOSURE_CONFIG = gql`
  mutation UpdateClosureConfig($autoCloseBusinessDays: Int!) {
    updateClosureConfig(autoCloseBusinessDays: $autoCloseBusinessDays) {
      autoCloseBusinessDays
      csatEnabled
    }
  }
`;

export const UPDATE_CSAT_CONFIG = gql`
  mutation UpdateCsatConfig($enabled: Boolean!) {
    updateCSATConfig(enabled: $enabled) {
      autoCloseBusinessDays
      csatEnabled
    }
  }
`;

export const ADD_HOLIDAY = gql`
  mutation AddHoliday($date: String!, $label: String!) {
    addHoliday(date: $date, label: $label) {
      id
      date
      label
      createdBy
      createdAt
    }
  }
`;

export const REMOVE_HOLIDAY = gql`
  mutation RemoveHoliday($id: ID!) {
    removeHoliday(id: $id)
  }
`;
