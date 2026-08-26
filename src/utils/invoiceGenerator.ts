import PDFDocument from "pdfkit";

export const generateInvoicePDF = (payment: any): Promise<Buffer> => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 50 });
      const buffers: Buffer[] = [];

      doc.on("data", buffers.push.bind(buffers));
      doc.on("end", () => {
        const pdfData = Buffer.concat(buffers);
        resolve(pdfData);
      });

      // Header
      doc
        .fillColor("#444444")
        .fontSize(20)
        .text("INVOICE", 50, 50, { align: "right" })
        .fontSize(10)
        .text(`Invoice Number: ${payment.id}`, { align: "right" })
        .text(`Date: ${payment.createdAt.toLocaleDateString()}`, { align: "right" })
        .moveDown();

      doc.strokeColor("#aaaaaa").lineWidth(1).moveTo(50, 100).lineTo(550, 100).stroke();

      // Business Details
      const business = payment.membership?.plan?.business;
      if (business) {
        doc
          .fontSize(14)
          .text(business.name, 50, 120)
          .fontSize(10)
          .text(`Email: ${business.email || "N/A"}`)
          .moveDown();
      }

      // Customer Details
      doc
        .fontSize(12)
        .text("Bill To:", 50, 180)
        .fontSize(10)
        .text(`Name: ${payment.payer?.name || "N/A"}`)
        .text(`Email: ${payment.payer?.email || "N/A"}`)
        .moveDown();

      // Invoice Items
      doc.strokeColor("#aaaaaa").lineWidth(1).moveTo(50, 250).lineTo(550, 250).stroke();
      doc
        .fontSize(10)
        .text("Description", 50, 260)
        .text("Amount", 400, 260, { align: "right" });
      doc.strokeColor("#aaaaaa").lineWidth(1).moveTo(50, 280).lineTo(550, 280).stroke();

      doc
        .text(`Membership Plan: ${payment.membership?.plan?.name || "N/A"}`, 50, 290)
        .text(`${payment.currency} ${Number(payment.amount).toFixed(2)}`, 400, 290, { align: "right" });

      doc.strokeColor("#aaaaaa").lineWidth(1).moveTo(50, 310).lineTo(550, 310).stroke();

      // Total
      doc
        .fontSize(12)
        .text("Total Paid:", 300, 330, { align: "right" })
        .text(`${payment.currency} ${Number(payment.amount).toFixed(2)}`, 400, 330, { align: "right" })
        .moveDown();

      // Footer
      doc
        .fontSize(10)
        .text("Thank you for your business!", 50, 700, { align: "center", width: 500 });

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
};
