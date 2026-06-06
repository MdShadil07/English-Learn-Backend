import { Resend } from 'resend';

function generateGoogleLinkingTemplate(data: any) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Account Verification</title>
  <!--[if mso]>
  <style type="text/css">
    body, table, td, p, a, h1, h2, h3, span {font-family: Arial, Helvetica, sans-serif !important;}
  </style>
  <![endif]-->
</head>
<body style="background-color: #f3f4f6; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; margin: 0; padding: 40px 0; -webkit-font-smoothing: antialiased; line-height: 1.6;">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
    <tr>
      <td align="center" style="padding: 0 10px;">
        
        <!-- Main Wrapper -->
        <table width="600" cellpadding="0" cellspacing="0" role="presentation" style="background-color: #ffffff; border-radius: 20px; overflow: hidden; box-shadow: 0 20px 40px -10px rgba(0,0,0,0.1); margin: 0 auto;">
          
          <!-- Unique Dark Header Section -->
          <tr>
            <td style="background-color: #0f172a; background-image: radial-gradient(circle at top right, #78350f 0%, #0f172a 100%); padding: 50px 40px 40px 40px; text-align: center; border-bottom: 4px solid #f59e0b;">
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                <tr>
                  <td align="center" style="padding-bottom: 24px;">
                    <div style="background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%); width: 72px; height: 72px; border-radius: 24px; text-align: center; line-height: 72px; box-shadow: 0 10px 25px -5px rgba(245, 158, 11, 0.4); display: inline-block;">
                      <span style="font-size: 32px; display: inline-block;">🛡️</span>
                    </div>
                  </td>
                </tr>
                <tr>
                  <td>
                    <h1 style="margin: 0; color: #ffffff; font-size: 32px; font-weight: 800; letter-spacing: -1px; line-height: 1.2;">Account Verification</h1>
                    <p style="margin: 12px 0 0 0; color: #fef3c7; font-size: 16px; font-weight: 500; opacity: 0.9;">Securely link your Google account.</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Body Content -->
          <tr>
            <td style="padding: 40px 40px 10px 40px;">
              <p style="color: #1e293b; font-size: 20px; font-weight: 700; margin: 0 0 16px 0;">Hello ${data.userName || 'there'},</p>
              <p style="color: #475569; font-size: 16px; margin: 0 0 32px 0;">You're almost there! We just need to verify your email address to securely link your Google account to CognitoSpeak. Please use the verification code below:</p>
            </td>
          </tr>

          <!-- Code Box -->
          <tr>
            <td style="padding: 10px 40px 30px 40px;">
              <div style="background-color: #fffbeb; border: 2px dashed #fcd34d; border-radius: 16px; padding: 32px 24px; text-align: center;">
                <span style="font-family: 'Courier New', Courier, monospace; font-size: 42px; font-weight: 800; letter-spacing: 12px; color: #b45309; text-shadow: 1px 1px 0px rgba(255,255,255,0.5);">${data.verificationCode}</span>
              </div>
              <p style="color: #ef4444; font-size: 14px; margin: 16px 0 0 0; text-align: center; font-weight: 600;">⏱️ This code will expire at ${data.expiresAt}.</p>
            </td>
          </tr>

          <!-- Fallback Section -->
          <tr>
            <td style="padding: 0 40px 40px 40px;">
              <p style="margin: 0; color: #94a3b8; font-size: 14px; text-align: center;">If you didn't attempt to link a Google account, please ignore this email and make sure your account is secure.</p>
            </td>
          </tr>

          <!-- Elegant Footer -->
          <tr>
            <td style="background-color: #0f172a; padding: 40px; text-align: center;">
              <h2 style="margin: 0 0 16px 0; color: #ffffff; font-size: 20px; font-weight: 800; letter-spacing: -0.5px;">CognitoSpeak</h2>
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                <tr>
                  <td align="center" style="padding-top: 20px; border-top: 1px solid #1e293b;">
                    <p style="color: #475569; font-size: 12px; margin: 0;">© ${new Date().getFullYear()} CognitoSpeak. All rights reserved.</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
        
        <!-- Spacer for email clients -->
        <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
          <tr><td height="40"></td></tr>
        </table>
        
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function generateWelcomeTemplate(data: any) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to CognitoSpeak</title>
  <!--[if mso]>
  <style type="text/css">
    body, table, td, p, a, h1, h2, h3, span {font-family: Arial, Helvetica, sans-serif !important;}
  </style>
  <![endif]-->
