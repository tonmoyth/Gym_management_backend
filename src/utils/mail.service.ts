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

const sendBusinessApprovedEmail = async (
    ownerName: string,
    ownerEmail: string,
    businessName: string
) => {
    const htmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e1e1e1; border-radius: 8px;">
            <h2 style="color: #27ae60; text-align: center;">Business Approved 🎉</h2>
            <p style="font-size: 16px; color: #333;">Dear ${ownerName || 'Business Owner'},</p>
            <p style="font-size: 16px; color: #333;">
                Congratulations! Your business <strong>${businessName}</strong> has been approved by the platform administrator.
            </p>
            <p style="font-size: 16px; color: #333;">
                Your business is now active on our platform. You can log in to your dashboard to manage memberships, staff, trainers, and schedules.
            </p>
            <div style="text-align: center; margin: 30px 0;">
                <a href="${envVeriables.FRONTEND_URL}/dashboard" style="background-color: #27ae60; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold;">
                    Go to Business Dashboard
                </a>
            </div>
            <p style="font-size: 14px; color: #7f8c8d;">
                If you have any questions, please contact our support team.
            </p>
            <hr style="border: none; border-top: 1px solid #e1e1e1; margin: 20px 0;" />
            <p style="font-size: 12px; color: #95a5a6; text-align: center;">
                &copy; ${new Date().getFullYear()} Gym Management System. All rights reserved.
            </p>
        </div>
    `;

    try {
        await transporter.sendMail({
            from: `"Gym Management Platform" <${envVeriables.EMAIL_USER}>`,
            to: ownerEmail,
            subject: `Your Business "${businessName}" has been Approved! 🎉`,
            html: htmlContent,
        });
        console.log(`✅ Business approval email sent to ${ownerEmail}`);
    } catch (error: any) {
        console.error('❌ Failed to send business approval email:', error.message);
        throw error;
    }
};

const sendBusinessRejectedEmail = async (
    ownerName: string,
    ownerEmail: string,
    businessName: string,
    reason?: string
) => {
    const htmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e1e1e1; border-radius: 8px;">
            <h2 style="color: #e74c3c; text-align: center;">Business Application Rejected</h2>
            <p style="font-size: 16px; color: #333;">Dear ${ownerName || 'Business Owner'},</p>
            <p style="font-size: 16px; color: #333;">
                We regret to inform you that your registration for <strong>${businessName}</strong> was not approved at this time.
            </p>
            ${reason ? `<p style="font-size: 16px; color: #e74c3c;"><strong>Reason:</strong> ${reason}</p>` : ''}
            <p style="font-size: 14px; color: #7f8c8d;">
                If you believe this decision was made in error or would like to provide updated documentation, please contact our support team.
            </p>
            <hr style="border: none; border-top: 1px solid #e1e1e1; margin: 20px 0;" />
            <p style="font-size: 12px; color: #95a5a6; text-align: center;">
                &copy; ${new Date().getFullYear()} Gym Management System. All rights reserved.
            </p>
        </div>
    `;

    try {
        await transporter.sendMail({
            from: `"Gym Management Platform" <${envVeriables.EMAIL_USER}>`,
            to: ownerEmail,
            subject: `Update regarding your business application for "${businessName}"`,
            html: htmlContent,
        });
        console.log(`✅ Business rejection email sent to ${ownerEmail}`);
    } catch (error: any) {
        console.error('❌ Failed to send business rejection email:', error.message);
        throw error;
    }
};

