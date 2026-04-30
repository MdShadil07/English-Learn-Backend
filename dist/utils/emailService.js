import nodemailer from 'nodemailer';
// Create nodemailer transporter
const createTransporter = () => {
    // Check if SMTP configuration is available
    const smtpHost = process.env.SMTP_HOST;
    const smtpPort = process.env.SMTP_PORT;
    const smtpUser = process.env.SMTP_USER;
    const smtpPass = process.env.SMTP_PASS;
    if (smtpHost && smtpPort && smtpUser && smtpPass) {
        // Use configured SMTP server
        return nodemailer.createTransport({
            host: smtpHost,
            port: parseInt(smtpPort),
            secure: parseInt(smtpPort) === 465, // true for 465, false for other ports
            auth: {
                user: smtpUser,
                pass: smtpPass,
            },
        });
    }
    else {
        // Fallback to Ethereal Email for testing (creates a test account)
        console.log('⚠️  SMTP not configured, using Ethereal Email for testing');
        return nodemailer.createTransport({
            host: 'smtp.ethereal.email',
            port: 587,
            auth: {
                user: process.env.ETHEREAL_USER || 'test@ethereal.email',
                pass: process.env.ETHEREAL_PASS || 'testpass',
            },
        });
    }
};
let transporter = null;
// Email service for development and production
export async function sendEmail(options) {
    try {
        // Initialize transporter if not already done
        if (!transporter) {
            transporter = createTransporter();
        }
        // Generate HTML content based on template
        let htmlContent = options.html;
        if (options.template && !htmlContent) {
            if (options.template === 'google-linking-verification') {
                htmlContent = generateGoogleLinkingTemplate(options.data);
            }
            else if (options.template === 'welcome') {
                htmlContent = generateWelcomeTemplate(options.data);
            }
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
            console.log(`👤 User: ${options.data?.userName}`);
            console.log(`📋 Your Verification Code: ${options.data?.verificationCode}`);
            console.log(`⏰ Expires At: ${options.data?.expiresAt}`);
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
        }
        else if (options.template === 'welcome') {
            console.log('\n🎉 WELCOME EMAIL');
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            console.log(`👤 User: ${options.data?.userName}`);
            console.log(`📧 Email: ${options.to}`);
            console.log('\n📚 Welcome to English Learning Platform!');
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
        }
        // Send actual email
        const mailOptions = {
            from: process.env.EMAIL_FROM || 'English Learning Platform <noreply@englishlearning.com>',
            to: options.to,
            subject: options.subject,
            html: htmlContent,
            text: options.text,
        };
        const info = await transporter.sendMail(mailOptions);
        console.log('✅ Email sent successfully!');
        console.log(`� Message ID: ${info.messageId}`);
        if (process.env.SMTP_HOST?.includes('ethereal')) {
            console.log(`� Preview URL: ${nodemailer.getTestMessageUrl(info)}`);
        }
        console.log('╔══════════════════════════════════════════════════════════════════════════════╗');
        console.log('║                            END EMAIL SERVICE                                 ║');
        console.log('╚══════════════════════════════════════════════════════════════════════════════╝\n');
    }
    catch (error) {
        console.error('❌ Email service error:', error);
        throw error;
    }
}
function generateGoogleLinkingTemplate(data) {
    const appUrl = data.appUrl || 'http://localhost:5173';
    const currentYear = new Date().getFullYear();
    return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <meta name="color-scheme" content="light dark">
        <meta name="supported-color-schemes" content="light dark">
        <title>Verify Google Account Linking — CognitoSpeak</title>
        <style>
            /* Base resets */
            body, table, td, p, a, li, blockquote { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
            table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
            img { -ms-interpolation-mode: bicubic; border: 0; outline: none; text-decoration: none; }
            
            body {
                margin: 0 !important;
                padding: 0 !important;
                background-color: #f8fafc;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
                line-height: 1.6;
                color: #1e293b;
            }
            
            .email-wrapper {
                width: 100%;
                max-width: 640px;
                margin: 0 auto;
                background-color: #f8fafc;
            }
            
            /* Hero Section */
            .hero {
                background: linear-gradient(135deg, #10b981 0%, #14b8a6 50%, #0ea5e9 100%);
                padding: 48px 32px;
                text-align: center;
                border-radius: 0 0 32px 32px;
                position: relative;
                overflow: hidden;
            }
            
            .hero::before {
                content: '';
                position: absolute;
                top: -50%;
                left: -50%;
                width: 200%;
                height: 200%;
                background: radial-gradient(circle at 30% 50%, rgba(255,255,255,0.15) 0%, transparent 60%);
                pointer-events: none;
            }
            
            .hero-content {
                position: relative;
                z-index: 1;
            }
            
            .hero h1 {
                font-size: 28px;
                font-weight: 800;
                color: #ffffff;
                margin: 0 0 12px 0;
                line-height: 1.2;
                letter-spacing: -0.02em;
            }
            
            .hero .subtitle {
                font-size: 16px;
                color: rgba(255,255,255,0.95);
                margin: 0 0 24px 0;
                font-weight: 500;
            }
            
            .hero-badge {
                display: inline-flex;
                align-items: center;
                gap: 8px;
                background: rgba(255,255,255,0.2);
                backdrop-filter: blur(8px);
                border: 1px solid rgba(255,255,255,0.3);
                padding: 8px 16px;
                border-radius: 9999px;
                font-size: 13px;
                font-weight: 600;
                color: #ffffff;
            }
            
            /* Content Sections */
            .content {
                padding: 40px 32px;
            }
            
            .section {
                margin-bottom: 32px;
            }
            
            .greeting {
                font-size: 18px;
                font-weight: 700;
                color: #0f172a;
                margin: 0 0 16px 0;
            }
            
            .lead {
                font-size: 15px;
                color: #475569;
                margin: 0 0 24px 0;
                line-height: 1.7;
            }
            
            /* Verification Code Box */
            .code-box {
                background: linear-gradient(135deg, #ecfdf5 0%, #f0fdfa 100%);
                border: 2px solid #d1fae5;
                border-radius: 20px;
                padding: 32px;
                text-align: center;
                margin: 32px 0;
                box-shadow: 0 4px 14px rgba(16, 185, 129, 0.1);
            }
            
            .code-label {
                font-size: 13px;
                font-weight: 700;
                text-transform: uppercase;
                letter-spacing: 0.1em;
                color: #64748b;
                margin: 0 0 16px 0;
            }
            
            .code {
                font-size: 36px;
                font-weight: 800;
                color: #059669;
                letter-spacing: 0.1em;
                margin: 0 0 12px 0;
                line-height: 1;
            }
            
            .code-hint {
                font-size: 13px;
                color: #64748b;
                margin: 0;
            }
            
            /* Warning Box */
            .warning-box {
                background: #fef3c7;
                border-left: 4px solid #f59e0b;
                border-radius: 12px;
                padding: 20px;
                margin: 24px 0;
            }
            
            .warning-box p {
                font-size: 14px;
                color: #92400e;
                margin: 0;
                line-height: 1.6;
            }
            
            /* Footer */
            .footer {
                text-align: center;
                padding: 32px;
                background: #f1f5f9;
                border-radius: 24px 24px 0 0;
            }
            
            .footer-brand {
                font-size: 18px;
                font-weight: 800;
                color: #0f172a;
                margin: 0 0 4px 0;
            }
            
            .footer-tagline {
                font-size: 13px;
                color: #64748b;
                margin: 0 0 20px 0;
            }
            
            .footer-text {
                font-size: 13px;
                color: #94a3b8;
                margin: 0;
            }
            
            /* Dark mode support */
            @media (prefers-color-scheme: dark) {
                body { background-color: #0f172a !important; }
                .email-wrapper { background-color: #0f172a !important; }
                .greeting { color: #f1f5f9 !important; }
                .lead { color: #cbd5e1 !important; }
                .code-box { background: #064e3b !important; border-color: #065f46 !important; }
                .code { color: #34d399 !important; }
                .code-label { color: #94a3b8 !important; }
                .code-hint { color: #94a3b8 !important; }
                .warning-box { background: #78350f !important; border-color: #b45309 !important; }
                .warning-box p { color: #fcd34d !important; }
                .footer { background: #1e293b !important; }
                .footer-brand { color: #f1f5f9 !important; }
            }
            
            /* Mobile */
            @media screen and (max-width: 600px) {
                .hero { padding: 36px 24px !important; border-radius: 0 0 24px 24px !important; }
                .hero h1 { font-size: 24px !important; }
                .content { padding: 28px 20px !important; }
                .code { font-size: 28px !important; }
            }
        </style>
    </head>
    <body>
        <div class="email-wrapper">
            
            <!-- Hero -->
            <div class="hero">
                <div class="hero-content">
                    <!-- Inline SVG Logo for email compatibility -->
                    <div style="text-align: center; margin-bottom: 24px;">
                        <svg width="48" height="48" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" style="display: block; margin: 0 auto 16px auto;">
                            <defs>
                                <linearGradient id="bgGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                                    <stop offset="0%" style="stop-color:#1a1a1a;stop-opacity:1" />
                                    <stop offset="100%" style="stop-color:#000000;stop-opacity:1" />
                                </linearGradient>
                            </defs>
                            <circle cx="50" cy="50" r="45" fill="url(#bgGradient)" stroke="white" stroke-width="2" stroke-opacity="0.8"/>
                            <g transform="translate(50, 50)">
                                <circle cx="0" cy="-20" r="3" fill="white" opacity="0.9"/>
                                <circle cx="15" cy="-12" r="2.5" fill="white" opacity="0.8"/>
                                <circle cx="-15" cy="-12" r="2.5" fill="white" opacity="0.8"/>
                                <circle cx="20" cy="0" r="2" fill="white" opacity="0.7"/>
                                <circle cx="-20" cy="0" r="2" fill="white" opacity="0.7"/>
                                <circle cx="12" cy="15" r="2.5" fill="white" opacity="0.8"/>
                                <circle cx="-12" cy="15" r="2.5" fill="white" opacity="0.8"/>
                                <circle cx="0" cy="20" r="3" fill="white" opacity="0.9"/>
                                <path d="M0,-20 Q7.5,-16 15,-12" stroke="white" stroke-width="1.5" stroke-opacity="0.6" fill="none"/>
                                <path d="M0,-20 Q-7.5,-16 -15,-12" stroke="white" stroke-width="1.5" stroke-opacity="0.6" fill="none"/>
                                <path d="M15,-12 Q17.5,-6 20,0" stroke="white" stroke-width="1.2" stroke-opacity="0.5" fill="none"/>
                                <path d="M-15,-12 Q-17.5,-6 -20,0" stroke="white" stroke-width="1.2" stroke-opacity="0.5" fill="none"/>
                                <path d="M20,0 Q9,7.5 12,15" stroke="white" stroke-width="1.2" stroke-opacity="0.5" fill="none"/>
                                <path d="M-20,0 Q-9,7.5 -12,15" stroke="white" stroke-width="1.2" stroke-opacity="0.5" fill="none"/>
                                <path d="M12,15 Q6,17.5 0,20" stroke="white" stroke-width="1.5" stroke-opacity="0.6" fill="none"/>
                                <path d="M-12,15 Q-6,17.5 0,20" stroke="white" stroke-width="1.5" stroke-opacity="0.6" fill="none"/>
                                <circle cx="0" cy="0" r="8" fill="none" stroke="white" stroke-width="2" stroke-opacity="0.7"/>
                                <circle cx="0" cy="0" r="3" fill="white"/>
                                <circle cx="0" cy="0" r="1.5" fill="black"/>
                            </g>
                            <g transform="translate(75, 50)" opacity="0.7">
                                <path d="M0,-8 Q3,-8 3,-4 Q3,0 0,0 Q-3,0 -3,-4 Q-3,-8 0,-8" fill="none" stroke="white" stroke-width="2" stroke-linecap="round"/>
                                <path d="M6,-10 Q9,-10 9,-5 Q9,0 6,0 Q3,0 3,-5 Q3,-10 6,-10" fill="none" stroke="white" stroke-width="1.5" stroke-linecap="round" opacity="0.6"/>
                                <path d="M12,-12 Q15,-12 15,-6 Q15,0 12,0 Q9,0 9,-6 Q9,-12 12,-12" fill="none" stroke="white" stroke-width="1" stroke-linecap="round" opacity="0.4"/>
                            </g>
                            <circle cx="25" cy="25" r="1" fill="white" opacity="0.3"/>
                            <circle cx="75" cy="75" r="1" fill="white" opacity="0.3"/>
                            <circle cx="75" cy="25" r="0.8" fill="white" opacity="0.4"/>
                            <circle cx="25" cy="75" r="0.8" fill="white" opacity="0.4"/>
                        </svg>
                        <div style="font-size: 24px; font-weight: 800; background: linear-gradient(135deg, #0f172a 0%, #059669 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; letter-spacing: -0.02em; margin-bottom: 4px;">
                            CognitoSpeak
                        </div>
                        <div style="font-size: 12px; color: #10b981; font-weight: 600; letter-spacing: 0.05em; text-transform: uppercase;">
                            AI-Powered Learning
                        </div>
                    </div>
                    <h1>Verify Google Account</h1>
                    <p class="subtitle">Link your Google account to continue</p>
                    <div class="hero-badge">
                        <span style="font-size:16px;">🔐</span>
                        <span>Security Verification</span>
                    </div>
                </div>
            </div>
            
            <!-- Main Content -->
            <div class="content">
                
                <!-- Greeting -->
                <div class="section">
                    <p class="greeting">Hi ${data.userName},</p>
                    <p class="lead">
                        You requested to link your Google account to your CognitoSpeak profile. To complete this process securely, please use the verification code below:
                    </p>
                </div>
                
                <!-- Verification Code -->
                <div class="code-box">
                    <p class="code-label">Your Verification Code</p>
                    <p class="code">${data.verificationCode}</p>
                    <p class="code-hint">This code expires at <strong>${data.expiresAt}</strong></p>
                </div>
                
                <!-- Warning -->
                <div class="warning-box">
                    <p>
                        <strong>⚠️ Security Notice:</strong> Never share this code with anyone. Our team will never ask for your verification code. If you didn't request this, please ignore this email.
                    </p>
                </div>
                
                <!-- Instructions -->
                <div class="section">
                    <p class="lead" style="margin-bottom: 16px;">
                        <strong>How to use this code:</strong>
                    </p>
                    <ul style="list-style: none; padding: 0; margin: 0;">
                        <li style="padding: 12px 0; border-bottom: 1px solid #e2e8f0; color: #475569; font-size: 14px;">
                            <span style="color: #10b981; font-weight: 700; margin-right: 8px;">1.</span>
                            Return to the CognitoSpeak app
                        </li>
                        <li style="padding: 12px 0; border-bottom: 1px solid #e2e8f0; color: #475569; font-size: 14px;">
                            <span style="color: #10b981; font-weight: 700; margin-right: 8px;">2.</span>
                            Go to Profile → Link Google Account
                        </li>
                        <li style="padding: 12px 0; color: #475569; font-size: 14px;">
                            <span style="color: #10b981; font-weight: 700; margin-right: 8px;">3.</span>
                            Enter this code when prompted
                        </li>
                    </ul>
                </div>
                
                <!-- Closing -->
                <div class="section" style="text-align: center; padding: 16px 0;">
                    <p style="font-size: 15px; color: #475569; margin: 0 0 8px 0;">
                        Need help? Contact our support team.
                    </p>
                    <p style="font-size: 15px; color: #64748b; margin: 0; font-style: italic;">
                        Best regards,<br>
                        <strong style="color: #0f172a;">The CognitoSpeak Team</strong>
                    </p>
                </div>
                
            </div>
            
            <!-- Footer -->
            <div class="footer">
                <p class="footer-brand">CognitoSpeak</p>
                <p class="footer-tagline">AI-Powered Learning</p>
                <p class="footer-text">
                    © ${currentYear} CognitoSpeak. All rights reserved.<br>
                    This is an automated message. Please do not reply.
                </p>
            </div>
            
        </div>
    </body>
    </html>
  `;
}
function generateWelcomeTemplate(data) {
    const appUrl = data.appUrl || 'http://localhost:5173';
    const currentYear = new Date().getFullYear();
    return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <meta name="color-scheme" content="light dark">
        <meta name="supported-color-schemes" content="light dark">
        <title>Welcome to CognitoSpeak — Your AI English Coach</title>
        <style>
            /* Base resets */
            body, table, td, p, a, li, blockquote { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
            table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
            img { -ms-interpolation-mode: bicubic; border: 0; outline: none; text-decoration: none; }
            
            /* Root variables */
            :root {
                color-scheme: light dark;
            }
            
            body {
                margin: 0 !important;
                padding: 0 !important;
                background-color: #f8fafc;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
                line-height: 1.6;
                color: #1e293b;
            }
            
            .email-wrapper {
                width: 100%;
                max-width: 640px;
                margin: 0 auto;
                background-color: #f8fafc;
            }
            
            /* Hero Section */
            .hero {
                background: linear-gradient(135deg, #10b981 0%, #14b8a6 50%, #0ea5e9 100%);
                padding: 48px 32px;
                text-align: center;
                border-radius: 0 0 32px 32px;
                position: relative;
                overflow: hidden;
            }
            
            .hero::before {
                content: '';
                position: absolute;
                top: -50%;
                left: -50%;
                width: 200%;
                height: 200%;
                background: radial-gradient(circle at 30% 50%, rgba(255,255,255,0.15) 0%, transparent 60%);
                pointer-events: none;
            }
            
            .hero-content {
                position: relative;
                z-index: 1;
            }
            
            .logo-text {
                font-size: 14px;
                font-weight: 700;
                letter-spacing: 0.15em;
                text-transform: uppercase;
                color: rgba(255,255,255,0.9);
                margin-bottom: 24px;
            }
            
            .hero h1 {
                font-size: 32px;
                font-weight: 800;
                color: #ffffff;
                margin: 0 0 12px 0;
                line-height: 1.2;
                letter-spacing: -0.02em;
            }
            
            .hero .subtitle {
                font-size: 18px;
                color: rgba(255,255,255,0.95);
                margin: 0 0 32px 0;
                font-weight: 500;
            }
            
            .hero-badge {
                display: inline-flex;
                align-items: center;
                gap: 8px;
                background: rgba(255,255,255,0.2);
                backdrop-filter: blur(8px);
                border: 1px solid rgba(255,255,255,0.3);
                padding: 8px 16px;
                border-radius: 9999px;
                font-size: 13px;
                font-weight: 600;
                color: #ffffff;
            }
            
            /* Content Sections */
            .content {
                padding: 40px 32px;
            }
            
            .section {
                margin-bottom: 40px;
            }
            
            .section-title {
                font-size: 13px;
                font-weight: 700;
                text-transform: uppercase;
                letter-spacing: 0.1em;
                color: #64748b;
                margin: 0 0 20px 0;
            }
            
            .greeting {
                font-size: 20px;
                font-weight: 700;
                color: #0f172a;
                margin: 0 0 16px 0;
            }
            
            .lead {
                font-size: 16px;
                color: #475569;
                margin: 0 0 24px 0;
                line-height: 1.7;
            }
            
            /* Feature Cards Grid */
            .features-grid {
                display: table;
                width: 100%;
                border-spacing: 0;
                border-collapse: separate;
            }
            
            .feature-row {
                display: table-row;
            }
            
            .feature-cell {
                display: table-cell;
                width: 50%;
                padding: 8px;
                vertical-align: top;
            }
            
            .feature-card {
                background: #ffffff;
                border-radius: 20px;
                padding: 24px;
                border: 1px solid #e2e8f0;
                height: 100%;
                box-shadow: 0 1px 3px rgba(0,0,0,0.04);
            }
            
            .feature-icon {
                width: 44px;
                height: 44px;
                border-radius: 14px;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 20px;
                margin-bottom: 16px;
            }
            
            .feature-card h3 {
                font-size: 15px;
                font-weight: 700;
                color: #0f172a;
                margin: 0 0 8px 0;
            }
            
            .feature-card p {
                font-size: 14px;
                color: #64748b;
                margin: 0;
                line-height: 1.6;
            }
            
            /* Stats Bar */
            .stats-bar {
                background: linear-gradient(135deg, #ecfdf5 0%, #f0fdfa 100%);
                border: 1px solid #d1fae5;
                border-radius: 16px;
                padding: 24px;
                text-align: center;
                margin: 32px 0;
            }
            
            .stats-grid {
                display: table;
                width: 100%;
            }
            
            .stats-row {
                display: table-row;
            }
            
            .stat-cell {
                display: table-cell;
                width: 33.333%;
                text-align: center;
                padding: 0 8px;
            }
            
            .stat-number {
                font-size: 28px;
                font-weight: 800;
                color: #059669;
                margin: 0;
                line-height: 1;
            }
            
            .stat-label {
                font-size: 12px;
                font-weight: 600;
                color: #10b981;
                text-transform: uppercase;
                letter-spacing: 0.05em;
                margin: 8px 0 0 0;
            }
            
            /* CTA Section */
            .cta-section {
                text-align: center;
                padding: 32px;
                background: #ffffff;
                border-radius: 24px;
                border: 1px solid #e2e8f0;
                margin: 32px 0;
            }
            
            .cta-section h2 {
                font-size: 22px;
                font-weight: 800;
                color: #0f172a;
                margin: 0 0 12px 0;
            }
            
            .cta-section p {
                font-size: 15px;
                color: #64748b;
                margin: 0 0 24px 0;
            }
            
            .cta-button {
                display: inline-block;
                background: linear-gradient(135deg, #10b981 0%, #0ea5e9 100%);
                color: #ffffff !important;
                text-decoration: none;
                padding: 16px 36px;
                border-radius: 9999px;
                font-size: 16px;
                font-weight: 700;
                box-shadow: 0 4px 14px rgba(16, 185, 129, 0.3);
                transition: transform 0.2s;
            }
            
            .cta-button:hover {
                transform: translateY(-2px);
            }
            
            .secondary-links {
                margin-top: 20px;
                font-size: 14px;
                color: #64748b;
            }
            
            .secondary-links a {
                color: #0ea5e9;
                text-decoration: none;
                font-weight: 600;
                margin: 0 8px;
            }
            
            /* Tips Section */
            .tips-list {
                list-style: none;
                padding: 0;
                margin: 0;
            }
            
            .tips-list li {
                position: relative;
                padding-left: 32px;
                margin-bottom: 16px;
                font-size: 15px;
                color: #475569;
                line-height: 1.6;
            }
            
            .tips-list li::before {
                content: '✓';
                position: absolute;
                left: 0;
                top: 2px;
                width: 22px;
                height: 22px;
                background: #d1fae5;
                color: #059669;
                border-radius: 50%;
                font-size: 12px;
                font-weight: 700;
                display: flex;
                align-items: center;
                justify-content: center;
            }
            
            /* Footer */
            .footer {
                text-align: center;
                padding: 32px;
                background: #f1f5f9;
                border-radius: 24px 24px 0 0;
            }
            
            .footer-brand {
                font-size: 18px;
                font-weight: 800;
                color: #0f172a;
                margin: 0 0 4px 0;
            }
            
            .footer-tagline {
                font-size: 13px;
                color: #64748b;
                margin: 0 0 20px 0;
            }
            
            .footer-text {
                font-size: 13px;
                color: #94a3b8;
                margin: 0;
            }
            
            /* Dark mode support */
            @media (prefers-color-scheme: dark) {
                body { background-color: #0f172a !important; }
                .email-wrapper { background-color: #0f172a !important; }
                .feature-card { background: #1e293b !important; border-color: #334155 !important; }
                .feature-card h3 { color: #f1f5f9 !important; }
                .feature-card p { color: #94a3b8 !important; }
                .greeting { color: #f1f5f9 !important; }
                .lead { color: #cbd5e1 !important; }
                .cta-section { background: #1e293b !important; border-color: #334155 !important; }
                .cta-section h2 { color: #f1f5f9 !important; }
                .cta-section p { color: #94a3b8 !important; }
                .footer { background: #1e293b !important; }
                .footer-brand { color: #f1f5f9 !important; }
            }
            
            /* Mobile */
            @media screen and (max-width: 600px) {
                .hero { padding: 36px 24px !important; border-radius: 0 0 24px 24px !important; }
                .hero h1 { font-size: 26px !important; }
                .content { padding: 28px 20px !important; }
                .feature-cell { display: block !important; width: 100% !important; padding: 8px 0 !important; }
                .stat-cell { display: block !important; width: 100% !important; padding: 12px 0 !important; }
                .stats-bar { padding: 20px !important; }
            }
        </style>
    </head>
    <body>
        <div class="email-wrapper">
            
            <!-- Hero -->
            <div class="hero">
                <div class="hero-content">
                    <!-- Inline SVG Logo for email compatibility -->
                    <div style="text-align: center; margin-bottom: 24px;">
                        <svg width="48" height="48" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" style="display: block; margin: 0 auto 16px auto;">
                            <defs>
                                <linearGradient id="bgGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                                    <stop offset="0%" style="stop-color:#1a1a1a;stop-opacity:1" />
                                    <stop offset="100%" style="stop-color:#000000;stop-opacity:1" />
                                </linearGradient>
                            </defs>
                            <circle cx="50" cy="50" r="45" fill="url(#bgGradient)" stroke="white" stroke-width="2" stroke-opacity="0.8"/>
                            <g transform="translate(50, 50)">
                                <circle cx="0" cy="-20" r="3" fill="white" opacity="0.9"/>
                                <circle cx="15" cy="-12" r="2.5" fill="white" opacity="0.8"/>
                                <circle cx="-15" cy="-12" r="2.5" fill="white" opacity="0.8"/>
                                <circle cx="20" cy="0" r="2" fill="white" opacity="0.7"/>
                                <circle cx="-20" cy="0" r="2" fill="white" opacity="0.7"/>
                                <circle cx="12" cy="15" r="2.5" fill="white" opacity="0.8"/>
                                <circle cx="-12" cy="15" r="2.5" fill="white" opacity="0.8"/>
                                <circle cx="0" cy="20" r="3" fill="white" opacity="0.9"/>
                                <path d="M0,-20 Q7.5,-16 15,-12" stroke="white" stroke-width="1.5" stroke-opacity="0.6" fill="none"/>
                                <path d="M0,-20 Q-7.5,-16 -15,-12" stroke="white" stroke-width="1.5" stroke-opacity="0.6" fill="none"/>
                                <path d="M15,-12 Q17.5,-6 20,0" stroke="white" stroke-width="1.2" stroke-opacity="0.5" fill="none"/>
                                <path d="M-15,-12 Q-17.5,-6 -20,0" stroke="white" stroke-width="1.2" stroke-opacity="0.5" fill="none"/>
                                <path d="M20,0 Q9,7.5 12,15" stroke="white" stroke-width="1.2" stroke-opacity="0.5" fill="none"/>
                                <path d="M-20,0 Q-9,7.5 -12,15" stroke="white" stroke-width="1.2" stroke-opacity="0.5" fill="none"/>
                                <path d="M12,15 Q6,17.5 0,20" stroke="white" stroke-width="1.5" stroke-opacity="0.6" fill="none"/>
                                <path d="M-12,15 Q-6,17.5 0,20" stroke="white" stroke-width="1.5" stroke-opacity="0.6" fill="none"/>
                                <circle cx="0" cy="0" r="8" fill="none" stroke="white" stroke-width="2" stroke-opacity="0.7"/>
                                <circle cx="0" cy="0" r="3" fill="white"/>
                                <circle cx="0" cy="0" r="1.5" fill="black"/>
                            </g>
                            <g transform="translate(75, 50)" opacity="0.7">
                                <path d="M0,-8 Q3,-8 3,-4 Q3,0 0,0 Q-3,0 -3,-4 Q-3,-8 0,-8" fill="none" stroke="white" stroke-width="2" stroke-linecap="round"/>
                                <path d="M6,-10 Q9,-10 9,-5 Q9,0 6,0 Q3,0 3,-5 Q3,-10 6,-10" fill="none" stroke="white" stroke-width="1.5" stroke-linecap="round" opacity="0.6"/>
                                <path d="M12,-12 Q15,-12 15,-6 Q15,0 12,0 Q9,0 9,-6 Q9,-12 12,-12" fill="none" stroke="white" stroke-width="1" stroke-linecap="round" opacity="0.4"/>
                            </g>
                            <circle cx="25" cy="25" r="1" fill="white" opacity="0.3"/>
                            <circle cx="75" cy="75" r="1" fill="white" opacity="0.3"/>
                            <circle cx="75" cy="25" r="0.8" fill="white" opacity="0.4"/>
                            <circle cx="25" cy="75" r="0.8" fill="white" opacity="0.4"/>
                        </svg>
                        <div style="font-size: 24px; font-weight: 800; background: linear-gradient(135deg, #0f172a 0%, #059669 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; letter-spacing: -0.02em; margin-bottom: 4px;">
                            CognitoSpeak
                        </div>
                        <div style="font-size: 12px; color: #10b981; font-weight: 600; letter-spacing: 0.05em; text-transform: uppercase;">
                            AI-Powered Learning
                        </div>
                    </div>
                    <h1 style="font-size: 32px; font-weight: 800; color: #ffffff; margin: 0 0 12px 0; line-height: 1.2; letter-spacing: -0.02em;">
                        Speak English<br>Fearlessly.
                    </h1>
                    <p class="subtitle">Welcome aboard, ${data.userName}!</p>
                    <div class="hero-badge">
                        <span style="font-size:16px;">🎉</span>
                        <span>Your AI English Coach is Ready</span>
                    </div>
                </div>
            </div>
            
            <!-- Main Content -->
            <div class="content">
                
                <!-- Greeting -->
                <div class="section">
                    <p class="greeting">Hey ${data.userName}, your fluency journey starts now.</p>
                    <p class="lead">
                        You have just joined <strong>50,000+ learners</strong> who are mastering English with AI-powered coaching, live practice rooms, and personalized learning paths. Everything you need to go from hesitant to confident is right here.
                    </p>
                </div>
                
                <!-- Stats Bar -->
                <div class="stats-bar">
                    <div class="stats-grid">
                        <div class="stats-row">
                            <div class="stat-cell">
                                <p class="stat-number">50k+</p>
                                <p class="stat-label">Learners</p>
                            </div>
                            <div class="stat-cell">
                                <p class="stat-number">1.2k+</p>
                                <p class="stat-label">Online Now</p>
                            </div>
                            <div class="stat-cell">
                                <p class="stat-number">A1→C2</p>
                                <p class="stat-label">CEFR Tracking</p>
                            </div>
                        </div>
                    </div>
                </div>
                
                <!-- Features Grid -->
                <div class="section">
                    <p class="section-title">Explore Your Toolkit</p>
                    <div class="features-grid">
                        <div class="feature-row">
                            <div class="feature-cell">
                                <div class="feature-card">
                                    <div class="feature-icon" style="background: #ecfdf5;">🎙️</div>
                                    <h3>AI Voice Analysis</h3>
                                    <p>Get instant feedback on pronunciation, grammar, and vocabulary as you speak. Our engine analyzes 5 key fluency dimensions in real time.</p>
                                </div>
                            </div>
                            <div class="feature-cell">
                                <div class="feature-card">
                                    <div class="feature-icon" style="background: #eff6ff;">🌐</div>
                                    <h3>Live Practice Rooms</h3>
                                    <p>Jump into audio & video rooms with learners worldwide. Create instant sessions or browse active rooms — no setup needed.</p>
                                </div>
                            </div>
                        </div>
                        <div class="feature-row">
                            <div class="feature-cell">
                                <div class="feature-card">
                                    <div class="feature-icon" style="background: #fefce8;">📊</div>
                                    <h3>Track Your Growth</h3>
                                    <p>Watch your CEFR level climb from A1 to C2 with visual progress reports, day streaks, and detailed achievement analytics.</p>
                                </div>
                            </div>
                            <div class="feature-cell">
                                <div class="feature-card">
                                    <div class="feature-icon" style="background: #fdf4ff;">🎯</div>
                                    <h3>Smart Learning Paths</h3>
                                    <p>Adaptive AI curates lessons, Word of the Day, and grammar drills tailored to your level and learning pace.</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                
                <!-- CTA -->
                <div class="cta-section">
                    <h2>Ready to break the language barrier?</h2>
                    <p>Your dashboard is live with personalized recommendations just for you.</p>
                    <a href="${appUrl}/dashboard" class="cta-button">Go to Dashboard →</a>
                    <div class="secondary-links">
                        <a href="${appUrl}/practice-rooms">Join a Room</a> ·
                        <a href="${appUrl}/dashboard?tab=paths">Start a Lesson</a> ·
                        <a href="${appUrl}/profile">Complete Profile</a>
                    </div>
                </div>
                
                <!-- Getting Started -->
                <div class="section">
                    <p class="section-title">Quick Start Checklist</p>
                    <ul class="tips-list">
                        <li><strong>Take the placement test</strong> — We'll pinpoint your CEFR level (A1–C2) so every lesson fits you perfectly.</li>
                        <li><strong>Start a 7-day streak</strong> — Daily practice builds momentum. Your streak begins today.</li>
                        <li><strong>Join a live room</strong> — 1,200+ learners are practicing right now. No camera required.</li>
                        <li><strong>Try AI Voice Feedback</strong> — Speak into any lesson and get real-time pronunciation scoring.</li>
                        <li><strong>Set your daily goal</strong> — 10 minutes a day is all it takes to see measurable progress.</li>
                    </ul>
                </div>
                
                <!-- Closing -->
                <div class="section" style="text-align: center; padding: 16px 0;">
                    <p style="font-size: 16px; color: #475569; margin: 0 0 8px 0;">
                        Questions? Our learner success team is always here to help.
                    </p>
                    <p style="font-size: 15px; color: #64748b; margin: 0; font-style: italic;">
                        Happy learning,<br>
                        <strong style="color: #0f172a;">The CognitoSpeak Team</strong>
                    </p>
                </div>
                
            </div>
            
            <!-- Footer -->
            <div class="footer">
                <p class="footer-brand">CognitoSpeak</p>
                <p class="footer-tagline">AI-Powered Learning</p>
                <p class="footer-text">
                    © ${currentYear} CognitoSpeak. All rights reserved.<br>
                    You're receiving this because you signed up with Google OAuth.
                </p>
            </div>
            
        </div>
    </body>
    </html>
  `;
}
// Production email sending function (to be implemented with proper email service)
async function sendActualEmail(to, subject, html) {
    // TODO: Implement with proper email service (SendGrid, AWS SES, etc.)
    console.log('Email would be sent to:', to);
    console.log('Subject:', subject);
    console.log('HTML content length:', html.length);
}
//# sourceMappingURL=emailService.js.map