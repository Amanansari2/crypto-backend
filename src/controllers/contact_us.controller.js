const sequelize = require("../config/db");
const { sendEmail } = require("../services/email.service");
// POST /api/contact-us
exports.submitContactMessage = async (req, res, next) => {
    try {
        const {
            full_name,
            email,
            phone_number,
            subject,
            message
        } = req.body;

        // Validate required fields
        if (
            !full_name?.trim() ||
            !email?.trim() ||
            // !phone_number?.trim() ||
            // !subject?.trim() ||
            !message?.trim()
        ) {
            return res.status(400).json({
                success: false,
                message: "All fields are required."
            });
        }

        const name = full_name.trim();
        const userEmail = email.trim().toLowerCase();
        const phone = phone_number?.trim() || "";
        const userSubject = subject?.trim() || "";
        const userMessage = message.trim();

        // Validate name
        if (name.length > 150) {
            return res.status(400).json({
                success: false,
                message: "Name must not exceed 150 characters."
            });
        }

        // Validate email
        if (
            userEmail.length > 255 ||
            ! /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(userEmail)
        ) {
            return res.status(400).json({
                success: false,
                message: "Please enter a valid email address."
            });
        }


        // Validate phone
        // if (
        //     phone.length > 30 ||
        //     !/^[+\d][\d\s().-]{5,29}$/.test(phone)
        // ) {
        //     return res.status(400).json({
        //         success: false,
        //         message: "Please enter a valid phone number."
        //     });
        // }

        if (userSubject.length > 200) {
            return res.status(400).json({
                success: false,
                message: "Subject is too long."
            });
        }

        if (userMessage.length > 10000) {
            return res.status(400).json({
                success: false,
                message: "Message is too long."
            });
        }

        // Get user ID from verified JWT, if logged in.
        const user_id = req.auth?.userId || null;

        const [result] = await sequelize.query(
            `INSERT INTO contact_messages
            (
                user_id,
                full_name,
                email,
                phone_number,
                subject,
                message,
                status,
                created_at,
                updated_at
            )
            VALUES
            (
                :user_id,
                :full_name,
                :email,
                :phone_number,
                :subject,
                :message,
                'new',
                NOW(),
                NOW()
            )`,
            {
                replacements: {
                    user_id,
                    full_name: name,
                    email: userEmail,
                    phone_number: phone,
                    subject: userSubject,
                    message: userMessage
                }
            }
        );
        // Send thank-you email to the user
        try {
            await sendEmail({
                to: userEmail,
                subject: "Thank You for Contacting Us",
                html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 25px; border: 1px solid #e5e7eb; border-radius: 10px;">
                <h2 style="color: #06B6D4;">Thank You, ${name}!</h2>

                <p>We have successfully received your message.</p>

                <p>Thank you for taking the time to contact us. 
                Our team will review your enquiry and get back to you as soon as possible.</p>

                <div style="background: #f3f4f6; padding: 15px; border-radius: 8px;">
                    <strong>Your subject:</strong>
                    <p>${userSubject || "General Enquiry"}</p>
                </div>

                <p>We appreciate your interest and look forward to assisting you.</p>

                <p>Best regards,<br><strong>Support Team</strong></p>
            </div>
        `
            });
        } catch (emailError) {
            console.error("Contact thank-you email failed:", emailError);
        }

        return res.status(201).json({
            success: true,
            message: "Your message has been sent successfully.",
            data: {
                id: result.insertId,
                user_id
            }
        });

    } catch (error) {
        next(error);
    }
};