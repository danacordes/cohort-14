import { ticketResolvers } from './ticketResolvers.js';
import { kbResolvers } from './kbResolvers.js';

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

  enum AuditActorKind {
    HUMAN
    AI_SYSTEM
  }

  enum TicketAiOverrideField {
    CATEGORY
    ASSIGNMENT
    PRIORITY
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
    actorName: String
    """Distinguishes AI system actions from human actors in the audit trail."""
    actorKind: AuditActorKind!
    """Confidence score for AI-attributed actions (0–1), when recorded."""
    aiConfidence: Float
    """Logical AI feature area (e.g. classification, routing), when recorded."""
    aiFeature: String
    previousValues: String!
    newValues: String!
    occurredAt: String!
  }

  type AuditEntryPage {
    items: [AuditEntry!]!
    totalCount: Int!
    page: Int!
    pageSize: Int!
  }

  input PaginationInput {
    page: Int
    pageSize: Int
  }

  input OverrideTicketAiInput {
    ticketId: ID!
    field: TicketAiOverrideField!
    """Use with field CATEGORY — omit or null to clear category."""
    categoryId: ID
    """Use with field ASSIGNMENT — must be a valid agent user id."""
    agentId: ID
    """Use with field PRIORITY."""
    priority: TicketPriorityEnum
    """Optional link to a prior AI audit row this override supersedes."""
    supersedesAuditEntryId: ID
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

  # ─── Ticket AI (classification / summarization) ────────────────────────────

  type CategorySuggestion {
    categoryId: ID!
    categoryName: String!
    """Confidence between 0 and 1 surfaced for REQ-AI-003."""
    confidence: Float!
  }

  # ─── SLA Config ───────────────────────────────────────────────────────────

  type SLAPolicy {
    id: ID!
    priority: TicketPriorityEnum!
    responseTimeHours: Int!
    resolutionTimeHours: Int!
    effectiveFrom: String!
    createdBy: String!
    createdAt: String!
  }

  type SLAPolicyConfig {
    policies: [SLAPolicy!]!
    escalationThresholdPercent: Int!
    unassignedEscalationThresholdHours: Int!
  }

  input SLAPolicyInput {
    priority: TicketPriorityEnum!
    responseTimeHours: Int!
    resolutionTimeHours: Int!
  }

  input SLAPolicyConfigInput {
    policies: [SLAPolicyInput!]
    escalationThresholdPercent: Int
    unassignedEscalationThresholdHours: Int
  }

  # ─── Comments ─────────────────────────────────────────────────────────────

  type TicketComment {
    id: ID!
    ticketId: ID!
    body: String!
    isInternal: Boolean!
    authorId: String!
    createdAt: String!
  }

  input AddCommentInput {
    ticketId: ID!
    body: String!
    isInternal: Boolean
  }

  # ─── CSAT ─────────────────────────────────────────────────────────────────

  type CSATResponse {
    id: ID!
    ticketId: ID!
    closureNumber: Int!
    rating: Int!
    comment: String
    submittedAt: String!
  }

  type CSATConfig {
    csatEnabled: Boolean!
  }

  # ─── Closure config ───────────────────────────────────────────────────────

  type ClosureConfig {
    autoCloseBusinessDays: Int!
    csatEnabled: Boolean!
  }

  # ─── Holidays ─────────────────────────────────────────────────────────────

  type Holiday {
    id: ID!
    date: String!
    label: String!
    createdBy: String!
    createdAt: String!
  }

  # ─── Workload ─────────────────────────────────────────────────────────────

  type WorkloadSummary {
    agentId: ID!
    agentName: String!
    openTicketCount: Int!
  }

  # ─── Deflection ───────────────────────────────────────────────────────────

  type DeflectionEvent {
    id: ID!
    userId: String!
    articleId: String!
    queryText: String!
    occurredAt: String!
  }

  # ─── Knowledge Base (WO-12 search + admin metrics) ───────────────────────

  type KBSearchCategoryRef {
    id: ID!
    name: String!
  }

  type KBSearchAuthorRef {
    id: ID!
    email: String!
  }

  type KBSearchHit {
    id: ID!
    number: String!
    title: String!
    articleType: String!
    status: String!
    category: KBSearchCategoryRef
    tags: [String!]!
    excerpt: String!
    updatedAt: String!
    author: KBSearchAuthorRef
  }

  input KBSearchFilters {
    categoryId: ID
    articleType: String
    status: String
    updatedAfter: String
    updatedBefore: String
  }

  type KBSearchResultPage {
    items: [KBSearchHit!]!
    totalCount: Int!
    page: Int!
    pageSize: Int!
    suggestions: [String!]!
  }

  type KBMetricsArticleRef {
    id: ID!
    number: String!
    title: String!
  }

  type KBTopViewedStat {
    article: KBMetricsArticleRef!
    viewCount: Int!
  }

  type KBFeedbackTrendStat {
    article: KBMetricsArticleRef!
    helpfulCount: Int!
    notHelpfulCount: Int!
    netScore: Int!
  }

  type KBCoverageGapStat {
    article: KBMetricsArticleRef!
    reason: String!
  }

  type KBAdminMetricsPayload {
    topViewed: [KBTopViewedStat!]!
    deflectionCount: Int!
    feedbackTrends: [KBFeedbackTrendStat!]!
    coverageGaps: [KBCoverageGapStat!]!
  }

  # ─── Knowledge Base article management (WO-13) ────────────────────────────

  enum KBFeedbackRating {
    HELPFUL
    NOT_HELPFUL
  }

  input KBAttachmentInput {
    filename: String!
    mimeType: String!
    storageKey: String!
    extractedText: String
  }

  input CreateKbArticleInput {
    categoryId: ID!
    """Must be Solution | How-To Guide | Known Error | FAQ."""
    articleType: String!
    title: String
    body: String
    tags: [String!]
    expiresAt: String
    reviewDueAt: String
    attachments: [KBAttachmentInput!]
  }

  input UpdateKbArticleInput {
    categoryId: ID
    articleType: String
    title: String
    body: String
    tags: [String!]
    expiresAt: String
    reviewDueAt: String
    attachments: [KBAttachmentInput!]
  }

  type KBUserEmailRef {
    id: ID!
    email: String!
  }

  type KBCategoryRef {
    id: ID!
    name: String!
  }

  type KBArticleFile {
    id: ID!
    filename: String!
    mimeType: String!
    extractedText: String
    uploadedBy: ID!
    uploadedAt: String!
  }

  type KBArticleVersion {
    id: ID!
    articleId: ID!
    versionNumber: Int!
    title: String!
    body: String!
    tags: [String!]!
    editorId: ID!
    editorEmail: String
    createdAt: String!
  }

  type KBFeedbackUpsertPayload {
    helpfulCount: Int!
    notHelpfulCount: Int!
    """True when article was auto-flagged for review per threshold."""
    flaggedForReview: Boolean!
    feedbackFlagThreshold: Int!
  }

  type KBTicketKbLink {
    articleId: ID!
    number: String!
    title: String!
    status: String!
    linkedAt: String!
  }

  type KBArticle {
    id: ID!
    number: String!
    title: String!
    body: String!
    articleType: String!
    status: String!
    category: KBCategoryRef!
    tags: [String!]!
    author: KBUserEmailRef
    reviewer: KBUserEmailRef
    reviewDueAt: String
    expiresAt: String
    flaggedForReview: Boolean!
    lastReviewComment: String
    currentVersion: Int!
    helpfulCount: Int!
    notHelpfulCount: Int!
    feedbackFlagThreshold: Int!
    createdAt: String!
    updatedAt: String!
    attachments: [KBArticleFile!]!
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
    slaRespondedAt: String
    slaResponseBreachedAt: String
    slaResolutionBreachedAt: String
    resolvedAt: String
    autoCloseAt: String
    closedAt: String
    createdAt: String!
    updatedAt: String!
    closureNumber: Int!
    attachments: [TicketAttachment!]!
    comments: [TicketComment!]!
    linkedKbArticles: [KBTicketKbLink!]!
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
    """When true (admin only), return only tickets with no assignee."""
    unassignedOnly: Boolean
    submitterRef: ID
    search: String
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
    auditLog(entityType: String!, entityId: ID!, page: PaginationInput): AuditEntryPage!
    ticketAttachments(ticketId: ID!): [TicketAttachment!]!
    agentWorkload: [WorkloadSummary!]!
    ticketComments(ticketId: ID!): [TicketComment!]!
    """
    Few-shot similarity + LLM category suggestion (WO #37). Agents/admins only. Null when AI unavailable or malformed model output — non-fatal per ADR-003.
    """
    suggestTicketCategory(title: String!, description: String): CategorySuggestion
    """
    Compact thread digest for handoff (WO #37). Agents/admins only. Null on LLM failure — non-fatal.
    """
    summarizeTicket(ticketId: ID!): String

    kbSearch(query: String!, filters: KBSearchFilters, page: PaginationInput): KBSearchResultPage!
    kbAdminMetrics(period: String!): KBAdminMetricsPayload!

    kbArticle(id: ID!): KBArticle
    kbArticleVersions(id: ID!): [KBArticleVersion!]!

    closureConfig: ClosureConfig!
    holidays: [Holiday!]!
    slaConfig: SLAPolicyConfig!
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
    """Agent/admin: update title/description; refreshes search embedding blob when successful."""
    updateTicketDetails(id: ID!, title: String, description: String): Ticket!
    updateTicketCategory(id: ID!, categoryId: ID): Ticket!
    """Apply a human correction over an AI suggestion or routing decision; records ai_action_overridden in the audit trail."""
    overrideTicketAiAction(input: OverrideTicketAiInput!): Ticket!
    reopenTicket(id: ID!): Ticket!

    createTicketCategory(input: CreateCategoryInput!): TicketCategory!
    renameTicketCategory(id: ID!, name: String!): TicketCategory!
    deactivateTicketCategory(id: ID!): TicketCategory!

    recordDeflection(articleId: ID!, queryText: String): DeflectionEvent!

    assignTicket(ticketId: ID!, agentId: ID!): Ticket!
    selfAssignTicket(ticketId: ID!): Ticket!

    addComment(input: AddCommentInput!): TicketComment!
    resolveTicket(ticketId: ID!, resolutionSummary: String!): Ticket!
    confirmResolution(ticketId: ID!): Ticket!
    closeTicket(ticketId: ID!): Ticket!

    submitCSATResponse(token: String!, rating: Int!, comment: String): CSATResponse!
    updateCSATConfig(enabled: Boolean!): ClosureConfig!
    updateClosureConfig(autoCloseBusinessDays: Int!): ClosureConfig!
    addHoliday(date: String!, label: String!): Holiday!
    removeHoliday(id: ID!): Boolean!

    updateSLAConfig(input: SLAPolicyConfigInput!): SLAPolicyConfig!

    createKbArticle(input: CreateKbArticleInput!): KBArticle!
    updateKbArticle(id: ID!, input: UpdateKbArticleInput!): KBArticle!
    submitKbArticleForReview(id: ID!, reviewerId: ID): KBArticle!
    rejectKbArticle(id: ID!, comment: String!): KBArticle!
    """Admin: publish Draft or PendingReview bypassing reviewer queue."""
    publishKbArticle(id: ID!): KBArticle!
    retireKbArticle(id: ID!): KBArticle!
    archiveKbArticle(id: ID!): KBArticle!
    restoreKbArticleVersion(id: ID!, versionNumber: Int!): KBArticle!

    kbArticleFeedback(articleId: ID!, rating: KBFeedbackRating!): KBFeedbackUpsertPayload!
    linkKbArticleToTicket(ticketId: ID!, articleId: ID!): Boolean!
    unlinkKbArticleFromTicket(ticketId: ID!, articleId: ID!): Boolean!
    setKbFeedbackFlagThreshold(threshold: Int!): Int!
  }
`;



export const resolvers = {
  Query: { ...ticketResolvers.Query, ...kbResolvers.Query },
  Mutation: { ...ticketResolvers.Mutation, ...kbResolvers.Mutation },
  Ticket: ticketResolvers.Ticket,
  KBArticle: kbResolvers.KBArticle,
};