const sendBusinessSuspendedEmail = async (
    ownerName: string,
    ownerEmail: string,
    businessName: string,
    reason?: string
) => {
    const htmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e1e1e1; border-radius: 8px;">
            <h2 style="color: #e67e22; text-align: center;">Business Suspended ⚠️</h2>
            <p style="font-size: 16px; color: #333;">Dear ${ownerName || 'Business Owner'},</p>
            <p style="font-size: 16px; color: #333;">
                Please be advised that your business <strong>${businessName}</strong> has been suspended by the platform administrator.
            </p>
            ${reason ? `<p style="font-size: 16px; color: #e67e22;"><strong>Reason:</strong> ${reason}</p>` : ''}
            <p style="font-size: 14px; color: #7f8c8d;">
                During suspension, public access to your gym and booking services are temporarily disabled. Please contact support immediately to resolve this matter.
            </p>
            <hr style="border: none; border-top: 1px solid #e1e1e1; margin: 20px 0;" />
            <p style="font-size: 12px; color: #95a5a6; text-align: center;">
                &copy; ${new Date().getFullYear()} Gym Management System. All rights reserved.
            </p>
        </div>
    `;

    try {
        await transporter.sendMail({
            from: `"Gym Management Platform" <${envVeriables.EMAIL_USER}>`,
            to: ownerEmail,
            subject: `Important: Your Business "${businessName}" has been Suspended`,
            html: htmlContent,
        });
        console.log(`✅ Business suspension email sent to ${ownerEmail}`);
    } catch (error: any) {
        console.error('❌ Failed to send business suspension email:', error.message);
        throw error;
    }
};

const sendAccountSuspendedEmail = async (
    userName: string,
    userEmail: string,
    role: string
) => {
    const htmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e1e1e1; border-radius: 8px;">
            <h2 style="color: #e74c3c; text-align: center;">Account Suspended ⚠️</h2>
            <p style="font-size: 16px; color: #333;">Dear ${userName || 'User'},</p>
            <p style="font-size: 16px; color: #333;">
                Your <strong>${role ? role.toLowerCase() : ''}</strong> account on Gym Management SaaS has been suspended by the platform administrator.
            </p>
            <p style="font-size: 16px; color: #333;">
                While your account is suspended, all access to protected services, bookings, and schedules has been blocked.
            </p>
            <p style="font-size: 14px; color: #7f8c8d;">
                If you believe this is an error or would like to request account reinstatement, please contact support.
            </p>
            <hr style="border: none; border-top: 1px solid #e1e1e1; margin: 20px 0;" />
            <p style="font-size: 12px; color: #95a5a6; text-align: center;">
                &copy; ${new Date().getFullYear()} Gym Management System. All rights reserved.
            </p>
        </div>
    `;

    try {
        await transporter.sendMail({
            from: `"Gym Management Platform" <${envVeriables.EMAIL_USER}>`,
            to: userEmail,
            subject: 'Important Notice: Your Account has been Suspended',
            html: htmlContent,
        });
        console.log(`✅ Account suspension email sent to ${userEmail}`);
    } catch (error: any) {
        console.error('❌ Failed to send account suspension email:', error.message);
        throw error;
    }
};

const sendAccountActivatedEmail = async (
    userName: string,
    userEmail: string,
    role: string
) => {
    const htmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e1e1e1; border-radius: 8px;">
            <h2 style="color: #27ae60; text-align: center;">Account Activated 🎉</h2>
            <p style="font-size: 16px; color: #333;">Dear ${userName || 'User'},</p>
            <p style="font-size: 16px; color: #333;">
                Your <strong>${role ? role.toLowerCase() : ''}</strong> account on Gym Management SaaS has been activated!
            </p>
            <p style="font-size: 16px; color: #333;">
                You now have full access to log in and use all platform features.
            </p>
            <div style="text-align: center; margin: 30px 0;">
                <a href="${envVeriables.FRONTEND_URL}/login" style="background-color: #27ae60; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold;">
                    Log In to Your Account
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
            from: `"Gym Management Platform" <${envVeriables.EMAIL_USER}>`,
            to: userEmail,
            subject: 'Your Account has been Activated! 🎉',
            html: htmlContent,
        });
        console.log(`✅ Account activation email sent to ${userEmail}`);
    } catch (error: any) {
        console.error('❌ Failed to send account activation email:', error.message);
        throw error;
    }
};

const sendCertificationVerifiedEmail = async (
    trainerName: string,
    trainerEmail: string,
    certTitle?: string
) => {
    const htmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e1e1e1; border-radius: 8px;">
            <h2 style="color: #27ae60; text-align: center;">Certification Verified 🎉</h2>
            <p style="font-size: 16px; color: #333;">Dear ${trainerName || 'Trainer'},</p>
            <p style="font-size: 16px; color: #333;">
                Your submitted trainer certification${certTitle ? ` (<strong>${certTitle}</strong>)` : ''} has been reviewed and approved by the Super Admin.
            </p>
            <p style="font-size: 16px; color: #333;">
                Your Trainer verified badge is now active on your profile!
            </p>
            <div style="text-align: center; margin: 30px 0;">
                <a href="${envVeriables.FRONTEND_URL}/dashboard" style="background-color: #27ae60; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold;">
                    View Profile
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
            from: `"Gym Management Platform" <${envVeriables.EMAIL_USER}>`,
            to: trainerEmail,
            subject: 'Your Trainer Certification Has Been Verified! 🎉',
            html: htmlContent,
        });
        console.log(`✅ Certification verification email sent to ${trainerEmail}`);
    } catch (error: any) {
        console.error('❌ Failed to send certification verification email:', error.message);
        throw error;
    }
};

