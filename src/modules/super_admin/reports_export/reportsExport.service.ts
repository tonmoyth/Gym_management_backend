import PDFDocument from 'pdfkit';
import ExcelJS from 'exceljs';
import { IPlatformReportData } from './reports.interface';

const generatePDF = (report: IPlatformReportData): Promise<Buffer> => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 50, size: 'A4' });
      const buffers: Buffer[] = [];

      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => resolve(Buffer.concat(buffers)));

      // Header Banner
      doc
        .fillColor('#1E293B')
        .fontSize(22)
        .text('Gym Management SaaS Platform', { align: 'left' })
        .fontSize(14)
        .fillColor('#64748B')
        .text('Executive Platform Report', { align: 'left' })
        .moveDown(0.5);

      // Period & Meta
      const periodText =
        report.period.startDate || report.period.endDate
          ? `Period: ${report.period.startDate || 'Beginning'} to ${report.period.endDate || 'Present'}`
          : 'Period: All Time';

      doc
        .fontSize(10)
        .fillColor('#475569')
        .text(`${periodText}  |  Generated on: ${new Date().toUTCString()}`, {
          align: 'left',
        })
        .moveDown(1);

      doc
        .strokeColor('#CBD5E1')
        .lineWidth(1)
        .moveTo(50, doc.y)
        .lineTo(545, doc.y)
        .stroke()
        .moveDown(1.5);

      // SECTION 1: FINANCIAL OVERVIEW
      doc
        .fillColor('#0F172A')
        .fontSize(14)
        .text('1. Financial Summary', { underline: false })
        .moveDown(0.5);

      const drawRow = (label: string, value: string) => {
        const y = doc.y;
        doc
          .fillColor('#334155')
          .fontSize(10)
          .text(label, 60, y)
          .fillColor('#0F172A')
          .text(value, 380, y, { align: 'right', width: 150 });
        doc.moveDown(0.4);
      };

      drawRow('Total Settled Revenue:', `${report.financial.totalRevenue.toFixed(2)} BDT`);
      drawRow('Refunded Amount:', `${report.financial.refundedAmount.toFixed(2)} BDT`);
      drawRow('Net Platform Revenue:', `${report.financial.netRevenue.toFixed(2)} BDT`);
      drawRow('Membership Sales Revenue:', `${report.financial.membershipRevenue.toFixed(2)} BDT`);
      drawRow('Platform Subscription Revenue:', `${report.financial.subscriptionRevenue.toFixed(2)} BDT`);
      drawRow('Successful Transactions:', `${report.financial.successfulTransactions}`);
      drawRow('Failed Transactions:', `${report.financial.failedTransactions}`);
      drawRow('Pending Transactions:', `${report.financial.pendingTransactions}`);
      drawRow('Total Transaction Attempts:', `${report.financial.totalTransactions}`);

      doc.moveDown(1);
      doc
        .strokeColor('#E2E8F0')
        .lineWidth(0.5)
        .moveTo(50, doc.y)
        .lineTo(545, doc.y)
        .stroke()
        .moveDown(1.5);

      // SECTION 2: USAGE & ADOPTION
      doc
        .fillColor('#0F172A')
        .fontSize(14)
        .text('2. Platform Usage & Adoption', { underline: false })
        .moveDown(0.5);

      drawRow('Total Registered Businesses:', `${report.usage.totalBusinesses}`);
      drawRow('Active Businesses (Operational):', `${report.usage.activeBusinesses}`);
      drawRow('Pending Approval Businesses:', `${report.usage.pendingBusinesses}`);
      drawRow('Suspended Businesses:', `${report.usage.suspendedBusinesses}`);
      drawRow('Total Platform Users:', `${report.usage.totalUsers}`);
      drawRow('Total Member Accounts:', `${report.usage.totalMembers}`);
      drawRow('Total Trainer Accounts:', `${report.usage.totalTrainers}`);
      drawRow('Total Business Owners:', `${report.usage.totalBusinessOwners}`);
      drawRow('Total Staff & Admin Accounts:', `${report.usage.totalStaff}`);
      drawRow('Active Gym Memberships:', `${report.usage.activeMemberships}`);
      drawRow('Total Scheduled Classes:', `${report.usage.totalClasses}`);
      drawRow('Total Member Attendance Check-ins:', `${report.usage.attendanceCount}`);

      // Footer
      doc.moveDown(2);
      doc
        .fontSize(8)
        .fillColor('#94A3B8')
        .text(
          'This document contains confidential platform intelligence. Strictly for authorized Super Admin review only.',
          50,
          740,
          { align: 'center', width: 495 }
        );

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
};

