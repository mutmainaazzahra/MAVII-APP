export type TaskStatus =
  | 'assigned'
  | 'accepted'
  | 'on-going'
  | 'completed'
  | 'rejected';

export interface TaskProof {
  id: number;
  photo_path: string;
  photo_url?: string;
  note?: string;
  caption?: string;
  created_at?: string;
}

export interface TaskProgress {
  id: number;
  note?: string;
  notes?: string;
  percentage: number;
  created_at?: string;
}

export interface Task {
  id: number;
  title: string;
  description: string;
  customer_name?: string;
  customer_phone?: string;
  actions?: string;
  catatan?: string;
  status: TaskStatus;
  location_name: string;
  latitude: number;
  longitude: number;
  scheduled_at?: string;
  completed_at?: string;
  updated_at?: string;
  created_at?: string;
  proofs?: TaskProof[];
  progress?: TaskProgress[];
}

export interface TaskList {
  id: number;
  title: string;
  description?: string;
  customer_name?: string;
  customer_phone?: string;
  status: TaskStatus;
  location_name: string;
  latitude?: number;
  longitude?: number;
  scheduled_at?: string;
}

export interface TaskActionResponse {
  success: boolean;
  message: string;
  data: { task_id: number; status: TaskStatus };
}
