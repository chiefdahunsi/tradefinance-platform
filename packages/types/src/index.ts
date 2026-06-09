// Auth
export interface AuthTokenPayload {
  userId: string;
  email: string;
  role: "SME_OWNER" | "ANALYST" | "ADMIN";
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string;
}

// API Responses
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  errors?: Record<string, string[]>;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// Application
export interface CreateApplicationRequest {
  amountRequested: number;
  tenor: number;
  purpose: string;
  commodityType: string;
  tradeDescription: string;
  collateralType?: string;
  collateralValue?: number;
  collateralDetails?: string;
}

// Business
export interface CreateBusinessRequest {
  registeredName: string;
  tradingName?: string;
  cacNumber: string;
  taxId?: string;
  dateIncorporated?: string;
  businessType: string;
  sector: string;
  address: string;
  city: string;
  state: string;
  website?: string;
  commodities: string[];
  yearsInOperation?: number;
  annualTurnover?: number;
  exportMarkets?: string[];
}

// Director
export interface CreateDirectorRequest {
  firstName: string;
  lastName: string;
  bvn: string;
  nin?: string;
  phone: string;
  email: string;
  nationality?: string;
  percentOwned: number;
  isSignatory?: boolean;
}

// KYC
export interface KYCVerificationResult {
  status: "PASSED" | "FAILED" | "PENDING";
  reference?: string;
  details?: Record<string, unknown>;
  message?: string;
}

// Scoring
export interface ScoringRules {
  kycWeight: number;
  financialWeight: number;
  tradeHistoryWeight: number;
  collateralWeight: number;
  bureauWeight: number;
  passMark: number;
}