const sendCertificationRejectedEmail = async (
    trainerName: string,
    trainerEmail: string,
    certTitle?: string,
    reason?: string
) => {
    const htmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e1e1e1; border-radius: 8px;">
            <h2 style="color: #e74c3c; text-align: center;">Certification Rejected</h2>
            <p style="font-size: 16px; color: #333;">Dear ${trainerName || 'Trainer'},</p>
            <p style="font-size: 16px; color: #333;">
                Your submitted trainer certification${certTitle ? ` (<strong>${certTitle}</strong>)` : ''} was reviewed and rejected.
            </p>
            ${reason ? `<p style="font-size: 16px; color: #e74c3c;"><strong>Reason:</strong> ${reason}</p>` : ''}
            <p style="font-size: 14px; color: #7f8c8d;">
                If you believe this is an error, please ensure you upload a valid, unexpired certificate and re-submit.
            </p>
            <hr style="border: none; border-top: 1px solid #e1e1e1; margin: 20px 0;" />
            <p style="font-size: 12px; color: #95a5a6; text-align: center;">
                &copy; ${new Date().getFullYear()} Gym Management System. All rights reserved.
            </p>
        </div>
    `;

    try {
        await transporter.sendMail({
            from: `"Gym Management Platform" <${envVeriables.EMAIL_USER}>`,
            to: trainerEmail,
            subject: 'Your Trainer Certification Was Rejected',
            html: htmlContent,
        });
        console.log(`✅ Certification rejection email sent to ${trainerEmail}`);
    } catch (error: any) {
        console.error('❌ Failed to send certification rejection email:', error.message);
        throw error;
    }
};

const sendSubscriptionStatusUpdatedEmail = async (
    ownerName: string,
    ownerEmail: string,
    businessName: string,
    status: string,
    nextBillingDate?: Date | string | null
) => {
    const isOverdue = status === 'OVERDUE';
    const isActive = status === 'ACTIVE';
    const badgeColor = isActive ? '#27ae60' : isOverdue ? '#e67e22' : '#e74c3c';
    const statusTitle = isActive
        ? 'Subscription Active 🎉'
        : isOverdue
        ? 'Subscription Payment Overdue ⚠️'
        : 'Subscription Inactive';

    const statusMessage = isActive
        ? `Your gym subscription for <strong>${businessName}</strong> is now active. You have full access to all platform features.`
        : isOverdue
        ? `The subscription payment for <strong>${businessName}</strong> is currently overdue. Please settle the outstanding balance to maintain uninterrupted access to platform services.`
        : `Your gym subscription for <strong>${businessName}</strong> has been marked inactive by the platform administrator. Access to premium platform services has been suspended.`;

    const formattedBillingDate = nextBillingDate
        ? new Date(nextBillingDate).toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
          })
        : null;

    const htmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e1e1e1; border-radius: 8px;">
            <h2 style="color: ${badgeColor}; text-align: center;">${statusTitle}</h2>
            <p style="font-size: 16px; color: #333;">Dear ${ownerName || 'Business Owner'},</p>
            <p style="font-size: 16px; color: #333;">
                ${statusMessage}
            </p>
            <div style="background-color: #f8f9fa; border-radius: 6px; padding: 15px; margin: 20px 0;">
                <p style="margin: 5px 0; font-size: 14px; color: #555;"><strong>Business:</strong> ${businessName}</p>
                <p style="margin: 5px 0; font-size: 14px; color: #555;"><strong>Subscription Status:</strong> <span style="display: inline-block; padding: 2px 8px; border-radius: 4px; background-color: ${badgeColor}; color: #ffffff; font-weight: bold; font-size: 12px;">${status}</span></p>
                ${formattedBillingDate ? `<p style="margin: 5px 0; font-size: 14px; color: #555;"><strong>Next Billing Date:</strong> ${formattedBillingDate}</p>` : ''}
            </div>
            <div style="text-align: center; margin: 30px 0;">
                <a href="${envVeriables.FRONTEND_URL}/dashboard" style="background-color: #3498db; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold;">
                    Go to Dashboard
                </a>
            </div>
            <p style="font-size: 14px; color: #7f8c8d;">
                If you have any questions regarding your subscription or billing, please reply to this email or reach out to platform support.
            </p>
            <hr style="border: none; border-top: 1px solid #e1e1e1; margin: 20px 0;" />
            <p style="font-size: 12px; color: #95a5a6; text-align: center;">
                &copy; ${new Date().getFullYear()} Gym Management System. All rights reserved.
            </p>
        </div>
    `;

    try {
        await transporter.sendMail({
            from: `"Gym Management Platform" <${envVeriables.EMAIL_USER}>`,
            to: ownerEmail,
            subject: isActive
                ? `Your Subscription for ${businessName} is Active`
                : isOverdue
                ? `Action Required: Subscription Payment Overdue for ${businessName}`
                : `Update: Subscription Inactive for ${businessName}`,
            html: htmlContent,
        });
        console.log(`✅ Subscription status email (${status}) sent to ${ownerEmail}`);
    } catch (error: any) {
        console.error('❌ Failed to send subscription status email:', error.message);
        throw error;
    }
};

