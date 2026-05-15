import { gql } from '@apollo/client';

export const KB_SEARCH = gql`
  query KBSearch($query: String!, $filters: KBSearchFilters, $page: PaginationInput) {
    kbSearch(query: $query, filters: $filters, page: $page) {
      items {
        id
        number
        title
        articleType
        status
        category {
          id
          name
        }
        tags
        excerpt
        updatedAt
      }
      totalCount
      page
      pageSize
      suggestions
    }
  }
`;

export const KB_ARTICLE = gql`
  query KBArticle($id: ID!) {
    kbArticle(id: $id) {
      id
      number
      title
      body
      articleType
      status
      flaggedForReview
      category {
        id
        name
      }
      tags
      reviewDueAt
      expiresAt
      currentVersion
      createdAt
      updatedAt
      author {
        id
        email
      }
      reviewer {
        id
        email
      }
      versionHistory {
        id
        versionNumber
        title
        body
        tags
        createdAt
        editor {
          id
          email
        }
      }
      feedbackSummary {
        helpfulCount
        notHelpfulCount
        userRating
      }
      linkedTickets {
        id
        number
        title
        status
      }
      linkedProblems {
        id
        number
        title
        status
      }
    }
  }
`;

export const CREATE_KB_ARTICLE = gql`
  mutation CreateKBArticle($input: KBArticleInput!) {
    createKBArticle(input: $input) {
      id
      number
      status
    }
  }
`;

export const UPDATE_KB_ARTICLE = gql`
  mutation UpdateKBArticle($id: ID!, $input: KBArticleInput!) {
    updateKBArticle(id: $id, input: $input) {
      id
      number
      status
      currentVersion
    }
  }
`;

export const SUBMIT_FOR_REVIEW = gql`
  mutation SubmitForReview($id: ID!) {
    submitForReview(id: $id) {
      id
      status
    }
  }
`;

export const APPROVE_KB_ARTICLE = gql`
  mutation ApproveKBArticle($id: ID!) {
    approveKBArticle(id: $id) {
      id
      status
    }
  }
`;

export const REJECT_KB_ARTICLE = gql`
  mutation RejectKBArticle($id: ID!, $comments: String!) {
    rejectKBArticle(id: $id, comments: $comments) {
      id
      status
    }
  }
`;

export const RETIRE_KB_ARTICLE = gql`
  mutation RetireKBArticle($id: ID!) {
    retireKBArticle(id: $id) {
      id
      status
    }
  }
`;

export const ARCHIVE_KB_ARTICLE = gql`
  mutation ArchiveKBArticle($id: ID!) {
    archiveKBArticle(id: $id) {
      id
      status
    }
  }
`;

export const RESTORE_KB_VERSION = gql`
  mutation RestoreKBVersion($articleId: ID!, $versionId: ID!) {
    restoreKBVersion(articleId: $articleId, versionId: $versionId) {
      id
      status
      currentVersion
    }
  }
`;

export const KB_FEEDBACK = gql`
  mutation KBFeedback($articleId: ID!, $rating: String!) {
    kbFeedback(articleId: $articleId, rating: $rating) {
      articleId
      rating
    }
  }
`;

export const KB_PENDING_REVIEW = gql`
  query KBPendingReview($page: PaginationInput) {
    kbSearch(
      query: ""
      filters: { status: "PendingReview" }
      page: $page
    ) {
      items {
        id
        number
        title
        articleType
        status
        author {
          id
          email
        }
        updatedAt
      }
      totalCount
      page
      pageSize
    }
  }
`;

export const KB_ADMIN_METRICS = gql`
  query KBAdminMetrics($period: String!) {
    kbAdminMetrics(period: $period) {
      topViewed {
        article {
          id
          number
          title
        }
        viewCount
      }
      deflectionCount
      feedbackTrends {
        article {
          id
          number
          title
        }
        helpfulCount
        notHelpfulCount
        netScore
      }
      coverageGaps {
        article {
          id
          number
          title
        }
        reason
      }
    }
  }
`;
