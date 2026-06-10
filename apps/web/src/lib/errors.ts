// Human-readable field name map
const FIELD_LABELS: Record<string, string> = {
  email: "Email address",
  password: "Password",
  firstName: "First name",
  lastName: "Last name",
  phone: "Phone number",
  cacNumber: "CAC number",
  registeredName: "Registered company name",
  businessType: "Business type",
  sector: "Sector",
  address: "Address",
  city: "City",
  state: "State",
  bvn: "BVN",
  nin: "NIN",
  percentOwned: "Ownership percentage",
  amountRequested: "Amount requested",
  tenor: "Tenor",
  purpose: "Purpose",
  commodityType: "Commodity type",
  tradeDescription: "Trade description",
  collateralValue: "Collateral value",
};

// Translate raw Zod messages to friendly ones
function friendlyZodMessage(field: string, message: string): string {
  const label = FIELD_LABELS[field] || field;
  if (message.includes("at least") && message.includes("character")) {
    const match = message.match(/at least (\d+)/);
    const min = match?.[1] ?? "more";
    return `${label} must be at least ${min} characters.`;
  }
  if (message.includes("at most") && message.includes("character")) {
    const match = message.match(/at most (\d+)/);
    const max = match?.[1] ?? "fewer";
    return `${label} must be ${max} characters or fewer.`;
  }
  if (message.toLowerCase().includes("invalid email")) return `${label} must be a valid email address.`;
  if (message.toLowerCase().includes("required") || message.toLowerCase().includes("invalid type")) return `${label} is required.`;
  if (message.toLowerCase().includes("too_small") || message === "Required") return `${label} is required.`;
  if (message.includes("Invalid") || message.includes("invalid")) return `${label} is invalid.`;
  return `${label}: ${message}`;
}

export function parseApiError(err: any): string {
  if (!err.response) {
    if (err.code === "ERR_NETWORK" || err.message?.includes("Network Error")) {
      return "Cannot reach the server. Make sure the API is running.";
    }
    return "A network error occurred. Please try again.";
  }

  const { status, data } = err.response;
  const apiMessage = data?.message || data?.error;

  switch (status) {
    case 400: {
      if (data?.errors) {
        const entries = Object.entries(data.errors as Record<string, string[]>);
        if (entries.length > 0) {
          const [field, messages] = entries[0];
          const msg = Array.isArray(messages) ? messages[0] : String(messages);
          return friendlyZodMessage(field, msg);
        }
      }
      return apiMessage || "Invalid input. Please check your details.";
    }
    case 401:
      return apiMessage || "Incorrect email or password.";
    case 403:
      return apiMessage || "You do not have permission to do this.";
    case 404:
      return apiMessage || "Resource not found.";
    case 409:
      return apiMessage || "This record already exists.";
    case 422:
      return apiMessage || "Validation failed. Please check your input.";
    case 429:
      return "Too many attempts. Please wait a moment and try again.";
    case 500:
    case 502:
    case 503:
      return "Server error. Please try again in a moment.";
    default:
      return apiMessage || "Something went wrong. Please try again.";
  }
}

// Returns all field errors as a map — use for inline field highlighting
export function parseFieldErrors(err: any): Record<string, string> {
  if (!err?.response?.data?.errors) return {};
  const raw = err.response.data.errors as Record<string, string[]>;
  const result: Record<string, string> = {};
  for (const [field, messages] of Object.entries(raw)) {
    const msg = Array.isArray(messages) ? messages[0] : String(messages);
    result[field] = friendlyZodMessage(field, msg);
  }
  return result;
}
