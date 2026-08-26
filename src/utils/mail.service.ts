import nodemailer from 'nodemailer';
import { envVeriables } from '../config/envConfig';

// Reusable transporter
const transporter = nodemailer.createTransport({
    service: 'gmail', // Assuming gmail for generic usage, can be configured
    auth: {
        user: envVeriables.EMAIL_USER,
        pass: envVeriables.EMAIL_PASS,
    },
});

const sendApplicationApprovedEmail = async (
    trainerName: string,
    businessName: string,
    jobTitle: string,
    trainerEmail: string
) => {
    const htmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e1e1e1; border-radius: 8px;">
            <h2 style="color: #2c3e50; text-align: center;">Application Approved 🎉</h2>
            <p style="font-size: 16px; color: #333;">Dear ${trainerName},</p>
            <p style="font-size: 16px; color: #333;">
                Congratulations! Your trainer application for the position of <strong>${jobTitle}</strong> has been approved by <strong>${businessName}</strong>.
            </p>
            <p style="font-size: 16px; color: #333;">
                You can now access this business from your Trainer Dashboard. Log in to your account to review the business details and get started.
            </p>
            <div style="text-align: center; margin: 30px 0;">
                <a href="${envVeriables.FRONTEND_URL}/dashboard" style="background-color: #3498db; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold;">
                    Go to Dashboard
                </a>
            </div>
            <p style="font-size: 14px; color: #7f8c8d;">
                If you have any questions, feel free to reply to this email or contact support.
            </p>
            <hr style="border: none; border-top: 1px solid #e1e1e1; margin: 20px 0;" />
            <p style="font-size: 12px; color: #95a5a6; text-align: center;">
                &copy; ${new Date().getFullYear()} Gym Management System. All rights reserved.
            </p>
        </div>
    `;

    try {
        await transporter.sendMail({
            from: `"${envVeriables.EMAIL_FROM}" <${envVeriables.EMAIL_USER}>`,
            to: trainerEmail,
            subject: 'Your Trainer Application has been Approved! 🎉',
            html: htmlContent,
        });
        console.log(`✅ Approval email sent to ${trainerEmail}`);
    } catch (error: any) {
        console.error('❌ Failed to send approval email:', error.message);
        throw error;
    }
};

const sendApplicationRejectedEmail = async (
    trainerName: string,
    businessName: string,
    jobTitle: string,
    trainerEmail: string
) => {
    const htmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e1e1e1; border-radius: 8px;">
            <h2 style="color: #2c3e50; text-align: center;">Application Update</h2>
            <p style="font-size: 16px; color: #333;">Dear ${trainerName},</p>
            <p style="font-size: 16px; color: #333;">
                Thank you for taking the time to apply for the position of <strong>${jobTitle}</strong> at <strong>${businessName}</strong>.
            </p>
            <p style="font-size: 16px; color: #333;">
                After careful consideration, your application was not selected at this time. 
                We encourage you to apply for other opportunities on our platform that match your skills and experience.
            </p>
            <div style="text-align: center; margin: 30px 0;">
                <a href="${envVeriables.FRONTEND_URL}/jobs" style="background-color: #3498db; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold;">
                    Browse New Jobs
                </a>
            </div>
            <hr style="border: none; border-top: 1px solid #e1e1e1; margin: 20px 0;" />
            <p style="font-size: 12px; color: #95a5a6; text-align: center;">
                &copy; ${new Date().getFullYear()} Gym Management System. All rights reserved.
            </p>
        </div>
    `;

    try {
        await transporter.sendMail({
            from: `"${envVeriables.EMAIL_FROM}" <${envVeriables.EMAIL_USER}>`,
            to: trainerEmail,
            subject: 'Update on Your Trainer Application',
            html: htmlContent,
        });
        console.log(`✅ Rejection email sent to ${trainerEmail}`);
    } catch (error: any) {
        console.error('❌ Failed to send rejection email:', error.message);
        throw error;
    }
};

const sendTrainerRemovedEmail = async (
    trainerName: string,
    businessName: string,
    trainerEmail: string
) => {
    const htmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e1e1e1; border-radius: 8px;">
            <h2 style="color: #2c3e50; text-align: center;">Business Access Removed</h2>
            <p style="font-size: 16px; color: #333;">Dear ${trainerName},</p>
            <p style="font-size: 16px; color: #333;">
                You have been removed from the business <strong>${businessName}</strong> by the business owner.
            </p>
            <p style="font-size: 16px; color: #333;">
                You can no longer manage members, schedules, attendance, or other business resources associated with it.
            </p>
            <hr style="border: none; border-top: 1px solid #e1e1e1; margin: 20px 0;" />
            <p style="font-size: 12px; color: #95a5a6; text-align: center;">
                &copy; ${new Date().getFullYear()} Gym Management System. All rights reserved.
            </p>
        </div>
    `;

    try {
        await transporter.sendMail({
            from: `"${envVeriables.EMAIL_FROM}" <${envVeriables.EMAIL_USER}>`,
            to: trainerEmail,
            subject: 'Business Access Removed',
            html: htmlContent,
        });
        console.log(`o. Removal email sent to ${trainerEmail}`);
    } catch (error: any) {
        console.error('?O Failed to send removal email:', error.message);
        throw error;
    }
};

const sendBulkAnnouncementEmail = async (
    emails: string[],
    businessName: string,
    announcementTitle: string,
    announcementContent: string
) => {
    if (!emails.length) return;

    const htmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e1e1e1; border-radius: 8px;">
            <h2 style="color: #2c3e50; text-align: center;">${businessName} Announcement</h2>
            <h3 style="font-size: 18px; color: #333;">${announcementTitle}</h3>
            <p style="font-size: 16px; color: #333;">
                ${announcementContent}
            </p>
            <p style="font-size: 14px; color: #7f8c8d; margin-top: 20px;">
                Published on: ${new Date().toLocaleDateString()}
            </p>
            <div style="text-align: center; margin: 30px 0;">
                <a href="${envVeriables.FRONTEND_URL}/dashboard" style="background-color: #3498db; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold;">
                    Go to Dashboard
                </a>
            </div>
            <hr style="border: none; border-top: 1px solid #e1e1e1; margin: 20px 0;" />
            <p style="font-size: 12px; color: #95a5a6; text-align: center;">
                &copy; ${new Date().getFullYear()} Gym Management System. All rights reserved.
            </p>
        </div>
    `;

    try {
        await transporter.sendMail({
            from: `"${businessName}" <${envVeriables.EMAIL_USER}>`,
            bcc: emails, // Use BCC for bulk email
            subject: announcementTitle,
            html: htmlContent,
        });
        console.log(`✅ Bulk announcement email sent to ${emails.length} recipients`);
    } catch (error: any) {
        console.error('❌ Failed to send bulk announcement email:', error.message);
        throw error;
    }
};

