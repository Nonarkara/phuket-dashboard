"use client";

import React, { Component, ReactNode } from "react";
import { AlertCircle, RefreshCw } from "lucide-react";

interface Props {
  children: ReactNode;
  fallbackMessage?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // We can log the error to an error reporting service here
    console.error("ErrorBoundary caught an error:", error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex h-full w-full min-h-[120px] flex-col items-center justify-center border border-[var(--line)] bg-[var(--bg-surface)] p-4 text-center">
          <AlertCircle size={20} className="mb-2 text-[#ef4444]" />
          <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#ef4444]">
            Module Unavailable
          </div>
          <div className="mt-1 text-[11px] text-[var(--dim)] max-w-[200px] truncate">
            {this.props.fallbackMessage || this.state.error?.message || "An unexpected error occurred."}
          </div>
          <button
            onClick={this.handleRetry}
            className="mt-3 flex items-center gap-1.5 border border-[var(--line-bright)] bg-[var(--bg)] px-3 py-1.5 text-[10px] font-semibold text-[var(--ink)] hover:text-[var(--cool)] transition-colors"
          >
            <RefreshCw size={10} />
            RETRY
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