const generateExcel = async (report: IPlatformReportData): Promise<Buffer> => {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Gym Management SaaS';
  workbook.created = new Date();

  // 1. Sheet: Executive Summary
  const summarySheet = workbook.addWorksheet('Executive Summary');
  summarySheet.columns = [
    { header: 'Category', key: 'category', width: 26 },
    { header: 'Metric', key: 'metric', width: 36 },
    { header: 'Value', key: 'value', width: 22 },
  ];

  summarySheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  summarySheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF1E293B' },
  };

  const periodLabel =
    report.period.startDate || report.period.endDate
      ? `${report.period.startDate || 'Start'} to ${report.period.endDate || 'Present'}`
      : 'All Time';

  summarySheet.addRows([
    { category: 'Metadata', metric: 'Report Period', value: periodLabel },
    { category: 'Metadata', metric: 'Generated At', value: new Date().toISOString() },
    { category: 'Financial', metric: 'Net Revenue (BDT)', value: report.financial.netRevenue },
    { category: 'Financial', metric: 'Total Settled Revenue (BDT)', value: report.financial.totalRevenue },
    { category: 'Financial', metric: 'Refunded Amount (BDT)', value: report.financial.refundedAmount },
    { category: 'Financial', metric: 'Successful Transactions', value: report.financial.successfulTransactions },
    { category: 'Usage', metric: 'Total Active Businesses', value: report.usage.activeBusinesses },
    { category: 'Usage', metric: 'Total Platform Users', value: report.usage.totalUsers },
    { category: 'Usage', metric: 'Active Memberships', value: report.usage.activeMemberships },
    { category: 'Usage', metric: 'Attendance Check-ins', value: report.usage.attendanceCount },
  ]);

  // 2. Sheet: Financial Breakdown
  const financialSheet = workbook.addWorksheet('Financial Breakdown');
  financialSheet.columns = [
    { header: 'Financial Indicator', key: 'indicator', width: 38 },
    { header: 'Amount / Count', key: 'value', width: 24 },
  ];

  financialSheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  financialSheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF0F172A' },
  };

  financialSheet.addRows([
    { indicator: 'Total Revenue (Gross Settled)', value: report.financial.totalRevenue },
    { indicator: 'Total Refunded Amount', value: report.financial.refundedAmount },
    { indicator: 'Net Platform Revenue', value: report.financial.netRevenue },
    { indicator: 'Membership Sales Revenue', value: report.financial.membershipRevenue },
    { indicator: 'Platform Subscription Revenue', value: report.financial.subscriptionRevenue },
    { indicator: 'Successful Transactions', value: report.financial.successfulTransactions },
    { indicator: 'Failed Transactions', value: report.financial.failedTransactions },
    { indicator: 'Pending Transactions', value: report.financial.pendingTransactions },
    { indicator: 'Total Transaction Attempts', value: report.financial.totalTransactions },
  ]);

  // 3. Sheet: Platform Usage & Adoption
  const usageSheet = workbook.addWorksheet('Platform Usage');
  usageSheet.columns = [
    { header: 'Platform Resource Metric', key: 'metric', width: 38 },
    { header: 'Total Count', key: 'value', width: 20 },
  ];

  usageSheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  usageSheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF334155' },
  };

  usageSheet.addRows([
    { metric: 'Total Registered Businesses', value: report.usage.totalBusinesses },
    { metric: 'Active Businesses (Operational)', value: report.usage.activeBusinesses },
    { metric: 'Pending Approval Businesses', value: report.usage.pendingBusinesses },
    { metric: 'Suspended Businesses', value: report.usage.suspendedBusinesses },
    { metric: 'Total Platform Users', value: report.usage.totalUsers },
    { metric: 'Member Accounts', value: report.usage.totalMembers },
    { metric: 'Trainer Accounts', value: report.usage.totalTrainers },
    { metric: 'Business Owners', value: report.usage.totalBusinessOwners },
    { metric: 'Platform Staff & Admin Accounts', value: report.usage.totalStaff },
    { metric: 'Active Gym Memberships', value: report.usage.activeMemberships },
    { metric: 'Total Scheduled Classes', value: report.usage.totalClasses },
    { metric: 'Total Attendance Check-ins', value: report.usage.attendanceCount },
  ]);

  const rawBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(rawBuffer);
};

export const ReportsExportService = {
  generatePDF,
  generateExcel,
};
