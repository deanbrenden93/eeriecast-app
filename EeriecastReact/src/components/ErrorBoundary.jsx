import { Component } from 'react';
import PropTypes from 'prop-types';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * App-wide error boundary. Catches render-time errors in the subtree and
 * renders a friendly fallback UI with recovery actions. Logs the error so
 * it can be picked up by console-monitoring or future Sentry-style reporters.
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    if (typeof console !== 'undefined') {
      console.error('[ErrorBoundary] Unhandled error:', error, info?.componentStack);
    }
    // Surface to any external listeners (e.g. future analytics hook).
    try {
      window.dispatchEvent(new CustomEvent('eeriecast-app-error', { detail: { error: String(error), stack: info?.componentStack } }));
    } catch { /* noop */ }
  }

  handleReload = () => {
    try { window.location.reload(); } catch { /* noop */ }
  };

  handleHome = () => {
    try { window.location.assign('/'); } catch { /* noop */ }
  };

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    const message = (this.state.error && (this.state.error.message || String(this.state.error))) || 'Something went wrong.';

    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center px-6 py-16">
        <div className="max-w-md w-full text-center">
          <div className="mx-auto mb-6 w-16 h-16 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-400">
            <AlertTriangle className="w-8 h-8" />
          </div>
          <h1 className="text-2xl md:text-3xl font-bold mb-3 bg-gradient-to-r from-white via-pink-400 to-purple-500 bg-clip-text text-transparent">
            Something glitched in the shadows
          </h1>
          <p className="text-gray-400 text-sm md:text-base mb-2">
            The app ran into an unexpected error and can&apos;t continue rendering this screen.
          </p>
          <p className="text-xs text-gray-500 mb-8 font-mono break-words">
            {message}
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button
              onClick={this.handleReload}
              className="bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 text-white rounded-full px-6 py-2 flex items-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              Reload app
            </Button>
            <Button
              variant="outline"
              onClick={this.handleHome}
              className="bg-transparent border-gray-700 text-white hover:bg-gray-800 hover:text-white rounded-full px-6 py-2 flex items-center gap-2"
            >
              <Home className="w-4 h-4" />
              Go home
            </Button>
          </div>
          <p className="text-xs text-gray-600 mt-8">
            If this keeps happening, email <a href="mailto:brenden@eeriecast.com" className="underline hover:text-gray-400">brenden@eeriecast.com</a>.
          </p>
        </div>
      </div>
    );
  }
}

ErrorBoundary.propTypes = {
  children: PropTypes.node,
};
