import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from '../services/auth.service';
import { catchError, switchMap, throwError } from 'rxjs';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const token = authService.getToken();

  let requestToSend = req;
  if (token && req.url.startsWith('/api/')) {
    requestToSend = req.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`
      }
    });
  }

  return next(requestToSend).pipe(
    catchError((error: unknown) => {
      if (
        error instanceof HttpErrorResponse && 
        (error.status === 401 || error.status === 403) && 
        !req.url.includes('/api/auth/login')
      ) {
        // Attempt silent demo re-auth and retry the request once
        return authService.login('admin@concave.com', 'AdminPassword123!').pipe(
          switchMap(res => {
            const retriedReq = req.clone({
              setHeaders: {
                Authorization: `Bearer ${res.access_token}`
              }
            });
            return next(retriedReq);
          }),
          catchError(() => throwError(() => error))
        );
      }
      return throwError(() => error);
    })
  );
};
