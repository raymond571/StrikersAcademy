export type UserRole = 'ADMIN' | 'CUSTOMER';

export interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: UserRole;
  createdAt: string; // ISO date string (serialised for transport)
}

/** Sent from client on registration */
export interface RegisterPayload {
  name: string;
  email: string;
  phone: string;
  password: string;
}

/** Sent from client on login */
export interface LoginPayload {
  email: string;
  password: string;
}

/** Returned by auth endpoints */
export interface AuthResponse {
  user: User;
  /** JWT is set in httpOnly cookie — this field is informational only */
  message: string;
}
