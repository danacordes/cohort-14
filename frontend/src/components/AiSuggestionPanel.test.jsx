import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AiSuggestionPanel from './AiSuggestionPanel.jsx';
import { renderWithProviders } from '../test/renderWithProviders.jsx';

describe('AiSuggestionPanel', () => {
  it('renders caption when no suggestion body', () => {
    renderWithProviders(
      <AiSuggestionPanel caption="Future AI output appears here with controls." />
    );
    expect(screen.getByText(/future AI output/i)).toBeInTheDocument();
  });

  it('fires onOverride when clicked', async () => {
    const user = userEvent.setup();
    const onOverride = vi.fn();
    renderWithProviders(
      <AiSuggestionPanel confidence={0.77} onOverride={onOverride} overrideLabel="Use my choice">
        <span>Suggested category: Network</span>
      </AiSuggestionPanel>
    );
    await user.click(screen.getByRole('button', { name: /use my choice/i }));
    expect(onOverride).toHaveBeenCalledTimes(1);
  });
});
