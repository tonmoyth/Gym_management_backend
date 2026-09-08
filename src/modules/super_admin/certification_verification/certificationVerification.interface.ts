export interface IRejectCertificationPayload {
  reason: string;
}

export interface ICertificationQueryParams {
  search?: string;
  searchTerm?: string;
  page?: string | number;
  limit?: string | number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  issuer?: string;
  trainerId?: string;
}
