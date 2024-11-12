const userModel = require("../models/userModel");
const nodemailer = require("nodemailer");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");

const AES_SECRET = Buffer.from(process.env.AES_SECRET, "utf8");
const AES_IV = Buffer.from(process.env.AES_IV, "utf8");

function encryptToken(token) {
  const cipher = crypto.createCipheriv("aes-128-cbc", AES_SECRET, AES_IV);
  let encrypted = cipher.update(token, "utf8", "hex");
  encrypted += cipher.final("hex");
  return encrypted;
}

function decryptToken(encryptedToken) {
  const decipher = crypto.createDecipheriv("aes-128-cbc", AES_SECRET, AES_IV);
  let decrypted = decipher.update(encryptedToken, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}

exports.sendJWTToken = async function generateTokenForExistingUsers(req, res) {
  try {
    // Find users who don't have a token field or it's empty
    const usersWithoutToken = await userModel.find({ token: { $exists: false } });

    if (usersWithoutToken.length === 0) {
      console.log("All users already have a token.");
      res.status(200).json({ message: "All users already have a token." });
      return;
    }

    // Loop through each user and generate a token
    for (let user of usersWithoutToken) {
      const tokenPayload = { collegeId: user.collegeId, name: user.name, collegeEmail: user.collegeEmail };
      const token = jwt.sign(tokenPayload, process.env.JWT_SECRET);
      const encryptedToken = encryptToken(token);

      // Update the user with the generated token
      user.token = encryptedToken;
      await user.save();

      console.log(`Token generated for user: ${user.name} (${user.collegeId})`);
      res.status(200).json({ message: `Token generated for user: ${user.name} (${user.collegeId})` });
    }

    console.log("Token generation and update complete for all users without a token.");
    res.status(200).json({ message: "Token generation and update complete for all users without a token." });
  } catch (error) {
    console.error("Error generating token for existing users:", error.message);
    res.status(500).json({ message: "Error generating token for existing users" });
  }
}
exports.register = async (req, res) => {
  try {
    const { name, collegeEmail, collegeId, year, department, contactNumber, whatsappNumber } = req.body;

    if (!name || !collegeEmail || !collegeId || !year || !department || !contactNumber || !whatsappNumber) {
      return res.status(400).json({ message: "Please provide all the required fields" });
    }

    const emailDomain = "@nshm.edu.in";
    if (!collegeEmail.endsWith(emailDomain)) {
      return res.status(400).json({ message: `Email must end with ${emailDomain}` });
    }

    if (!/^\d{11}$/.test(collegeId)) {
      return res.status(400).json({ message: "College ID must be exactly 11 digits" });
    }

    if (!/^\d{10}$/.test(contactNumber)) {
      return res.status(400).json({ message: "Contact numbers must be exactly 10 digits" });
    }

    if (!/^\d{10}$/.test(whatsappNumber)) {
      return res.status(400).json({ message: "WhatsApp numbers must be exactly 10 digits" });
    }

    const existingEmail = await userModel.findOne({ collegeEmail });
    if (existingEmail) {
      return res.status(400).json({ message: "User with this email already exists" });
    }

    const existingId = await userModel.findOne({ collegeId });
    if (existingId) {
      return res.status(400).json({ message: "User with this ID already exists" });
    }

    // Step 1: Generate JWT
    const tokenPayload = { collegeId, name, collegeEmail };
    const token = jwt.sign(tokenPayload, process.env.JWT_SECRET);

    // Step 2: Encrypt the JWT
    const encryptedToken = encryptToken(token);

    const newUser = new userModel({ name, collegeEmail, collegeId, year, department, contactNumber, whatsappNumber, token: encryptedToken });
    await newUser.save();
    res.status(201).json({ message: "User created successfully", newUser,
      token: encryptedToken, });

  } catch (error) {
    res.status(500).json({ message: "Internal server error" , error: error.message});
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

exports.verifyUser = async (req, res) => {
  const { encryptedToken } = req.params;
  
  try {
    if (!encryptedToken) {
      return res.status(400).json({ message: "Encrypted token is required." });
    }

    const decryptedToken = decryptToken(encryptedToken);

    jwt.verify(decryptedToken, process.env.JWT_SECRET, async (err, decoded) => {
      if (err) {
        return res.status(401).json({ message: "Invalid or expired token." });
      }

      const { collegeEmail } = decoded;

      const user = await userModel.findOne({ collegeEmail });
      if (!user) {
        return res.status(404).json({ message: "User not found." });
      }

      if (user.isPresent) {
        return res.status(200).json({ message: "Duplicate entry", user });
      }

      user.isPresent = true;
      await user.save();

      res.status(200).json({ message: "User checked in successfully", user });
    });
  } catch (error) {
    res.status(500).json({ message: "Internal server error", error: error.message });
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

exports.getRegistrationCount = async (req, res) => {
  try {
    const count = await userModel.countDocuments();
    res.status(200).json({ count });
  } catch (error) {
    res.status(500).json({ message: "Error fetching registration count" });
  }
}
