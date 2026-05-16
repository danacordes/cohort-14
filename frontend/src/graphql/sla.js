import { gql } from '@apollo/client';

export const SLA_CONFIG = gql`
  query SlaConfig {
    slaConfig {
      escalationThresholdPercent
      unassignedEscalationThresholdHours
      policies {
        id
        priority
        responseTimeHours
        resolutionTimeHours
        effectiveFrom
        createdBy
        createdAt
      }
    }
  }
`;

export const UPDATE_SLA_CONFIG = gql`
  mutation UpdateSlaConfig($input: SLAPolicyConfigInput!) {
    updateSLAConfig(input: $input) {
      escalationThresholdPercent
      unassignedEscalationThresholdHours
      policies {
        id
        priority
        responseTimeHours
        resolutionTimeHours
        effectiveFrom
        createdBy
        createdAt
      }
    }
  }
`;
