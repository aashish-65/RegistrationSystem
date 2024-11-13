const userModel = require("../models/userModel");
const nodemailer = require("nodemailer");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const QRCode = require("qrcode");

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
    const usersWithoutToken = await userModel.find({
      token: { $exists: false },
    });

    if (usersWithoutToken.length === 0) {
      console.log("All users already have a token.");
      res.status(200).json({ message: "All users already have a token." });
      return;
    }

    // Loop through each user and generate a token
    for (let user of usersWithoutToken) {
      const tokenPayload = {
        collegeId: user.collegeId,
        name: user.name,
        collegeEmail: user.collegeEmail,
      };
      const token = jwt.sign(tokenPayload, process.env.JWT_SECRET);
      const encryptedToken = encryptToken(token);

      // Update the user with the generated token
      user.token = encryptedToken;
      await user.save();

      console.log(`Token generated for user: ${user.name} (${user.collegeId})`);
      // res
      //   .status(200)
      //   .json({
      //     message: `Token generated for user: ${user.name} (${user.collegeId})`,
      //   });
    }

    console.log(
      "Token generation and update complete for all users without a token."
    );
    res
      .status(200)
      .json({
        message:
          "Token generation and update complete for all users without a token.",
      });
  } catch (error) {
    console.error("Error generating token for existing users:", error.message);
    res
      .status(500)
      .json({ message: "Error generating token for existing users" });
  }
};
exports.register = async (req, res) => {
  try {
    const {
      name,
      collegeEmail,
      collegeId,
      year,
      department,
      contactNumber,
      whatsappNumber,
    } = req.body;

    if (
      !name ||
      !collegeEmail ||
      !collegeId ||
      !year ||
      !department ||
      !contactNumber ||
      !whatsappNumber
    ) {
      return res
        .status(400)
        .json({ message: "Please provide all the required fields" });
    }

    const emailDomain = "@nshm.edu.in";
    if (!collegeEmail.endsWith(emailDomain)) {
      return res
        .status(400)
        .json({ message: `Email must end with ${emailDomain}` });
    }

    if (!/^\d{11}$/.test(collegeId)) {
      return res
        .status(400)
        .json({ message: "College ID must be exactly 11 digits" });
    }

    if (!/^\d{10}$/.test(contactNumber)) {
      return res
        .status(400)
        .json({ message: "Contact numbers must be exactly 10 digits" });
    }

    if (!/^\d{10}$/.test(whatsappNumber)) {
      return res
        .status(400)
        .json({ message: "WhatsApp numbers must be exactly 10 digits" });
    }

    const existingEmail = await userModel.findOne({ collegeEmail });
    if (existingEmail) {
      return res
        .status(400)
        .json({ message: "User with this email already exists" });
    }

    const existingId = await userModel.findOne({ collegeId });
    if (existingId) {
      return res
        .status(400)
        .json({ message: "User with this ID already exists" });
    }

    // Step 1: Generate JWT
    const tokenPayload = { collegeId, name, collegeEmail };
    const token = jwt.sign(tokenPayload, process.env.JWT_SECRET);

    // Step 2: Encrypt the JWT
    const encryptedToken = encryptToken(token);

    const newUser = new userModel({
      name,
      collegeEmail,
      collegeId,
      year,
      department,
      contactNumber,
      whatsappNumber,
      token: encryptedToken,
    });
    await newUser.save();
    res
      .status(201)
      .json({
        message: "User created successfully",
        newUser,
        token: encryptedToken,
      });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Internal server error", error: error.message });
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
  const { id } = req.params;
  try {
    const user = await userModel.findOne({ collegeId: id });
    if (user) {
      res.status(200).json({ message: "USER FOUND", user });
    } else {
      res.status(404).json({ message: "USER NOT FOUND" });
    }
  } catch (error) {
    res.status(500).json({ message: "Internal server error" });
  }
};

exports.scanUser = async (req, res) => {
  const { id } = req.params;
  try {
    const user = await userModel.findOne({ collegeId: id });
    if (user) {
      if (user.isPresent) {
        return res.status(200).json({ message: "Duplicate Entry", user });
      }
      user.isPresent = true;
      await user.save();
      res.status(200).json({ message: "true", user });
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
    res
      .status(500)
      .json({ message: "Internal server error", error: error.message });
  }
};

exports.updateUser = async (req, res) => {
  const { id } = req.params;
  const updatedUser = req.body;
  const {
    name,
    collegeEmail,
    year,
    department,
    contactNumber,
    whatsappNumber,
  } = updatedUser;

  if (
    !name ||
    !collegeEmail ||
    !year ||
    !department ||
    !contactNumber ||
    !whatsappNumber
  ) {
    return res
      .status(400)
      .json({ message: "Please provide all the required fields" });
  }

  try {
    const user = await userModel.findOneAndUpdate(
      { collegeId: id },
      updatedUser,
      { new: true }
    );
    if (user) {
      return res
        .status(200)
        .json({ user, message: "User updated successfully" });
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

exports.deleteAllUsers = async (req, res) => {
  try {
    await userModel.deleteMany({}); // Delete all users from the database
    res.status(200).json({ message: "All users deleted successfully" });
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
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px; background-color: #f4f4f9;">
      <!-- Exciting Header Section -->
      <div style="text-align: center; background-color: #0073e6; padding: 20px; border-radius: 10px 10px 0 0;">
        <img src="https://codenestnshm.netlify.app/web-app-manifest-192x192.png" alt="CodeNEST Logo" style="width: 80px; height: auto; border-radius: 50%;">
        <h2 style="color: #fff; font-size: 28px; margin-top: 10px;">🎉 Welcome to CodeNEST! 🎉</h2>
      </div>
  
      <!-- Greeting Message with Icon -->
      <div style="padding: 20px; background-color: #ffffff; border-radius: 0 0 10px 10px; margin-bottom: 20px;">
        <p style="font-size: 18px; color: #333; text-align: center;">👋 Hello ${name},</p>
        
        <p style="font-size: 16px; color: #555; line-height: 1.8;">
          Thank you for registering at <strong>CodeNEST</strong>! We are thrilled to have you join us for the <strong>grand inauguration</strong> of our club. 
          Get ready for an exciting day packed with innovation, inspiration, and networking! 🚀
        </p>
        
        <p style="font-size: 16px; color: #555; line-height: 1.8;">
          Your personalized QR code is below. Please present it for verification upon arrival. We're excited to meet you in person! 😊
        </p>
      </div>
      
      <!-- Event Date Highlight with Calendar Icon -->
      <div style="text-align: center; padding: 30px 20px; background-color: #e6f4ff; border-radius: 10px; margin-bottom: 20px;">
        <h3 style="color: #e63946; font-size: 32px; font-weight: bold; margin-bottom: 5px;">📅 Save the Date!</h3>
        <p style="font-size: 26px; font-weight: bold; color: #0073e6;">20th November 2024</p>
        <p style="font-size: 20px; color: #555;">Starting at 10:00 AM</p>
      </div>
  
      <!-- Add to Calendar Button -->
      <div style="text-align: center; margin-bottom: 20px;">
        <a href="https://calendar.google.com/calendar/render?action=TEMPLATE&text=CodeNEST+Event&dates=20241120T043000Z/20241120T063000Z&details=Join+us+for+the+grand+inauguration+event+at+CodeNEST!&location=NSHM+Knowledge+Campus,+Durgapur&sf=true&output=xml" 
           target="_blank" style="display: inline-block; padding: 12px 24px; font-size: 16px; color: #fff; background-color: #ff9900; text-decoration: none; border-radius: 50px; box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);">
          📅 Add to Google Calendar
        </a>
      </div>
  
      <!-- QR Code Section with Border -->
      <div style="text-align: center; margin: 20px 0;">
        <img src="cid:qrCodeImage" alt="QR Code" style="width: 160px; height: 160px; border: 2px solid #0073e6; padding: 10px; border-radius: 10px; box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);">
      </div>
  
      <!-- Event Venue Section with Location Icon -->
      <div style="background-color: #f9f9f9; padding: 20px; border-radius: 10px; margin: 20px 0;">
        <h4 style="color: #333; font-size: 18px; margin-bottom: 5px;">📍 Event Venue:</h4>
        <p style="font-size: 16px; color: #555;">Old Seminar Hall,<br> Old B.Tech Building,<br>NSHM Knowledge Campus, Durgapur<br>Via Muchipara Arrah, Durgapur, West Bengal, India</p>
      </div>
  
      <!-- Contact Us Section -->
      <div style="text-align: center; background-color: #ffffff; padding: 20px; border-radius: 10px;">
        <p style="font-size: 14px; color: #555;">
          Have any questions? 📧 Reach us at 
          <a href="mailto:connectcodenest@gmail.com" style="color: #0073e6; text-decoration: none; font-weight: bold;">connectcodenest@gmail.com</a>.
        </p>
      </div>
  
      <!-- Footer -->
      <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 20px 0;">
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
          cid: "qrCodeImage", // same `cid` as in the HTML img src
        },
      ],
    };

    await transporter.sendMail(mailOptions);
    res.status(200).json({ message: "Email sent successfully" });
  } catch (error) {
    console.error("Error sending email:", error);
    res
      .status(500)
      .json({ message: "Error sending email. Please try again later." });
  }
};

exports.getRegistrationCount = async (req, res) => {
  try {
    const count = await userModel.countDocuments();
    res.status(200).json({ count });
  } catch (error) {
    res.status(500).json({ message: "Error fetching registration count" });
  }
};

exports.generateQRCode = async (req, res) => {
  const { encryptedToken } = req.params;

  if (!encryptedToken) {
    return res.status(400).json({ message: "Token is required" });
  }

  try {
    const qrCodeDataUrl = await QRCode.toDataURL(encryptedToken);

    res.status(200).json({ message: "QR code generated successfully", qrCode: qrCodeDataUrl });
  } catch (error) {
    console.error("Error generating QR code:", error.message);
    res.status(500).json({ message: "Internal server error" });
  }
};
