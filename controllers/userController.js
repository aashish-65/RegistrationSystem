const userModel = require("../models/userModel");
const nodemailer = require("nodemailer");

exports.register = async (req, res) => {
  try {
    const { name, collegeEmail, collegeId, year, department, contactNumber, whatsappNumber } = req.body;

    if (!name || !collegeEmail || !collegeId || !year || !department || !contactNumber || !whatsappNumber) {
      return res
        .status(400)
        .json({ message: "Please provide all the required fields" });
    }

    const existingUser = await userModel.findOne({ collegeId })
    if (existingUser) {
      return res
        .status(400)
        .json({ message: "User with this Id already exists" });
    }

    const user = new userModel({ name, collegeEmail, collegeId, year, department, contactNumber, whatsappNumber });
    await user.save();
    res.status(201).json({ message: "User created successfully" });
  } catch (error) {
    res.status(500).json({ message: "Internal server error" });
  }
};

exports.getUsers = async (req, res) => {
  try {
    const users = await userModel.find();
    res.status(200).json(users);
  } catch (error) {
    res.status(500).json({ message: "Internal server error" });
  }
};

exports.getUser = async (req, res) => {
  const {id}  = req.params;
  try {
    const user = await userModel.findOne({ collegeId: id });
    if (user) {
        res.status(200).json({message: "USER FOUND", user});
    } else {
        res.status(404).json({ message: "USER NOT FOUND" });
    }
  } catch (error) {
    res.status(500).json({ message: "Internal server error" });
  }
};

exports.scanUser = async (req, res) => {
  const {id}  = req.params;
  try {
    const user = await userModel.findOne({ collegeId: id });
    if (user) {
      if(user.isPresent){
          return res.status(200).json({message: "Duplicate Entry", user});
      }
        user.isPresent = true;
        await user.save();
        res.status(200).json({message: "true", user});
    } else {
        res.status(404).json({ message: "false" });
    }
  } catch (error) {
    res.status(500).json({ message: "Internal server error" });
  }
};

exports.updateUser = async (req, res) => {
  const { id } = req.params;
  const updatedUser = req.body;
  const { name, collegeEmail, year, department, contactNumber, whatsappNumber } = updatedUser;

  if (!name || !collegeEmail || !year || !department || !contactNumber || !whatsappNumber) {
    return res
      .status(400)
      .json({ message: "Please provide all the required fields" });
  }

  try {
    const user = await userModel.findOneAndUpdate({ collegeId: id }, updatedUser, {new: true});
    if (user) {
        return res.status(200).json({ user, message: "User updated successfully"});
    } else {
        return res.status(404).json({ message: "User not found" });
    }
  } catch (error) {
    res.status(500).json({ message: "Internal server error" });
  }
};


exports.deleteUser = async (req, res) => {
  const { id } = req.params;
  try {
    const user = await userModel.findOne({ collegeId: id });
    if (user) {
        res.status(200).json({ message: "User deleted successfully", user });
        await userModel.deleteOne({ collegeId: id });      
    } else {
      return res.status(404).json({ message: "User not found" });
    }
  } catch (error) {
    res.status(500).json({ message: "Internal server error" });
  }
};

exports.sendEmail = async (req, res) => {
  const { name, collegeEmail, qrCode } = req.body;

  try {
    const transporter = nodemailer.createTransport({
      service: "Gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD,
      },
    });

    // Convert base64 QR code to a buffer
    const qrCodeBuffer = Buffer.from(qrCode.split(",")[1], "base64");

    // Enhanced HTML template with personalized greeting and improved design
    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px; background-color: #f9f9f9;">
        <div style="text-align: center; padding: 10px 0;">
          <img src="https://codenestnshm.netlify.app/web-app-manifest-192x192.png" alt="CodeNEST Logo" style="width: 80px; height: auto; margin-bottom: 10px;">
        </div>
        <h2 style="text-align: center; color: #333; font-size: 24px;">Welcome to CodeNEST!</h2>
        
        <p style="font-size: 18px; color: #555; text-align: center;">Hello ${name},</p>
        
        <p style="font-size: 16px; color: #555; line-height: 1.6;">
          Thank you for registering for our event! Please find below your personalized QR code, which you’ll need for verification at the event.
        </p>
        
        <div style="text-align: center; margin: 20px 0;">
          <img src="cid:qrCodeImage" alt="QR Code" style="width: 150px; height: 150px; border: 1px solid #ddd; padding: 5px; border-radius: 5px;">
        </div>
        
        <p style="font-size: 14px; color: #666; text-align: center;">
          <em>Tip:</em> Keep this QR code handy and secure. We’re excited to welcome you to CodeNEST!
        </p>
        
        <div style="margin-top: 30px; text-align: center;">
          <a href="https://codenestnshm.netlify.app" style="display: inline-block; padding: 10px 20px; font-size: 16px; color: #fff; background-color: #0073e6; text-decoration: none; border-radius: 5px;">Visit Our Website</a>
        </div>
        
        <hr style="border: none; border-top: 1px solid #e0e0e0; margin-top: 30px; margin-bottom: 10px;">
        
        <p style="text-align: center; font-size: 12px; color: #999;">
          © ${new Date().getFullYear()} CodeNEST. All rights reserved.
        </p>
      </div>
    `;

    // Send email with QR code attachment
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: collegeEmail,
      subject: `Welcome to CodeNEST, ${name}!`,
      html: emailHtml,
      attachments: [
        {
          filename: "qr-code.png",
          content: qrCodeBuffer,
          cid: "qrCodeImage" // same `cid` as in the HTML img src
        },
      ],
    };

    await transporter.sendMail(mailOptions);
    res.status(200).json({ message: "Email sent successfully" });
  } catch (error) {
    console.error("Error sending email:", error);
    res.status(500).json({ message: "Error sending email. Please try again later." });
  }
};