</head>
<body style="background-color: #f3f4f6; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; margin: 0; padding: 40px 0; -webkit-font-smoothing: antialiased; line-height: 1.6;">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
    <tr>
      <td align="center" style="padding: 0 10px;">
        
        <!-- Main Wrapper -->
        <table width="600" cellpadding="0" cellspacing="0" role="presentation" style="background-color: #ffffff; border-radius: 20px; overflow: hidden; box-shadow: 0 20px 40px -10px rgba(0,0,0,0.1); margin: 0 auto;">
          
          <!-- Unique Dark Header Section -->
          <tr>
            <td style="background-color: #0f172a; background-image: radial-gradient(circle at top right, #064e3b 0%, #0f172a 100%); padding: 60px 40px; text-align: center; border-bottom: 4px solid #10b981;">
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                <tr>
                  <td align="center" style="padding-bottom: 24px;">
                    <div style="background: linear-gradient(135deg, #34d399 0%, #059669 100%); width: 72px; height: 72px; border-radius: 24px; text-align: center; line-height: 72px; box-shadow: 0 10px 25px -5px rgba(16, 185, 129, 0.4); display: inline-block; transform: rotate(-5deg);">
                      <span style="font-size: 36px; display: inline-block; transform: rotate(5deg);">✨</span>
                    </div>
                  </td>
                </tr>
                <tr>
                  <td>
                    <h1 style="margin: 0; color: #ffffff; font-size: 38px; font-weight: 800; letter-spacing: -1px; line-height: 1.2;">Welcome to the future of <span style="color: #34d399;">fluency.</span></h1>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Personalized Greeting -->
          <tr>
            <td style="padding: 40px 40px 10px 40px;">
              <p style="color: #1e293b; font-size: 20px; font-weight: 700; margin: 0 0 16px 0;">Hello ${data.userName || 'there'},</p>
              <p style="color: #475569; font-size: 16px; margin: 0 0 20px 0;">You've just unlocked access to <strong>CognitoSpeak</strong>, your personal AI-powered language coach. We don't just teach you words—we analyze the very DNA of your speech to make you sound natural, confident, and perfectly articulate.</p>
            </td>
          </tr>

          <!-- The Journey (Creative Steps) -->
          <tr>
            <td style="padding: 20px 40px;">
              <h3 style="color: #94a3b8; font-size: 13px; text-transform: uppercase; letter-spacing: 2px; font-weight: 700; margin: 0 0 24px 0;">Your Path to Mastery</h3>
              
              <!-- Step 1 -->
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin-bottom: 16px; background-color: #f8fafc; border-radius: 16px; border-left: 4px solid #10b981;">
                <tr>
                  <td width="60" align="center" valign="middle" style="padding: 20px 0 20px 20px;">
                    <div style="background-color: #ffffff; width: 40px; height: 40px; border-radius: 50%; box-shadow: 0 2px 5px rgba(0,0,0,0.05); text-align: center; line-height: 40px; font-weight: 800; color: #10b981;">1</div>
                  </td>
                  <td style="padding: 20px;">
                    <h4 style="margin: 0 0 4px 0; color: #0f172a; font-size: 16px; font-weight: 700;">Practice Anywhere</h4>
                    <p style="margin: 0; color: #64748b; font-size: 14px;">Jump into solo drills or live AI conversations instantly.</p>
                  </td>
                </tr>
              </table>

              <!-- Step 2 -->
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin-bottom: 16px; background-color: #f8fafc; border-radius: 16px; border-left: 4px solid #3b82f6;">
                <tr>
                  <td width="60" align="center" valign="middle" style="padding: 20px 0 20px 20px;">
                    <div style="background-color: #ffffff; width: 40px; height: 40px; border-radius: 50%; box-shadow: 0 2px 5px rgba(0,0,0,0.05); text-align: center; line-height: 40px; font-weight: 800; color: #3b82f6;">2</div>
                  </td>
                  <td style="padding: 20px;">
                    <h4 style="margin: 0 0 4px 0; color: #0f172a; font-size: 16px; font-weight: 700;">Get X-Ray Feedback</h4>
                    <p style="margin: 0; color: #64748b; font-size: 14px;">Our engine highlights exactly which phonemes and rhythms need work.</p>
                  </td>
                </tr>
              </table>

              <!-- Step 3 -->
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background-color: #f8fafc; border-radius: 16px; border-left: 4px solid #8b5cf6;">
                <tr>
                  <td width="60" align="center" valign="middle" style="padding: 20px 0 20px 20px;">
                    <div style="background-color: #ffffff; width: 40px; height: 40px; border-radius: 50%; box-shadow: 0 2px 5px rgba(0,0,0,0.05); text-align: center; line-height: 40px; font-weight: 800; color: #8b5cf6;">3</div>
                  </td>
                  <td style="padding: 20px;">
                    <h4 style="margin: 0 0 4px 0; color: #0f172a; font-size: 16px; font-weight: 700;">Level Up Fast</h4>
                    <p style="margin: 0; color: #64748b; font-size: 14px;">Watch your Speech DNA score rise as you correct targeted mistakes.</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Pro Tip Box -->
          <tr>
            <td style="padding: 20px 40px;">
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background-color: #fffbeb; border-radius: 12px; border: 1px solid #fde68a;">
                <tr>
                  <td style="padding: 20px;">
                    <p style="margin: 0; color: #b45309; font-size: 14px; font-weight: 600;">💡 Pro Tip:</p>
                    <p style="margin: 4px 0 0 0; color: #92400e; font-size: 14px;">For the best results, use a headset with a dedicated microphone during your first AI Tutor session.</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- CTA Section -->
          <tr>
            <td align="center" style="padding: 30px 40px 50px 40px;">
              <a href="${data.appUrl || 'https://cognitolearn.dev'}" style="display: inline-block; background-color: #0f172a; color: #ffffff; font-size: 16px; font-weight: 600; text-decoration: none; padding: 18px 48px; border-radius: 12px; border-bottom: 4px solid #020617; transition: all 0.2s ease;">Launch Workspace &rarr;</a>
            </td>
          </tr>
          
          <!-- Elegant Footer -->
          <tr>
            <td style="background-color: #0f172a; padding: 40px; text-align: center;">
              <h2 style="margin: 0 0 16px 0; color: #ffffff; font-size: 20px; font-weight: 800; letter-spacing: -0.5px;">CognitoSpeak</h2>
              <p style="color: #94a3b8; font-size: 13px; line-height: 20px; margin: 0 0 16px 0;">Transforming the way the world learns English.</p>
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                <tr>
                  <td align="center" style="padding-top: 20px; border-top: 1px solid #1e293b;">
                    <p style="color: #475569; font-size: 12px; margin: 0;">© ${new Date().getFullYear()} CognitoSpeak. All rights reserved.</p>
                    <p style="color: #475569; font-size: 11px; margin: 8px 0 0 0;">You're receiving this because you signed up for our platform. <a href="#" style="color: #64748b; text-decoration: underline;">Unsubscribe</a></p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
        
        <!-- Spacer for email clients -->
        <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
          <tr><td height="40"></td></tr>
        </table>
        
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function generatePasswordResetTemplate(data: any) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reset Your Password</title>
  <!--[if mso]>
  <style type="text/css">
    body, table, td, p, a, h1, h2, h3, span {font-family: Arial, Helvetica, sans-serif !important;}
  </style>
  <![endif]-->
