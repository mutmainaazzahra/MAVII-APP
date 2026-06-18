import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Preferences } from '@capacitor/preferences';
import { map, catchError } from 'rxjs/operators';
import { from, of } from 'rxjs';
import {
  LoginRequest,
  LoginResponse,
  ProfileResponse,
  User,
} from '../models/user.model';
import { NotificationService } from './notification.service';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private apiUrl = environment.apiUrl;
  private isAuthenticatedSubject = new BehaviorSubject<boolean>(false);
  private userRoleSubject = new BehaviorSubject<string | null>(null);
  private lastUpdatedAt: string | null = null;

  constructor(
    private http: HttpClient,
    private notificationService: NotificationService,
  ) {
    this.loadInitialAuth();
  }

  async loadInitialAuth() {
    const token = await Preferences.get({ key: 'auth_token' });
    const user = await Preferences.get({ key: 'auth_user' });
    if (token.value && user.value) {
      this.isAuthenticatedSubject.next(true);
      const userData = JSON.parse(user.value);
      this.userRoleSubject.next(userData.role);
      this.lastUpdatedAt = userData.updated_at || null;
      this.notificationService.syncFromServer();
    }
  }

  login(credentials: LoginRequest): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(
      `${this.apiUrl}/api/auth/login`,
      credentials,
    );
  }

  forgotPassword(email: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/api/auth/forgot-password`, { email });
  }

  resetPassword(
    token: string,
    email: string,
    password: string,
    password_confirmation: string,
  ): Observable<any> {
    return this.http.post(`${this.apiUrl}/api/auth/reset-password`, {
      token,
      email,
      password,
      password_confirmation,
    });
  }

  logout(): Observable<any> {
    return this.http.post(`${this.apiUrl}/api/auth/logout`, {});
  }

  getMe(): Observable<any> {
    return this.http.get(`${this.apiUrl}/api/auth/me`);
  }

  updateProfile(data: FormData): Observable<ProfileResponse> {
    return this.http.post<ProfileResponse>(
      `${this.apiUrl}/api/auth/profile`,
      data,
    );
  }

  async saveAuthData(token: string, user: User): Promise<void> {
    await Preferences.set({ key: 'auth_token', value: token });
    await Preferences.set({ key: 'auth_user', value: JSON.stringify(user) });
    this.isAuthenticatedSubject.next(true);
    this.userRoleSubject.next(user.role);
    this.lastUpdatedAt = (user as any).updated_at || null;
    this.notificationService.syncFromServer();
  }

  async getStoredUser(): Promise<User | null> {
    const { value } = await Preferences.get({ key: 'auth_user' });
    if (value) return JSON.parse(value) as User;
    return null;
  }

  refreshUser(): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/api/auth/me`).pipe(
      map((res) => {
        const user = res.user || res.data || res;
        Preferences.set({ key: 'user_data', value: JSON.stringify(user) });
        return user;
      }),
      catchError(() => from(this.getStoredUser())),
    );
  }

  async getStoredToken(): Promise<string | null> {
    const { value } = await Preferences.get({ key: 'auth_token' });
    return value;
  }

  async clearAuthData(): Promise<void> {
    await Preferences.remove({ key: 'auth_token' });
    await Preferences.remove({ key: 'auth_user' });
    this.isAuthenticatedSubject.next(false);
    this.userRoleSubject.next(null);
    this.lastUpdatedAt = null;
  }

  isLoggedIn(): boolean {
    return this.isAuthenticatedSubject.value;
  }

  getUserRole(): string | null {
    return this.userRoleSubject.value;
  }

  async checkUserUpdated(): Promise<boolean> {
    try {
      const user = await this.refreshUser().toPromise();
      if (user && (user as any).updated_at) {
        const newUpdatedAt = (user as any).updated_at;
        if (this.lastUpdatedAt && this.lastUpdatedAt !== newUpdatedAt) {
          return true;
        }
        this.lastUpdatedAt = newUpdatedAt;
        const storedUser = await this.getStoredUser();
        if (storedUser) {
          (storedUser as any).updated_at = newUpdatedAt;
          const token = await this.getStoredToken();
          if (token) {
            await this.saveAuthData(token, storedUser);
          }
        }
      }
      return false;
    } catch {
      return true;
    }
  }
}
