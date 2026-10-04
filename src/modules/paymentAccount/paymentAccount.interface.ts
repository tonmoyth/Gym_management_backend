export type TPaymentAccountType = 'BANK' | 'BKASH' | 'NAGAD';
export type TPaymentAccountStatus = 'ACTIVE' | 'INACTIVE';

export interface ICreatePaymentAccountPayload {
  accountType: TPaymentAccountType;
  accountName: string;
  accountNumber: string;
  bankName?: string;
  branchName?: string;
  routingNumber?: string;
  isDefault?: boolean;
  status?: TPaymentAccountStatus;
}

export interface IUpdatePaymentAccountPayload {
  accountType?: TPaymentAccountType;
  accountName?: string;
  accountNumber?: string;
  bankName?: string;
  branchName?: string;
  routingNumber?: string;
  isDefault?: boolean;
  status?: TPaymentAccountStatus;
}

export interface IPaymentAccountFilter {
  accountType?: TPaymentAccountType;
  status?: TPaymentAccountStatus;
  isDefault?: boolean | string;
  searchTerm?: string;
}
