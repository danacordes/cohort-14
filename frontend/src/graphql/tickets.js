import { gql } from '@apollo/client';

export const TICKET_CATEGORIES = gql`
  query TicketCategories {
    ticketCategories {
      id
      name
      slug
      isActive
    }
  }
`;

export const MY_TICKETS = gql`
  query MyTickets($page: Int, $pageSize: Int, $sort: TicketSortInput) {
    tickets(page: $page, pageSize: $pageSize, sort: $sort) {
      totalCount
      page
      pageSize
      edges {
        node {
          id
          publicNumber
          title
          status
          priority
          assignedTo
          slaResponseDueAt
          slaResolutionDueAt
          slaPausedAt
          slaStatus
          slaRespondedAt
          slaResponseBreachedAt
          slaResolutionBreachedAt
          category {
            id
            name
          }
          createdAt
          updatedAt
        }
      }
    }
  }
`;

export const TICKET_DETAIL = gql`
  query TicketDetail($id: ID!) {
    ticket(id: $id) {
      id
      publicNumber
      title
      description
      submitterRef
      status
      priority
      assignedTo
      category {
        id
        name
      }
      resolutionSummary
      resolvedAt
      autoCloseAt
      closedAt
      closureNumber
      slaResponseDueAt
      slaResolutionDueAt
      slaPausedAt
      slaStatus
      slaRespondedAt
      slaResponseBreachedAt
      slaResolutionBreachedAt
      createdAt
      updatedAt
    }
  }
`;

export const TICKET_COMMENTS = gql`
  query TicketComments($ticketId: ID!) {
    ticketComments(ticketId: $ticketId) {
      id
      ticketId
      body
      isInternal
      authorId
      createdAt
    }
  }
`;

export const ADD_COMMENT = gql`
  mutation AddComment($input: AddCommentInput!) {
    addComment(input: $input) {
      id
      ticketId
      body
      isInternal
      authorId
      createdAt
    }
  }
`;

export const RESOLVE_TICKET = gql`
  mutation ResolveTicket($ticketId: ID!, $resolutionSummary: String!) {
    resolveTicket(ticketId: $ticketId, resolutionSummary: $resolutionSummary) {
      id
      status
      resolutionSummary
      resolvedAt
      autoCloseAt
      updatedAt
    }
  }
`;

export const CONFIRM_RESOLUTION = gql`
  mutation ConfirmResolution($ticketId: ID!) {
    confirmResolution(ticketId: $ticketId) {
      id
      status
      closedAt
      closureNumber
      updatedAt
    }
  }
`;

export const CLOSE_TICKET = gql`
  mutation CloseTicket($ticketId: ID!) {
    closeTicket(ticketId: $ticketId) {
      id
      status
      closedAt
      closureNumber
      updatedAt
    }
  }
`;

export const REOPEN_TICKET = gql`
  mutation ReopenTicket($id: ID!) {
    reopenTicket(id: $id) {
      id
      status
      resolvedAt
      autoCloseAt
      closedAt
      updatedAt
    }
  }
`;

export const OVERRIDE_TICKET_AI = gql`
  mutation OverrideTicketAi($input: OverrideTicketAiInput!) {
    overrideTicketAiAction(input: $input) {
      id
      publicNumber
      priority
      assignedTo
      category {
        id
        name
      }
      updatedAt
    }
  }
`;

export const SUBMIT_CSAT_RESPONSE = gql`
  mutation SubmitCsatResponse($token: String!, $rating: Int!, $comment: String) {
    submitCSATResponse(token: $token, rating: $rating, comment: $comment) {
      id
      ticketId
      closureNumber
      rating
      comment
      submittedAt
    }
  }
`;

export const CREATE_TICKET = gql`
  mutation CreateTicket($input: CreateTicketInput!) {
    createTicket(input: $input) {
      id
      publicNumber
      title
      status
      priority
    }
  }
`;

export const RECORD_DEFLECTION = gql`
  mutation RecordDeflection($articleId: ID!, $queryText: String) {
    recordDeflection(articleId: $articleId, queryText: $queryText) {
      id
      userId
      articleId
      queryText
      occurredAt
    }
  }
`;

export const QUEUE_TICKETS = gql`
  query QueueTickets($filter: TicketFilterInput, $sort: TicketSortInput, $page: Int, $pageSize: Int) {
    tickets(filter: $filter, sort: $sort, page: $page, pageSize: $pageSize) {
      totalCount
      page
      pageSize
      edges {
        node {
          id
          publicNumber
          title
          status
          priority
          assignedTo
          slaResponseDueAt
          slaResolutionDueAt
          slaPausedAt
          slaStatus
          slaRespondedAt
          slaResponseBreachedAt
          slaResolutionBreachedAt
          category {
            id
            name
          }
          createdAt
          updatedAt
        }
      }
    }
  }
`;

export const AGENT_WORKLOAD = gql`
  query AgentWorkload {
    agentWorkload {
      agentId
      agentName
      openTicketCount
    }
  }
`;

export const ASSIGN_TICKET = gql`
  mutation AssignTicket($ticketId: ID!, $agentId: ID!) {
    assignTicket(ticketId: $ticketId, agentId: $agentId) {
      id
      publicNumber
      assignedTo
    }
  }
`;

export const SELF_ASSIGN_TICKET = gql`
  mutation SelfAssignTicket($ticketId: ID!) {
    selfAssignTicket(ticketId: $ticketId) {
      id
      publicNumber
      assignedTo
    }
  }
`;
