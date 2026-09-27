/**
 * Turn RTK Query's `unknown` error into a sentence with a next step in it.
 *
 * Its own file rather than a helper inside `DashboardShell`, for two reasons:
 * the same translation is wanted anywhere a query result surfaces outside a
 * shell (an alert toast, a retry banner), and exporting a non-component from a
 * component file breaks Fast Refresh — `react-refresh/only-export-components`
 * is an ESLint error in this repo.
 */

/**
 * The shapes RTK Query can hand back are `FetchBaseQueryError`
 * (`{ status, data }`, where `status` is either an HTTP number or one of four
 * string tags) and `SerializedError` (`{ message }`). Matched structurally
 * rather than by importing RTK's types, so this keeps working for an error
 * from somewhere else — and it never throws or returns an empty string, since
 * its whole job is to be the thing shown when something already went wrong.
 */
export function describeQueryError(error: unknown): string {
  if (error && typeof error === "object" && "status" in error) {
    const status = (error as { status: unknown }).status;

    if (status === "FETCH_ERROR") {
      return "Could not reach the weather service. Check your connection — cached data is used when you are offline.";
    }
    if (status === "TIMEOUT_ERROR") {
      return "The weather service took too long to answer. Try again in a moment.";
    }
    if (status === "PARSING_ERROR") {
      return "The weather service answered with something this app could not read.";
    }
    if (status === 404) {
      return "The weather service has no data for this location.";
    }
    if (status === 429) {
      return "Too many requests to the weather service. Wait a minute before trying again.";
    }
    if (typeof status === "number" && status >= 500) {
      return `The weather service is having trouble (HTTP ${status}). This is at their end, not yours.`;
    }
    if (typeof status === "number") {
      return `The weather service rejected the request (HTTP ${status}).`;
    }
  }

  if (error && typeof error === "object" && "message" in error) {
    const { message } = error as { message?: unknown };
    if (typeof message === "string" && message) return message;
  }

  return "Something went wrong fetching the forecast.";
}