const sendMembershipApprovedEmail = async (
    memberName: string,
    memberEmail: string,
    businessName: string,
    planName: string,
    startDate: string,
    endDate: string
) => {
    const htmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e1e1e1; border-radius: 8px;">
            <h2 style="color: #2c3e50; text-align: center;">Membership Approved 🎉</h2>
            <p style="font-size: 16px; color: #333;">Dear ${memberName},</p>
            <p style="font-size: 16px; color: #333;">
                Your <strong>${planName}</strong> membership booking at <strong>${businessName}</strong> has been approved!
            </p>
            <p style="font-size: 16px; color: #333;">
                Your membership is valid from <strong>${new Date(startDate).toLocaleDateString()}</strong> to <strong>${new Date(endDate).toLocaleDateString()}</strong>.
            </p>
            <div style="text-align: center; margin: 30px 0;">
                <a href="${envVeriables.FRONTEND_URL}/dashboard" style="background-color: #3498db; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold;">
                    Go to Dashboard
                </a>
            </div>
            <p style="font-size: 14px; color: #7f8c8d;">
                If you have any questions, feel free to contact the gym directly.
            </p>
            <hr style="border: none; border-top: 1px solid #e1e1e1; margin: 20px 0;" />
            <p style="font-size: 12px; color: #95a5a6; text-align: center;">
                &copy; ${new Date().getFullYear()} Gym Management System. All rights reserved.
            </p>
        </div>
    `;

    try {
        await transporter.sendMail({
            from: `"${businessName}" <${envVeriables.EMAIL_USER}>`,
            to: memberEmail,
            subject: 'Your Membership Booking is Approved! 🎉',
            html: htmlContent,
        });
        console.log(`✅ Membership approval email sent to ${memberEmail}`);
    } catch (error: any) {
        console.error('❌ Failed to send membership approval email:', error.message);
        throw error;
    }
};

const sendMembershipRejectedEmail = async (
    memberName: string,
    memberEmail: string,
    businessName: string,
    planName: string,
    refundStatus: string
) => {
    let refundMessage = '';
    if (refundStatus === 'REFUNDED') {
        refundMessage = 'Your payment has been refunded.';
    } else if (refundStatus === 'REFUND_PENDING') {
        refundMessage = 'Your refund is being processed.';
    } else if (refundStatus === 'REFUND_FAILED') {
        refundMessage = 'We attempted to refund your payment but it failed. Please contact support.';
    }

    const htmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e1e1e1; border-radius: 8px;">
            <h2 style="color: #2c3e50; text-align: center;">Membership Booking Update</h2>
            <p style="font-size: 16px; color: #333;">Dear ${memberName},</p>
            <p style="font-size: 16px; color: #333;">
                Your <strong>${planName}</strong> membership booking at <strong>${businessName}</strong> has been rejected by the business owner.
            </p>
            <p style="font-size: 16px; color: #333; font-weight: bold;">
                ${refundMessage}
            </p>
            <p style="font-size: 14px; color: #7f8c8d;">
                If you have any questions, feel free to contact the gym directly or our support team.
            </p>
            <hr style="border: none; border-top: 1px solid #e1e1e1; margin: 20px 0;" />
            <p style="font-size: 12px; color: #95a5a6; text-align: center;">
                &copy; ${new Date().getFullYear()} Gym Management System. All rights reserved.
            </p>
        </div>
    `;

    try {
        await transporter.sendMail({
            from: `"${businessName}" <${envVeriables.EMAIL_USER}>`,
            to: memberEmail,
            subject: 'Update on Your Membership Booking',
            html: htmlContent,
        });
        console.log(`✅ Membership rejection email sent to ${memberEmail}`);
    } catch (error: any) {
        console.error('❌ Failed to send membership rejection email:', error.message);
        throw error;
    }
};

export const MailService = {
    sendApplicationApprovedEmail,
    sendApplicationRejectedEmail,
    sendTrainerRemovedEmail,
    sendBulkAnnouncementEmail,
    sendMembershipApprovedEmail,
    sendMembershipRejectedEmail,
};
