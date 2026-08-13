import { HttpErrorResponse, HttpEvent, HttpHandlerFn, HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { Observable, catchError, from, lastValueFrom, of, switchMap, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { environment } from '../../../environments/environment';
import { ApiService } from '../services/api.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const api = inject(ApiService);
  const cloned = req.clone({
    url: req.url.startsWith('http') ? req.url : `${environment.apiUrl}${req.url}`,
    setHeaders: auth.accessToken ? { Authorization: `Bearer ${auth.accessToken}` } : {},
  });

  return next(cloned).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status === 401 && auth.refreshToken) {
        return refreshAndRetry(cloned, auth, api, next);
      }
      return throwError(() => error);
    }),
  );
};

function refreshAndRetry(
  req: HttpRequest<unknown>,
  auth: AuthService,
  api: ApiService,
  next: HttpHandlerFn,
): Observable<HttpEvent<unknown>> {
  return from(refreshToken(api, auth)).pipe(
    switchMap(() => {
      const retry = req.clone({
        setHeaders: { Authorization: `Bearer ${auth.accessToken}` },
      });
      return next(retry);
    }),
    catchError((error) => {
      if (error?.status === 401) {
        auth.logout();
      }
      return throwError(() => error);
    }),
  );
}

async function refreshToken(api: ApiService, auth: AuthService): Promise<void> {
  const refresh = auth.refreshToken;
  if (!refresh) {
    throw new Error('no refresh token');
  }
  try {
    const resp = await api.rawPost('/auth/refresh', { refresh_token: refresh });
    const body: any = resp;
    auth.setTokens(body.access_token, body.refresh_token);
    if (body.user) {
      auth.setUser(body.user);
    }
  } catch {
    auth.logout();
    throw new Error('refresh failed');
  }
}
