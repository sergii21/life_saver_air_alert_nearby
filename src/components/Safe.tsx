import { Component, type ReactNode } from 'react';

/**
 * Keeps a failure in a secondary part of the screen (map, lists) from taking the whole
 * app down: that part disappears, the alarm and the channel checks keep working.
 */
export class Safe extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    console.warn('Part of the screen failed and was hidden', error);
  }

  render() {
    return this.state.failed ? null : this.props.children;
  }
}
