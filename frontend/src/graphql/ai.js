import { gql } from '@apollo/client';

export const SUGGEST_TICKET_CATEGORY = gql`
  query SuggestTicketCategory($title: String!, $description: String) {
    suggestTicketCategory(title: $title, description: $description) {
      categoryId
      categoryName
      confidence
    }
  }
`;

export const SUMMARIZE_TICKET = gql`
  query SummarizeTicket($ticketId: ID!) {
    summarizeTicket(ticketId: $ticketId)
  }
`;

export const VIRTUAL_AGENT = gql`
  query VirtualAgent($query: String!) {
    virtualAgent(query: $query) {
      answer
      sourceArticles {
        id
        number
        title
        status
      }
    }
  }
`;