const sendDisputeResolvedEmail = async (
    userName: string,
    userEmail: string,
    disputeSubject: string,
    resolution: string,
    reason: string,
    refundInfo?: {
        paymentId?: string;
        amount?: number | string;
        currency?: string;
    }
) => {
    let resolutionTitle = 'Dispute Resolved';
    let resolutionBadgeColor = '#27ae60';
    let resolutionDescription = 'Your dispute has been reviewed and resolved by platform administration.';

    if (resolution === 'REFUND') {
        resolutionTitle = 'Dispute Resolved - Refund Initiated 💰';
        resolutionBadgeColor = '#27ae60';
        resolutionDescription = `A refund of ${refundInfo?.amount || ''} ${refundInfo?.currency || 'BDT'} has been successfully processed for your payment.`;
    } else if (resolution === 'WARNING') {
        resolutionTitle = 'Dispute Update - Administrative Warning ⚠️';
        resolutionBadgeColor = '#f39c12';
        resolutionDescription = 'Your dispute has been investigated and resolved with an official administrative warning.';
    } else if (resolution === 'ACCOUNT_ACTION') {
        resolutionTitle = 'Dispute Update - Account Action Taken 🛡️';
        resolutionBadgeColor = '#e74c3c';
        resolutionDescription = 'Following our dispute review, administrative action has been applied to the relevant account.';
    } else if (resolution === 'DISMISSAL') {
        resolutionTitle = 'Dispute Update - Dispute Dismissed ℹ️';
        resolutionBadgeColor = '#7f8c8d';
        resolutionDescription = 'Your dispute has been thoroughly reviewed and dismissed.';
    }

    const htmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e1e1e1; border-radius: 8px;">
            <div style="text-align: center; margin-bottom: 20px;">
                <span style="display: inline-block; background-color: ${resolutionBadgeColor}; color: #ffffff; padding: 6px 14px; border-radius: 20px; font-weight: bold; font-size: 14px;">
                    ${resolution}
                </span>
            </div>
            <h2 style="color: #2c3e50; text-align: center; margin-top: 0;">${resolutionTitle}</h2>
            <p style="font-size: 16px; color: #333;">Dear ${userName},</p>
            <p style="font-size: 16px; color: #333;">
                ${resolutionDescription}
            </p>
            <div style="background-color: #f8f9fa; border-left: 4px solid ${resolutionBadgeColor}; padding: 15px; margin: 20px 0; border-radius: 4px;">
                <p style="margin: 0 0 10px 0; font-size: 14px; color: #555;">
                    <strong>Dispute Subject:</strong> ${disputeSubject}
                </p>
                <p style="margin: 0; font-size: 14px; color: #555;">
                    <strong>Administrative Note / Reason:</strong> ${reason}
                </p>
                ${
                    refundInfo && refundInfo.amount
                        ? `<p style="margin: 10px 0 0 0; font-size: 14px; color: #27ae60; font-weight: bold;">Refund Amount: ${refundInfo.amount} ${refundInfo.currency || 'BDT'}</p>`
                        : ''
                }
            </div>
            <p style="font-size: 14px; color: #7f8c8d;">
                If you have any further questions regarding this resolution, please contact support.
            </p>
            <hr style="border: none; border-top: 1px solid #e1e1e1; margin: 20px 0;" />
            <p style="font-size: 12px; color: #95a5a6; text-align: center;">
                &copy; ${new Date().getFullYear()} Gym Management Platform. All rights reserved.
            </p>
        </div>
    `;

    try {
        await transporter.sendMail({
            from: `"Gym Management Platform" <${envVeriables.EMAIL_USER}>`,
            to: userEmail,
            subject: `Dispute Update: ${disputeSubject} [${resolution}]`,
            html: htmlContent,
        });
        console.log(`✅ Dispute resolution email (${resolution}) sent to ${userEmail}`);
    } catch (error: any) {
        console.error('❌ Failed to send dispute resolution email:', error.message);
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
    sendBusinessApprovedEmail,
    sendBusinessRejectedEmail,
    sendBusinessSuspendedEmail,
    sendAccountSuspendedEmail,
    sendAccountActivatedEmail,
    sendCertificationVerifiedEmail,
    sendCertificationRejectedEmail,
    sendSubscriptionStatusUpdatedEmail,
    sendDisputeResolvedEmail,
};
