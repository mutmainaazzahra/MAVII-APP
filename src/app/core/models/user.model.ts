export interface User {
  id: number;
  name: string;
  email: string;
  phone?: string;
  role: 'technician' | 'admin';
  avatar?: string; 
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  message: string;
  token: string;
  user: User;
}

export interface UpdateProfileRequest {
  name: string;
  phone: string;
  current_password?: string;
  new_password?: string;
  new_password_confirmation?: string;
}

export interface ProfileResponse {
  success: boolean;
  message: string;
  data: {
    id: number;
    name: string;
    email: string;
    email_verified_at?: string;
    phone: string;
    role: string;
    avatar?: string;
    created_at?: string;
    updated_at?: string;
  };
}

export interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data: T;
}
