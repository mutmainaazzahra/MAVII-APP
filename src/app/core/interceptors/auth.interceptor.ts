import { Injectable } from '@angular/core';
import {
  HttpRequest,
  HttpHandler,
  HttpEvent,
  HttpInterceptor,
} from '@angular/common/http';
import { Observable, from, switchMap } from 'rxjs';
import { Preferences } from '@capacitor/preferences';

@Injectable()
export class AuthInterceptor implements HttpInterceptor {
  intercept(
    request: HttpRequest<unknown>,
    next: HttpHandler,
  ): Observable<HttpEvent<unknown>> {
    return from(Preferences.get({ key: 'auth_token' })).pipe(
      switchMap(({ value: token }) => {
        if (token) {
          
          const isFormData = request.body instanceof FormData;

          
          const headers: { [key: string]: string } = {
            Authorization: `Bearer ${token}`,
            Accept: 'application/json',
          };

          
          if (!isFormData) {
            headers['Content-Type'] = 'application/json';
          }

          const authRequest = request.clone({ setHeaders: headers });
          return next.handle(authRequest);
        }
        return next.handle(request);
      }),
    );
  }
}
