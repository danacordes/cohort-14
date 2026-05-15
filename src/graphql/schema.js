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
  }
`;

export { ticketResolvers as resolvers } from './ticketResolvers.js';
