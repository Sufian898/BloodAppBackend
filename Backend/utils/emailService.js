const nodemailer = require('nodemailer');

// Create reusable transporter object using SMTP transport
const createTransporter = () => {
  // For development/testing, you can use Gmail or other SMTP services
  // For production, use proper SMTP service like SendGrid, AWS SES, etc.
  
  // Gmail configuration (you'll need to enable "Less secure app access" or use App Password)
  // Check if email credentials are provided
  const emailUser = process.env.EMAIL_USER;
  const emailPass = process.env.EMAIL_PASSWORD;
  
  if (!emailUser || emailUser === 'your-email@gmail.com' || !emailPass || emailPass === 'your-app-password') {
    return null; // Will be handled in sendPasswordResetEmail
  }

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: emailUser,
      pass: emailPass, // Use App Password for Gmail
    },
  });

  // Alternative: Custom SMTP configuration
  // const transporter = nodemailer.createTransport({
  //   host: process.env.SMTP_HOST || 'smtp.gmail.com',
  //   port: process.env.SMTP_PORT || 587,
  //   secure: false, // true for 465, false for other ports
  //   auth: {
  //     user: process.env.EMAIL_USER,
  //     pass: process.env.EMAIL_PASSWORD,
  //   },
  // });

  return transporter;
};

// Send password reset email
const sendPasswordResetEmail = async (email, resetToken, resetUrl) => {
  try {
    const transporter = createTransporter();

    // If no email credentials, log the reset link instead
    if (!transporter) {
      console.log('\n📧 Password Reset Link (Email service not configured):');
      console.log(`   Email: ${email}`);
      console.log(`   Reset URL: ${resetUrl}`);
      console.log(`   Token: ${resetToken}\n`);
      console.log('⚠️  To enable email sending:');
      console.log('   1. Create .env file in Backend folder');
      console.log('   2. Add EMAIL_USER=your-email@gmail.com');
      console.log('   3. Add EMAIL_PASSWORD=your-app-password');
      console.log('   4. Get App Password from: https://myaccount.google.com/apppasswords\n');
      // Return token for development mode
      return { 
        success: true, 
        message: 'Reset link logged to console (email service not configured)',
        token: resetToken // Return token for development/testing
      };
    }

    const mailOptions = {
      from: `"Blood Donation App" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: 'Password Reset Request - Blood Donation App',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #DC143C; color: white; padding: 20px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background-color: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
            .button { display: inline-block; padding: 12px 30px; background-color: #DC143C; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
            .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🔐 Password Reset Request</h1>
            </div>
            <div class="content">
              <p>Hello,</p>
              <p>We received a request to reset your password for your Blood Donation App account.</p>
              <p>Click the button below to reset your password:</p>
              <div style="text-align: center;">
                <a href="${resetUrl}" class="button">Reset Password</a>
              </div>
              <p>Or copy and paste this link into your browser:</p>
              <p style="word-break: break-all; color: #DC143C;">${resetUrl}</p>
              <p><strong>This link will expire in 1 hour.</strong></p>
              <p>If you didn't request a password reset, please ignore this email.</p>
              <p>Best regards,<br>Blood Donation App Team</p>
            </div>
            <div class="footer">
              <p>This is an automated email. Please do not reply.</p>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `
        Password Reset Request - Blood Donation App
        
        Hello,
        
        We received a request to reset your password for your Blood Donation App account.
        
        Click the link below to reset your password:
        ${resetUrl}
        
        This link will expire in 1 hour.
        
        If you didn't request a password reset, please ignore this email.
        
        Best regards,
        Blood Donation App Team
      `,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('✅ Password reset email sent:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('❌ Error sending email:', error);
    // Log the reset link as fallback
    console.log('\n📧 Password Reset Link (Email failed, using fallback):');
    console.log(`   Email: ${email}`);
    console.log(`   Reset URL: ${resetUrl}`);
    console.log(`   Token: ${resetToken}\n`);
    return { success: false, error: error.message };
  }
};

module.exports = {
  sendPasswordResetEmail,
};

