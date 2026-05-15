export const typeDefs = `#graphql

  # ─── Enums ────────────────────────────────────────────────────────────────

  enum TicketStatusEnum {
    OPEN
    IN_PROGRESS
    PENDING_USER_RESPONSE
    RESOLVED
    CLOSED
  }

  enum TicketPriorityEnum {
    CRITICAL
    HIGH
    MEDIUM
    LOW
  }

  enum SLAStatusEnum {
    ON_TRACK
    AT_RISK
    BREACHED
    PAUSED
    UNKNOWN
  }

  enum SortDirection {
    ASC
    DESC
  }

  # ─── Reference types ──────────────────────────────────────────────────────

  type TicketCategory {
    id: ID!
    name: String!
    slug: String
    isActive: Boolean!
    createdAt: String!
    updatedAt: String!
  }

  type AuditEntry {
    id: ID!
    entityType: String!
    entityId: String!
    action: String!
    actorId: String!
    previousValues: String!
    newValues: String!
    occurredAt: String!
  }

  # ─── Attachments ─────────────────────────────────────────────────────────

  type TicketAttachment {
    id: ID!
    ticketId: ID!
    filename: String!
    mimeType: String!
    sizeBytes: Int!
    storageKey: String!
    uploadedBy: String!
    uploadedAt: String!
  }

  input AttachmentInput {
    filename: String!
    mimeType: String!
    sizeBytes: Int
    storageKey: String!
  }

  # ─── Deflection ───────────────────────────────────────────────────────────

  type DeflectionEvent {
    id: ID!
    userId: String!
    articleId: String!
    queryText: String!
    occurredAt: String!
  }

  # ─── Ticket ───────────────────────────────────────────────────────────────

  type Ticket {
    id: ID!
    publicNumber: String!
    title: String!
    description: String!
    submitterRef: String!
    status: TicketStatusEnum!
    priority: TicketPriorityEnum!
    category: TicketCategory
    assignedTo: String
    resolutionSummary: String
    slaResponseDueAt: String
    slaResolutionDueAt: String
    slaPausedAt: String
    slaStatus: SLAStatusEnum
    resolvedAt: String
    autoCloseAt: String
    closedAt: String
    createdAt: String!
    updatedAt: String!
    attachments: [TicketAttachment!]!
  }

  type TicketEdge {
    node: Ticket!
  }

  type TicketConnection {
    edges: [TicketEdge!]!
    totalCount: Int!
    page: Int!
    pageSize: Int!
  }

  # ─── Inputs ───────────────────────────────────────────────────────────────

  input CreateTicketInput {
    title: String!
    description: String
    priority: TicketPriorityEnum
    categoryId: ID
    attachments: [AttachmentInput!]
  }

  input TicketFilterInput {
    status: TicketStatusEnum
    priority: TicketPriorityEnum
    categoryId: ID
    assignedTo: ID
    submitterRef: ID
  }

  input TicketSortInput {
    field: String
    direction: SortDirection
  }

  input CreateCategoryInput {
    name: String!
  }

  # ─── Queries ──────────────────────────────────────────────────────────────

  type Query {
    _empty: String
    ticket(id: ID!): Ticket
    tickets(
      filter: TicketFilterInput
      sort: TicketSortInput
      page: Int
      pageSize: Int
    ): TicketConnection!
    ticketCategories: [TicketCategory!]!
    ticketAuditLog(ticketId: ID!): [AuditEntry!]!
    ticketAttachments(ticketId: ID!): [TicketAttachment!]!
  }

  # ─── Mutations ────────────────────────────────────────────────────────────

  type Mutation {
    createTicket(input: CreateTicketInput!): Ticket!
    updateTicketStatus(
      id: ID!
      status: TicketStatusEnum!
      resolutionSummary: String
    ): Ticket!
    updateTicketPriority(id: ID!, priority: TicketPriorityEnum!): Ticket!
    updateTicketCategory(id: ID!, categoryId: ID): Ticket!
    reopenTicket(id: ID!): Ticket!

    createTicketCategory(input: CreateCategoryInput!): TicketCategory!
    renameTicketCategory(id: ID!, name: String!): TicketCategory!
    deactivateTicketCategory(id: ID!): TicketCategory!

    recordDeflection(articleId: ID!, queryText: String): DeflectionEvent!
  }
`;

export { ticketResolvers as resolvers } from './ticketResolvers.js';
