import * as React from "react";

type Props = { name: string; children: React.ReactNode; silent?: boolean };

export class CrashBoundary extends React.Component<Props, { err?: Error }> {
  state = { err: undefined as Error | undefined };

  static getDerivedStateFromError(err: Error) {
    return { err };
  }

  componentDidCatch(err: Error, info: React.ErrorInfo) {
    if (!this.props.silent) {
      // This prints the exact subtree that crashed with a clean component stack
      console.error(`[CRASH @ ${this.props.name}]`, err, info?.componentStack);
    }
  }

  render() {
    if (this.state.err) {
      // keep UI alive; show a small placeholder if you want
      return <div data-crash={this.props.name} />;
    }
    return this.props.children;
  }
}
