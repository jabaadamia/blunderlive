export type ErrorBody =
  | string
  | string[]
  | {
      [key: string]: ErrorBody;
    }
  | null;

export class ApiError extends Error {
  status: number;
  body: ErrorBody;

  constructor(message: string, status: number, body: ErrorBody) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }
}

export function toErrorBody(value: unknown): ErrorBody {
  if (
    value === null ||
    typeof value === "string" ||
    Array.isArray(value)
  ) {
    return value;
  }

  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, nestedValue]) => [key, toErrorBody(nestedValue)]),
    );
  }

  return null;
}

function flattenEntry(label: string, value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.flatMap((item) => flattenEntry(label, item));
  }

  if (value && typeof value === "object") {
    return Object.entries(value).flatMap(([key, nestedValue]) =>
      flattenEntry(key, nestedValue),
    );
  }

  if (typeof value === "string") {
    return label === "non_field_errors" || label === "detail"
      ? [value]
      : [`${label}: ${value}`];
  }

  return [];
}

export function getErrorMessage(error: unknown) {
  if (error instanceof ApiError) {
    if (typeof error.body === "string") {
      return error.body;
    }

    if (Array.isArray(error.body)) {
      return error.body.join(", ");
    }

    if (error.body && typeof error.body === "object") {
      const messages = Object.entries(error.body).flatMap(([key, value]) =>
        flattenEntry(key, value),
      );

      if (messages.length > 0) {
        return messages.join(" ");
      }
    }

    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Something went wrong.";
}
