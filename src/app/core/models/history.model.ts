export interface HistoryItem {
  id: number;
  title: string;
  customer_name?: string;
  customer_phone?: string;
  status: string;
  location_name?: string;
  address?: string;
  completed_at?: string;
  updated_at?: string;
  created_at?: string;
}

export interface HistoryResponse {
  success: boolean;
  data: HistoryItem[];
}
