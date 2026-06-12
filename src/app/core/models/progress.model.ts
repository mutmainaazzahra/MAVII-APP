export interface ProgressRequest {
  notes: string;
  percentage: number;
}

export interface ProgressResponse {
  success: boolean;
  message: string;
  data: {
    task_id: number;
    notes: string;
    percentage: number;
    updated_at: string;
  };
}
