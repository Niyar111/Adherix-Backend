import nodemailer from 'nodemailer';

/**
 * @desc    Configure and send the Guardian Invitation Email
 * @task    Phase 4: Invitation Handshake
 */
export const sendInviteEmail = async (email, inviteUrl, patientName) => {
    const transporter = nodemailer.createTransport({
        service: 'gmail', 
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS 
        }
    });

    const mailOptions = {
        from: `"Adherix Care" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: `Care Circle Invite: Help ${patientName} track their health`,
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; border: 1px solid #eee; padding: 20px;">
                <h2 style="color: #2ecc71;">Join the Care Circle</h2>
                <p>Hello,</p>
                <p><strong>${patientName}</strong> has invited you to become their Guardian on Adherix.</p>
                <p>As a Guardian, you can monitor their medication adherence and receive alerts for missed doses.</p>
                <div style="margin: 30px 0;">
                    <a href="${inviteUrl}" 
                       style="background-color: #2ecc71; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-weight: bold;">
                       Accept Invitation
                    </a>
                </div>
                <p style="color: #e74c3c; font-size: 0.8em;">Note: This invitation link will expire in 24 hours for security purposes.</p>
                <hr style="border: 0; border-top: 1px solid #eee;" />
                <p style="font-size: 0.8em; color: #999;">If you didn't expect this invitation, you can safely ignore this email.</p>
            </div>
        `
    };

    return await transporter.sendMail(mailOptions);
};

/**
 * @desc    Send an emergency alert for a missed dose
 * @task    Phase 4: Guardian Alert Engine
 */
export const sendAlertEmail = async (guardianEmail, patientName, medName, scheduledTime) => {
    const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS
        }
    });

    const mailOptions = {
        from: `"Adherix Emergency" <${process.env.EMAIL_USER}>`,
        to: guardianEmail,
        subject: `⚠️ URGENT: ${patientName} missed a dose`,
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; border: 2px solid #e74c3c; padding: 20px;">
                <h2 style="color: #e74c3c;">Adherence Alert</h2>
                <p>Hello,</p>
                <p>Our system detected that <strong>${patientName}</strong> did not log their medication on time.</p>
                <hr style="border: 0; border-top: 1px solid #eee;" />
                <p><strong>Medication:</strong> ${medName}</p>
                <p><strong>Scheduled Time:</strong> ${scheduledTime}</p>
                <hr style="border: 0; border-top: 1px solid #eee;" />
                <p>Please check in with <strong>${patientName}</strong> to ensure they are safe and have taken their dose.</p>
                <p style="font-size: 0.8em; color: #666; margin-top: 20px;">This is an automated emergency alert from Adherix Care.</p>
            </div>
        `
    };

    return await transporter.sendMail(mailOptions);
};