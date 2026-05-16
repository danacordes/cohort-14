import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import CSATSurveyPage from './CSATSurveyPage.jsx';
import { renderWithProviders } from '../../test/renderWithProviders.jsx';

describe('CSATSurveyPage', () => {
  it('warns when the survey token is missing', () => {
    renderWithProviders(<CSATSurveyPage />, {
      initialEntries: ['/survey/csat'],
    });
    expect(screen.getByText(/needs a valid survey link/i)).toBeInTheDocument();
  });

  it('shows the rating form when token is present', () => {
    renderWithProviders(<CSATSurveyPage />, {
      initialEntries: ['/survey/csat?token=test-token'],
    });
    expect(screen.getByText(/How did we do/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /submit feedback/i })).toBeInTheDocument();
  });
});
