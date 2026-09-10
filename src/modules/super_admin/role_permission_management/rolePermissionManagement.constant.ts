export const STAFF_MANAGEABLE_ROLES = ['ADMIN', 'STAFF'] as const;
export type StaffManageableRole = (typeof STAFF_MANAGEABLE_ROLES)[number];

export const FORBIDDEN_CREATE_ROLES = [
    'SUPER_ADMIN',
    'MEMBER',
    'TRAINER',
    'BUSINESS_OWNER'
] as const;

export const ALL_PLATFORM_PERMISSIONS = [
    // Business oversight permissions
    'BUSINESS_READ',
    'BUSINESS_APPROVE',
    'BUSINESS_SUSPEND',

    // User oversight permissions
    'USER_READ',
    'USER_MANAGE',
    'USER_SUSPEND',

    // Payment oversight permissions
    'PAYMENT_READ',
    'PAYMENT_MANAGE',
    'PAYMENT_REFUND',

    // Dispute resolution permissions
    'DISPUTE_READ',
    'DISPUTE_MANAGE',
    'DISPUTE_RESOLVE',

    // Certification verification permissions
    'CERTIFICATION_READ',
    'CERTIFICATION_VERIFY',
    'CERTIFICATION_REJECT',

    // Content moderation permissions
    'CONTENT_READ',
    'CONTENT_MODERATE',

    // Subscription & billing control permissions
    'SUBSCRIPTION_READ',
    'SUBSCRIPTION_MANAGE',

    // Dashboard analytics permissions
    'DASHBOARD_READ',

    // Platform staff oversight permissions
    'STAFF_READ',
    'STAFF_MANAGE'
] as const;

export type PlatformPermission = (typeof ALL_PLATFORM_PERMISSIONS)[number];

// Platform super-admin permissions that must NEVER be assigned to ADMIN or STAFF
export const PLATFORM_SUPER_ADMIN_ONLY_PERMISSIONS = [
    'SUPER_ADMIN_MANAGE',
    'SYSTEM_SETTINGS_MANAGE'
] as const;

// Privileged permissions reserved strictly for platform ADMIN
export const PRIVILEGED_PLATFORM_PERMISSIONS = [
    'BUSINESS_SUSPEND',
    'USER_SUSPEND',
    'PAYMENT_REFUND',
    'PAYMENT_MANAGE',
    'STAFF_MANAGE'
] as const;

// Operational permissions assignable to platform STAFF
export const STAFF_ALLOWED_PLATFORM_PERMISSIONS = ALL_PLATFORM_PERMISSIONS.filter(
    (perm) => !(PRIVILEGED_PLATFORM_PERMISSIONS as readonly string[]).includes(perm)
);

// All platform permissions assignable to platform ADMIN
export const ADMIN_ALLOWED_PLATFORM_PERMISSIONS = [...ALL_PLATFORM_PERMISSIONS];

export interface IPermissionItem {
    id: PlatformPermission;
    label: string;
    description: string;
    privileged: boolean;
}

export interface IPermissionGroup {
    category: string;
    module: string;
    permissions: IPermissionItem[];
}

export const PLATFORM_PERMISSION_GROUPS: IPermissionGroup[] = [
    {
        category: 'Business Oversight',
        module: 'BUSINESS',
        permissions: [
            { id: 'BUSINESS_READ', label: 'View Businesses', description: 'View gym profiles, listings, and operational status', privileged: false },
            { id: 'BUSINESS_APPROVE', label: 'Approve Businesses', description: 'Review and approve pending gym business applications', privileged: false },
            { id: 'BUSINESS_SUSPEND', label: 'Suspend Businesses', description: 'Suspend or reject gym business accounts (Admin only)', privileged: true }
        ]
    },
    {
        category: 'User Oversight',
        module: 'USER',
        permissions: [
            { id: 'USER_READ', label: 'View Users', description: 'Browse platform users, trainers, and member profiles', privileged: false },
            { id: 'USER_MANAGE', label: 'Manage Users', description: 'Edit and manage user profile details', privileged: false },
            { id: 'USER_SUSPEND', label: 'Suspend Users', description: 'Suspend or ban user accounts (Admin only)', privileged: true }
        ]
    },
    {
        category: 'Payment & Financial Oversight',
        module: 'PAYMENT',
        permissions: [
            { id: 'PAYMENT_READ', label: 'View Payments', description: 'Inspect payment history and gateway transaction logs', privileged: false },
            { id: 'PAYMENT_MANAGE', label: 'Manage Payment Gateways', description: 'Manage platform payout records and payment settings (Admin only)', privileged: true },
            { id: 'PAYMENT_REFUND', label: 'Issue Refunds', description: 'Authorize and issue payment refunds (Admin only)', privileged: true }
        ]
    },
    {
        category: 'Dispute Resolution',
        module: 'DISPUTE',
        permissions: [
            { id: 'DISPUTE_READ', label: 'View Disputes', description: 'View user disputes and conflict reports', privileged: false },
            { id: 'DISPUTE_MANAGE', label: 'Manage Disputes', description: 'Review and investigate dispute details', privileged: false },
            { id: 'DISPUTE_RESOLVE', label: 'Resolve Disputes', description: 'Apply resolutions, warnings, and settle disputes', privileged: false }
        ]
    },
    {
        category: 'Certification Verification',
        module: 'CERTIFICATION',
        permissions: [
            { id: 'CERTIFICATION_READ', label: 'View Certifications', description: 'Inspect trainer credentials and uploaded certificates', privileged: false },
            { id: 'CERTIFICATION_VERIFY', label: 'Verify Certifications', description: 'Approve and grant verified badges to trainers', privileged: false },
            { id: 'CERTIFICATION_REJECT', label: 'Reject Certifications', description: 'Reject invalid trainer certification requests', privileged: false }
        ]
    },
    {
        category: 'Content Moderation',
        module: 'CONTENT',
        permissions: [
            { id: 'CONTENT_READ', label: 'View Flagged Content', description: 'Monitor reported reviews and flagged job posts', privileged: false },
            { id: 'CONTENT_MODERATE', label: 'Moderate Content', description: 'Soft-remove abusive reviews and spam job posts', privileged: false }
        ]
    },
    {
        category: 'Subscription Billing Control',
        module: 'SUBSCRIPTION',
        permissions: [
            { id: 'SUBSCRIPTION_READ', label: 'View Subscriptions', description: 'View SaaS platform gym subscriptions', privileged: false },
            { id: 'SUBSCRIPTION_MANAGE', label: 'Manage Subscriptions', description: 'Update subscription plans and billing statuses', privileged: false }
        ]
    },
    {
        category: 'Platform Analytics',
        module: 'DASHBOARD',
        permissions: [
            { id: 'DASHBOARD_READ', label: 'View Dashboard Analytics', description: 'View top-level revenue, business, and user metrics', privileged: false }
        ]
    },
    {
        category: 'Platform Staff Management',
        module: 'STAFF',
        permissions: [
            { id: 'STAFF_READ', label: 'View Platform Staff', description: 'View platform admin and staff accounts', privileged: false },
            { id: 'STAFF_MANAGE', label: 'Manage Platform Staff', description: 'Create, update, or remove platform staff/admin accounts (Admin only)', privileged: true }
        ]
    }
];

export const platformStaffSearchableFields = ['fullName', 'email'];
export const platformStaffFilterableFields = ['role', 'isActive'];
