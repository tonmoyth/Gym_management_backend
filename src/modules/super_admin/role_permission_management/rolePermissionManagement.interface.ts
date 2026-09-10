import { StaffManageableRole } from './rolePermissionManagement.constant';

export interface ICreateStaffPayload {
    name: string;
    email: string;
    password: string;
    role: StaffManageableRole;
    permissions: string[];
}

export interface IUpdateStaffPermissionPayload {
    role?: StaffManageableRole;
    permissions?: string[];
    status?: 'ACTIVE' | 'SUSPENDED';
}

export interface IStaffFilterRequest {
    searchTerm?: string;
    role?: string;
    status?: string;
    page?: string;
    limit?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
}

export interface ISanitizedStaffResponse {
    id: string;
    name: string | null;
    email: string;
    role: string;
    status: 'ACTIVE' | 'SUSPENDED';
    permissions: string[];
    createdAt: Date;
    updatedAt: Date;
}
