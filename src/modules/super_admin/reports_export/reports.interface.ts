export interface IReportFilterQuery {
  startDate?: string;
  endDate?: string;
}

export interface IExportReportQuery extends IReportFilterQuery {
  format: 'pdf' | 'excel' | 'xlsx';
}

export interface IFinancialReport {
  totalRevenue: number;
  refundedAmount: number;
  netRevenue: number;
  membershipRevenue: number;
  subscriptionRevenue: number;
  successfulTransactions: number;
  failedTransactions: number;
  pendingTransactions: number;
  totalTransactions: number;
}

export interface IUsageReport {
  totalBusinesses: number;
  activeBusinesses: number;
  suspendedBusinesses: number;
  pendingBusinesses: number;
  totalUsers: number;
  totalMembers: number;
  totalTrainers: number;
  totalStaff: number;
  totalBusinessOwners: number;
  activeMemberships: number;
  totalClasses: number;
  attendanceCount: number;
}

export interface IPlatformReportData {
  period: {
    startDate: string | null;
    endDate: string | null;
  };
  financial: IFinancialReport;
  usage: IUsageReport;
}
