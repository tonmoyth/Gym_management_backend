export interface IReviewModerationQueryFilters {
  rating?: number | string;
  businessId?: string;
  trainerId?: string;
  memberId?: string;
  isRemoved?: boolean | string;
  searchTerm?: string;
  search?: string;
  page?: number | string;
  limit?: number | string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface IJobPostModerationQueryFilters {
  isOpen?: boolean | string;
  businessId?: string;
  specializationTagId?: string;
  searchTerm?: string;
  search?: string;
  page?: number | string;
  limit?: number | string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface ISanitizedReviewModerationItem {
  id: string;
  rating: number;
  comment: string | null;
  isRemoved: boolean;
  createdAt: Date;
  reportCount: number;
  member: {
    id: string;
    user: {
      id: string;
      fullName: string | null;
      email: string;
      profileImage: string | null;
      isActive: boolean;
    } | null;
  } | null;
  business: {
    id: string;
    name: string;
    status: string;
  } | null;
  trainer?: {
    id: string;
    verifiedBadge: boolean;
    user: {
      id: string;
      fullName: string | null;
      email: string;
    } | null;
  } | null;
}

export interface ISanitizedJobPostModerationItem {
  id: string;
  title: string;
  description: string;
  isOpen: boolean;
  status: string;
  createdAt: Date;
  applicationsCount: number;
  business: {
    id: string;
    name: string;
    status: string;
    address: string;
    owner?: {
      id: string;
      fullName: string | null;
      email: string;
    } | null;
  } | null;
  specializationTag: {
    id: string;
    name: string;
    slug: string;
  } | null;
}
