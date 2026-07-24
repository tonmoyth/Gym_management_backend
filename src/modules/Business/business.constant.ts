export const USER_ROLE = {
    SUPER_ADMIN: 'SUPER_ADMIN',
    BUSINESS_OWNER: 'BUSINESS_OWNER',
    TRAINER: 'TRAINER',
    MEMBER: 'MEMBER'
} as const;

export const businessSearchableFields = ['name', 'description', 'address'];

export const businessFilterableFields = ['amenities'];
