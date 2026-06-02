import type { Observable } from 'rxjs';
import type { UserSessionGPpc } from '../user-session';

export interface UsersServiceClient {
  validateSession(request: { token: string }): Observable<UserSessionGPpc>;
  login(request: {
    email: string;
    password: string;
  }): Observable<{ access_token: string }>;
  register(request: {
    email: string;
    password: string;
    first_name: string;
    last_name: string;
  }): Observable<{ user_id: string }>;
}
