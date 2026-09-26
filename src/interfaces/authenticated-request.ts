/** A request that passed `ValidateTokenGuard`. */
export interface AuthenticatedRequest {
  headers: { authorization: string };
  user: { id: string; email: string; role: string };
}
