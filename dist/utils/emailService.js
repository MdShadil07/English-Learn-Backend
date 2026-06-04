import { Resend } from 'resend';
function generateGoogleLinkingTemplate(data) {
    return `<!DOCTYPE html>
<html>
<body style="background-color: #f8fafc; font-family: 'Segoe UI', Inter, Arial, sans-serif; margin: 0; padding: 40px 0; -webkit-font-smoothing: antialiased;">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" role="presentation" style="background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06); margin: 0 20px;">
          <tr>
            <td height="6" style="background: linear-gradient(90deg, #f59e0b 0%, #f97316 100%);"></td>
          </tr>
          <tr>
            <td style="padding: 40px 40px 20px 40px; text-align: center;">
              <h1 style="margin: 0; color: #0f172a; font-size: 28px; font-weight: 800; letter-spacing: -0.5px;">CognitoSpeak</h1>
            </td>
          </tr>
          <tr>
            <td style="padding: 0 40px 40px 40px;">
              <h2 style="color: #0f172a; font-size: 22px; font-weight: 700; margin: 0 0 24px 0; text-align: center;">Account Verification</h2>
              <p style="color: #334155; font-size: 16px; line-height: 24px; margin: 0 0 24px 0;">Hi ${data.userName || 'there'},</p>
              <p style="color: #334155; font-size: 16px; line-height: 24px; margin: 0 0 32px 0;">You're almost there! We just need to verify your email address to securely link your Google account to CognitoSpeak. Please use the verification code below:</p>
              
              <div style="background-color: #f8fafc; border: 2px dashed #cbd5e1; border-radius: 12px; padding: 24px; text-align: center; margin-bottom: 32px;">
                <span style="font-family: 'Courier New', Courier, monospace; font-size: 36px; font-weight: 800; letter-spacing: 8px; color: #0f172a;">${data.verificationCode}</span>
              </div>

              <p style="color: #ef4444; font-size: 14px; line-height: 24px; margin: 0 0 32px 0; text-align: center; font-weight: 500;">⏱️ This code will expire at ${data.expiresAt}.</p>
              
              <p style="color: #64748b; font-size: 14px; line-height: 24px; margin: 0;">If you didn't attempt to link a Google account, please ignore this email and make sure your account is secure.</p>
            </td>
          </tr>
          <tr>
            <td style="background-color: #f1f5f9; padding: 32px 40px; text-align: center;">
              <p style="color: #64748b; font-size: 14px; line-height: 20px; margin: 0 0 12px 0;">© ${new Date().getFullYear()} CognitoSpeak. All rights reserved.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
function generateWelcomeTemplate(data) {
    return `<!DOCTYPE html>
<html>
<body style="background-color: #f8fafc; font-family: 'Segoe UI', Inter, Arial, sans-serif; margin: 0; padding: 40px 0; -webkit-font-smoothing: antialiased;">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" role="presentation" style="background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06); margin: 0 20px;">
          <tr>
            <td height="6" style="background: linear-gradient(90deg, #10b981 0%, #14b8a6 100%);"></td>
          </tr>
          <tr>
            <td style="padding: 40px 40px 20px 40px; text-align: center;">
              <h1 style="margin: 0; color: #0f172a; font-size: 28px; font-weight: 800; letter-spacing: -0.5px;">CognitoSpeak</h1>
            </td>
          </tr>
          <tr>
            <td style="padding: 0 40px 40px 40px;">
              <p style="color: #334155; font-size: 16px; line-height: 24px; margin: 0 0 24px 0;">Hi ${data.userName || 'there'},</p>
              <p style="color: #334155; font-size: 16px; line-height: 24px; margin: 0 0 32px 0;">Welcome to <strong>CognitoSpeak</strong>! We're thrilled to have you join our community. You've just taken the first step towards mastering English fluency with the power of artificial intelligence.</p>
              
              <h3 style="color: #0f172a; font-size: 18px; font-weight: 600; margin: 0 0 16px 0;">Here is what you can do next:</h3>
              <ul style="color: #334155; font-size: 16px; line-height: 24px; margin: 0 0 32px 0; padding-left: 20px;">
                <li style="margin-bottom: 12px;">🎙️ <strong>Real-time Speech Analysis:</strong> Practice speaking and get instant feedback on your pronunciation and clarity.</li>
                <li style="margin-bottom: 12px;">🧠 <strong>AI Tutor Sessions:</strong> Have lifelike conversations with our advanced AI to build your confidence.</li>
                <li style="margin-bottom: 12px;">📊 <strong>Fluency Scoring:</strong> Track your progress with detailed analytics and personalized recommendations.</li>
              </ul>

              <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin-bottom: 16px;">
                <tr>
                  <td align="center">
                    <a href="${data.appUrl || 'https://cognitolearn.dev'}" style="display: inline-block; background-color: #10b981; color: #ffffff; font-size: 16px; font-weight: 600; text-decoration: none; padding: 14px 32px; border-radius: 8px;">Start Learning Now</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="background-color: #f1f5f9; padding: 32px 40px; text-align: center;">
              <p style="color: #64748b; font-size: 14px; line-height: 20px; margin: 0 0 12px 0;">© ${new Date().getFullYear()} CognitoSpeak. All rights reserved.</p>
              <p style="color: #94a3b8; font-size: 12px; line-height: 18px; margin: 0;">You're receiving this email because you signed up for CognitoSpeak.<br>If you have any questions, reply to this email or contact our support team.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
