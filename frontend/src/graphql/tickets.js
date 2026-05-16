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
      status
      priority
      assignedTo
      category {
        id
        name
      }
      resolutionSummary
      createdAt
      updatedAt
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
