export interface ProofResponse {
  success: boolean;
  message: string;
  data: {
    id: number;
    photo_url: string;
    caption: string;
    uploaded_at: string;
  };
}

export interface ProofItem {
  id: number;
  photo_url: string;
  caption: string;
  uploaded_at: string;
}