function generatePasswordResetTemplate(data) {
    return `<!DOCTYPE html>
<html>
<body style="background-color: #f8fafc; font-family: 'Segoe UI', Inter, Arial, sans-serif; margin: 0; padding: 40px 0; -webkit-font-smoothing: antialiased;">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" role="presentation" style="background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06); margin: 0 20px;">
          <tr>
            <td height="6" style="background: linear-gradient(90deg, #3b82f6 0%, #2dd4bf 100%);"></td>
          </tr>
          <tr>
            <td style="padding: 40px 40px 20px 40px; text-align: center;">
              <h1 style="margin: 0; color: #0f172a; font-size: 28px; font-weight: 800; letter-spacing: -0.5px;">CognitoSpeak</h1>
            </td>
          </tr>
          <tr>
            <td style="padding: 0 40px 40px 40px;">
              <h2 style="color: #0f172a; font-size: 22px; font-weight: 700; margin: 0 0 24px 0; text-align: center;">Reset Your Password</h2>
              <p style="color: #334155; font-size: 16px; line-height: 24px; margin: 0 0 24px 0;">Hi ${data.userName || 'there'},</p>
              <p style="color: #334155; font-size: 16px; line-height: 24px; margin: 0 0 32px 0;">We received a request to reset the password for your CognitoSpeak account. Don't worry, it happens to the best of us. Click the button below to choose a new password.</p>
              
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin-bottom: 32px;">
                <tr>
                  <td align="center">
                    <a href="${data.resetUrl}" style="display: inline-block; background-color: #0f172a; color: #ffffff; font-size: 16px; font-weight: 600; text-decoration: none; padding: 14px 32px; border-radius: 8px;">Reset Password</a>
                  </td>
                </tr>
              </table>

              <p style="color: #64748b; font-size: 14px; line-height: 24px; margin: 0 0 16px 0;">If the button above doesn't work, copy and paste the following link into your browser:</p>
              <p style="color: #3b82f6; font-size: 14px; line-height: 20px; margin: 0 0 32px 0; word-break: break-all;"><a href="${data.resetUrl}" style="color: #3b82f6; text-decoration: underline;">${data.resetUrl}</a></p>
              
              <p style="color: #64748b; font-size: 14px; line-height: 24px; margin: 0;">If you didn't request a password reset, you can safely ignore this email. Your password will remain unchanged.</p>
            </td>
          </tr>
          <tr>
            <td style="background-color: #f1f5f9; padding: 32px 40px; text-align: center;">
              <p style="color: #64748b; font-size: 14px; line-height: 20px; margin: 0 0 12px 0;">© ${new Date().getFullYear()} CognitoSpeak. All rights reserved.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
const resend = new Resend(process.env.RESEND_API_KEY || 're_default');
export async function sendEmail(options) {
    try {
        // Initialize transporter if not already done (now async)
        // Normalize template data and generate HTML content
        const templateData = options.data || {};
        let htmlContent = options.html;
        if (options.template && !htmlContent) {
            if (options.template === 'google-linking-verification') {
                htmlContent = generateGoogleLinkingTemplate(templateData);
            }
            else if (options.template === 'welcome') {
                htmlContent = generateWelcomeTemplate(templateData);
            }
            else if (options.template === 'password-reset') {
                htmlContent = generatePasswordResetTemplate(templateData);
            }
        }
        // If template generation failed for some reason, fallback to a minimal body
        if (!htmlContent && options.text) {
            htmlContent = `<pre>${options.text}</pre>`;
        }
        // Log template inputs for diagnostics (avoid logging secrets)
        try {
            console.log('Email template data keys:', Object.keys(templateData));
        }
        catch (e) {
            // ignore
        }
        // Always send actual email in development (user requested)
        console.log('\n');
        console.log('╔══════════════════════════════════════════════════════════════════════════════╗');
        console.log('║                          EMAIL SERVICE - SENDING EMAIL                      ║');
        console.log('╚══════════════════════════════════════════════════════════════════════════════╝');
        console.log(`📧 To: ${options.to}`);
        console.log(`📝 Subject: ${options.subject}`);
        console.log(`📄 Template: ${options.template || 'custom'}`);
        if (options.template === 'google-linking-verification') {
            console.log('\n🔐 GOOGLE ACCOUNT LINKING VERIFICATION');
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            console.log(`👤 User: ${templateData.userName}`);
            console.log(`📋 Your Verification Code: ${templateData.verificationCode}`);
            console.log(`⏰ Expires At: ${templateData.expiresAt}`);
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
        }
        else if (options.template === 'welcome') {
            console.log('\n🎉 WELCOME EMAIL');
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            console.log(`👤 User: ${templateData.userName}`);
            console.log(`📧 Email: ${options.to}`);
            console.log('\n📚 Welcome to English Learning Platform!');
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
        }
        // Send actual email using Resend
        const { data, error } = await resend.emails.send({
            from: process.env.EMAIL_FROM || 'onboarding@resend.dev',
            to: options.to,
            subject: options.subject,
            html: htmlContent || '',
            text: options.text || '',
        });
        if (error) {
            console.error('Email sending error:', error);
            throw new Error(`Failed to send email: ${error.message}`);
        }
        console.log('Email sent successfully via Resend!');
        console.log(`Message ID: ${data?.id}`);
    }
    catch (err) {
        console.error('Unexpected error in sendEmail:', err);
        throw err;
    }
}
//# sourceMappingURL=emailService.js.map