</head>
<body style="background-color: #f3f4f6; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; margin: 0; padding: 40px 0; -webkit-font-smoothing: antialiased; line-height: 1.6;">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
    <tr>
      <td align="center" style="padding: 0 10px;">
        
        <!-- Main Wrapper -->
        <table width="600" cellpadding="0" cellspacing="0" role="presentation" style="background-color: #ffffff; border-radius: 20px; overflow: hidden; box-shadow: 0 20px 40px -10px rgba(0,0,0,0.1); margin: 0 auto;">
          
          <!-- Unique Dark Header Section -->
          <tr>
            <td style="background-color: #0f172a; background-image: radial-gradient(circle at top right, #1e3a8a 0%, #0f172a 100%); padding: 50px 40px 40px 40px; text-align: center; border-bottom: 4px solid #3b82f6;">
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                <tr>
                  <td align="center" style="padding-bottom: 24px;">
                    <div style="background: linear-gradient(135deg, #60a5fa 0%, #2563eb 100%); width: 72px; height: 72px; border-radius: 24px; text-align: center; line-height: 72px; box-shadow: 0 10px 25px -5px rgba(59, 130, 246, 0.4); display: inline-block;">
                      <span style="font-size: 32px; display: inline-block;">🔒</span>
                    </div>
                  </td>
                </tr>
                <tr>
                  <td>
                    <h1 style="margin: 0; color: #ffffff; font-size: 32px; font-weight: 800; letter-spacing: -1px; line-height: 1.2;">Password Reset</h1>
                    <p style="margin: 12px 0 0 0; color: #bfdbfe; font-size: 16px; font-weight: 500; opacity: 0.9;">Secure access to your CognitoSpeak account.</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Body Content -->
          <tr>
            <td style="padding: 40px 40px 10px 40px;">
              <p style="color: #1e293b; font-size: 20px; font-weight: 700; margin: 0 0 16px 0;">Hello ${data.userName || 'there'},</p>
              <p style="color: #475569; font-size: 16px; margin: 0 0 32px 0;">We received a request to reset your password. It happens to the best of us! Click the secure link below to choose a new password and regain access to your dashboard.</p>
            </td>
          </tr>

          <!-- CTA Section -->
          <tr>
            <td align="center" style="padding: 10px 40px 40px 40px;">
              <a href="${data.resetUrl}" style="display: inline-block; background-color: #0f172a; color: #ffffff; font-size: 16px; font-weight: 600; text-decoration: none; padding: 18px 48px; border-radius: 12px; border-bottom: 4px solid #020617; transition: all 0.2s ease;">Reset My Password &rarr;</a>
            </td>
          </tr>
          
          <!-- Fallback Link Section -->
          <tr>
            <td style="padding: 0 40px 40px 40px;">
              <div style="background-color: #f8fafc; border-radius: 12px; padding: 20px; text-align: center; border: 1px dashed #cbd5e1;">
                <p style="margin: 0 0 8px 0; color: #64748b; font-size: 13px; font-weight: 600;">Button not working? Copy this link:</p>
                <p style="margin: 0; font-size: 13px; line-height: 20px; word-break: break-all;">
                  <a href="${data.resetUrl}" style="color: #3b82f6; text-decoration: underline;">${data.resetUrl}</a>
                </p>
              </div>
              <p style="margin: 32px 0 0 0; color: #94a3b8; font-size: 14px; text-align: center;">If you didn't request a password reset, you can safely ignore this email. Your password will remain unchanged.</p>
            </td>
          </tr>

          <!-- Elegant Footer -->
          <tr>
            <td style="background-color: #0f172a; padding: 40px; text-align: center;">
              <h2 style="margin: 0 0 16px 0; color: #ffffff; font-size: 20px; font-weight: 800; letter-spacing: -0.5px;">CognitoSpeak</h2>
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                <tr>
                  <td align="center" style="padding-top: 20px; border-top: 1px solid #1e293b;">
                    <p style="color: #475569; font-size: 12px; margin: 0;">© ${new Date().getFullYear()} CognitoSpeak. All rights reserved.</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
        
        <!-- Spacer for email clients -->
        <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
          <tr><td height="40"></td></tr>
        </table>
        
      </td>
    </tr>
  </table>
</body>
</html>`;
}


interface EmailOptions {
  to: string;
  subject: string;
  template?: string;
  data?: Record<string, any>;
  html?: string;
  text?: string;
}

const resend = new Resend(process.env.RESEND_API_KEY || 're_default');

export async function sendEmail(options: EmailOptions): Promise<void> {
  try {
    // Initialize transporter if not already done (now async)

        // Normalize template data and generate HTML content
        const templateData = options.data || {};
        let htmlContent = options.html;
        if (options.template && !htmlContent) {
            if (options.template === 'google-linking-verification') {
                htmlContent = generateGoogleLinkingTemplate(templateData);
            } else if (options.template === 'welcome') {
                htmlContent = generateWelcomeTemplate(templateData);
            } else if (options.template === 'password-reset') {
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
        } catch (e) {
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
    } else if (options.template === 'welcome') {
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
  } catch (err) {
    console.error('Unexpected error in sendEmail:', err);
    throw err;
  }
}
