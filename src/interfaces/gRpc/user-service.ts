import type { Observable } from 'rxjs';
import type { UserSessionGPpc } from '../user-session';

export interface UsersServiceClient {
  validateSession(request: { token: string }): Observable<UserSessionGPpc>;
}
