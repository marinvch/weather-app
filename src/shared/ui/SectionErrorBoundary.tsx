import { Component, type ErrorInfo, type ReactNode } from "react";
import Alert from "@mui/material/Alert";
import AlertTitle from "@mui/material/AlertTitle";
import Button from "@mui/material/Button";
import RefreshIcon from "@mui/icons-material/Refresh";

export interface SectionErrorBoundaryProps {
  /** What the section is, as a reader would name it: "Weather map". */
  section: string;
  /**
   * Values that mean "this is a fresh start" — the coordinate, the profile.
   * When any of them changes, a caught error is cleared and the children
   * render again, so a crash on one place does not stick to the next.
   */
  resetKeys?: readonly unknown[];
  /** Injected in tests; defaults to a full page reload. */
  onReload?: () => void;
  children: ReactNode;
}

/**
 * A code-split chunk that failed to download — Chrome, Firefox and Safari
 * word it differently. It needs a reload rather than a retry: React caches a
 * rejected `lazy()` for the life of the page, so re-rendering re-throws it.
 */
function isChunkLoadError(error: Error): boolean {
  return /dynamically imported module|importing a module script failed/i.test(
    error.message,
  );
}

interface State {
  error: Error | null;
}

function keysChanged(
  previous: readonly unknown[] = [],
  next: readonly unknown[] = [],
): boolean {
  return (
    previous.length !== next.length ||
    previous.some((value, index) => !Object.is(value, next[index]))
  );
}

/**
 * Contains a render error to one section of the page.
 *
 * Without it, an exception anywhere in the tree — a payload shape the map did
 * not expect, a chart given a NaN — unmounts the whole app and leaves a blank
 * page, which to someone checking the weather before going out reads as "the
 * app is broken", not "one panel failed". `QueryState` and `DashboardShell`
 * handle failed *requests*; this handles failed *renders*, which they cannot
 * see.
 *
 * A class because React still offers error boundaries only as class
 * components.
 */
export class SectionErrorBoundary extends Component<
  SectionErrorBoundaryProps,
  State
> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(
      `${this.props.section} crashed while rendering:`,
      error,
      info.componentStack,
    );
  }

  componentDidUpdate(previous: SectionErrorBoundaryProps) {
    if (
      this.state.error &&
      keysChanged(previous.resetKeys, this.props.resetKeys)
    ) {
      this.setState({ error: null });
    }
  }

  private retry = () => this.setState({ error: null });

  private reload = () =>
    (this.props.onReload ?? (() => window.location.reload()))();

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    if (isChunkLoadError(error)) {
      return (
        <Alert
          severity="warning"
          action={
            <Button
              size="small"
              variant="outlined"
              color="inherit"
              startIcon={<RefreshIcon />}
              onClick={this.reload}
            >
              Reload
            </Button>
          }
        >
          <AlertTitle>{this.props.section} is not available offline yet</AlertTitle>
          This part of the app was never downloaded on this device, and it
          could not be fetched now. Reload once you are back online.
        </Alert>
      );
    }

    return (
      <Alert
        severity="error"
        action={
          <Button
            size="small"
            variant="outlined"
            color="inherit"
            startIcon={<RefreshIcon />}
            onClick={this.retry}
          >
            Retry
          </Button>
        }
      >
        <AlertTitle>{this.props.section} could not be shown</AlertTitle>
        Something in this section failed to display. The rest of the app is
        unaffected — retry, or pick another place.
      </Alert>
    );
  }
}
