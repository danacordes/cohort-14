import { gql } from '@apollo/client';

export const AUDIT_LOG = gql`
  query AuditLog($entityType: String!, $entityId: ID!, $page: PaginationInput) {
    auditLog(entityType: $entityType, entityId: $entityId, page: $page) {
      items {
        id
        entityType
        entityId
        action
        actorId
        actorName
        actorKind
        aiConfidence
        aiFeature
        previousValues
        newValues
        occurredAt
      }
      totalCount
      page
      pageSize
    }
  }
`;
