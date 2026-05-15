import { gql } from '@apollo/client';

export const DASHBOARD_QUERY = gql`
  query Dashboard($period: ReportPeriod!) {
    dashboard(period: $period) {
      openTicketCount
      backlogSize
      ticketsCreatedInPeriod
      ticketsClosedInPeriod
      avgFirstResponseTime
      avgMttr
      slaComplianceRate
      unassignedTicketCount
    }
  }
`;

export const TICKET_VOLUME_REPORT = gql`
  query TicketVolumeReport($filters: ReportFilterInput!) {
    ticketVolumeReport(filters: $filters) {
      totalSubmitted
      totalClosed
      backlogSize
      trend {
        bucket
        created
        closed
      }
    }
  }
`;

export const SLA_PERFORMANCE_REPORT = gql`
  query SLAPerformanceReport($filters: ReportFilterInput!) {
    slaPerformanceReport(filters: $filters) {
      complianceRate
      breachCount
      atRiskCount
      avgFirstResponseTime
      avgResolutionTime
      byPriority {
        priority
        complianceRate
        breachCount
      }
      breachedTickets {
        id
        title
        priority
        breachedAt
      }
    }
  }
`;

export const AGENT_PERFORMANCE_REPORT = gql`
  query AgentPerformanceReport($filters: ReportFilterInput!) {
    agentPerformanceReport(filters: $filters) {
      agents {
        agentId
        agentName
        ticketsResolved
        avgHandleTime
        avgMttr
        avgCsatScore
        openTicketCount
      }
    }
  }
`;

export const QUALITY_REPORT = gql`
  query QualityReport($filters: ReportFilterInput!) {
    qualityReport(filters: $filters) {
      fcrRate
      reopenRate
      escalationRate
      overallCsatScore
      csatTrend {
        bucket
        avgScore
      }
      categoryBreakdown {
        category
        fcrRate
        reopenRate
        escalationRate
      }
      csatResponses {
        ticketId
        rating
        comment
        submittedAt
      }
    }
  }
`;

export const KB_USAGE_REPORT = gql`
  query KBUsageReport($filters: ReportFilterInput!) {
    kbUsageReport(filters: $filters) {
      topViewedArticles {
        articleId
        title
        viewCount
      }
      deflectionCount
      feedbackTrend {
        bucket
        avgRating
      }
      lowPerformingArticles {
        articleId
        title
        viewCount
        avgRating
      }
    }
  }
`;
