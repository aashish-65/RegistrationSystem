const userModel = require("../models/userModel");
const nodemailer = require("nodemailer");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const QRCode = require("qrcode");
const axios = require("axios");

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
    }

    console.log(
      "Token generation and update complete for all users without a token."
    );
    res.status(200).json({
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
    res.status(201).json({
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

      // user.isPresent = true;
      // await user.save();

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
  const { name, collegeEmail } = req.body;

  try {
    const transporter = nodemailer.createTransport({
      service: "Gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD,
      },
    });

    // Enhanced HTML template with personalized greeting and improved design
    const emailHtml = `
      <div
      style="
        font-family: Arial, sans-serif;
        max-width: 600px;
        margin: auto;
        padding: 20px;
        border: 1px solid #e0e0e0;
        border-radius: 10px;
        background-color: #f4f4f9;
      "
    >
      <!-- Exciting Header Section -->
      <div
        style="
          text-align: center;
          background-color: #e60000;
          padding: 20px;
          border-radius: 10px 10px 0 0;
        "
      >
        <img
          src="https://codenestnshm.netlify.app/web-app-manifest-192x192.png"
          alt="CodeNEST Logo"
          style="width: 80px; height: auto; border-radius: 50%"
        />
        <h2 style="color: #fff; font-size: 28px; margin-top: 10px">
          Attention Folks!
        </h2>
      </div>

      <!-- Content -->
      <div
        style="
          padding: 20px;
          background-color: #ffffff;
          border-radius: 0 0 10px 10px;
          margin-bottom: 20px;
          font-family: Arial, sans-serif;
        "
      >
        <!-- Greeting -->
        <p
          style="
            font-size: 20px;
            color: #333;
            text-align: center;
            font-weight: bold;
            margin-bottom: 20px;
          "
        >
          👋 Hello ${name},
        </p>

        <!-- Welcome Message -->
        <p
          style="
            font-size: 16px;
            color: #555;
            line-height: 1.8;
            text-align: justify;
            margin-bottom: 20px;
          "
        >
          You are cordially invited to
          <strong>CodeNEST's Inauguration Event</strong>! We are thrilled to
          have you as part of our growing community. Join us as we celebrate the
          spirit of open-source collaboration and innovation.
        </p>

        <!-- Event Details -->
        <p
          style="
            font-size: 16px;
            color: #555;
            line-height: 1.8;
            text-align: justify;
            margin-bottom: 20px;
          "
        >
          <strong>Event:</strong> CodeNEST inauguration<br />
          <strong>When:</strong> 20th November, 2024 at 10:00 AM<br />
          <strong>Where:</strong> Seminar Hall, Admin Building<br />
        </p>

        <p
          style="
            font-size: 16px;
            color: #f02929;
            line-height: 1.8;
            text-align: center;
            margin-bottom: 20px;
          "
        >
          <strong>
            IF YOU ARE COMMING TO THE EVENT, PLEASE RSVP BY CLICKING THE LINK
            BELOW.</strong
          >
        </p>

        <p
          style="
            font-size: 16px;
            color: #0c0b0b;
            line-height: 1.8;
            text-align: justify;
            margin-bottom: 20px;
          "
        >
          <strong>
            (Note: Use your College Email to fill the RSVP Form.)</strong
          >
        </p>

        <!-- RSVP Button -->
        <div style="text-align: center; margin-bottom: 30px">
          <a
            href="https://form.jotform.com/243225270055448"
            target="_blank"
            style="
              display: inline-block;
              padding: 12px 30px;
              font-size: 16px;
              color: #fff;
              background-color: #1e90ff;
              text-decoration: none;
              border-radius: 50px;
              box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
            "
          >
            RSVP Now
          </a>
        </div>

        <!-- Join Group Button -->
        <div style="text-align: center; margin-bottom: 30px">
          <a
            href="https://join.slack.com/t/codenestopens-znm8263/shared_invite/zt-2tegvnkcl-oxhiXZ5PP8OKQv~5Z3XjJQ"
            target="_blank"
            style="
              display: inline-block;
              padding: 12px 30px;
              font-size: 16px;
              color: #fff;
              background-color: #0073e6;
              text-decoration: none;
              border-radius: 50px;
              box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
            "
          >
            Join Official CodeNEST Group
          </a>
        </div>

        <!-- Closing Message -->
        <p
          style="
            font-size: 16px;
            color: #555;
            line-height: 1.8;
            text-align: justify;
            margin-bottom: 20px;
          "
        >
          Don’t miss this incredible opportunity to connect, learn, and grow
          with like-minded individuals. We can’t wait to see you there!
        </p>

        <!-- Signature -->
        <p
          style="
            font-size: 16px;
            color: #333;
            font-weight: bold;
            margin: 10px 0;
          "
        >
          Warm regards,
          <br />Team CodeNEST
        </p>

        <!-- Note Section -->
        <div
          style="
            margin-top: 30px;
            padding: 15px;
            background-color: #f9f9f9;
            border-radius: 10px;
          "
        >
          <p style="font-size: 20px; color: #ff0000">
            <strong>Note:</strong> Please carry your laptop to the event if you
            have one.
          </p>
        </div>
      </div>

      <!-- Event Date Highlight with Calendar Icon -->
      <div
        style="
          text-align: center;
          padding: 30px 20px;
          background-color: #e6f4ff;
          border-radius: 10px;
          margin-bottom: 20px;
        "
      >
        <h3
          style="
            color: #e63946;
            font-size: 32px;
            font-weight: bold;
            margin-bottom: 5px;
          "
        >
          Save the Date!
        </h3>
        <p style="font-size: 26px; font-weight: bold; color: #0073e6">
          20th November 2024
        </p>
        <p style="font-size: 20px; color: #555">Starting at 10:00 AM</p>
      </div>

      <!-- Add to Calendar Button -->
      <div style="text-align: center; margin-bottom: 20px">
        <a
          href="https://calendar.google.com/calendar/render?action=TEMPLATE&text=CodeNEST+Event&dates=20241120T043000Z/20241120T063000Z&details=Join+us+for+the+grand+inauguration+event+at+CodeNEST!&location=NSHM+Knowledge+Campus,+Durgapur&sf=true&output=xml"
          target="_blank"
          style="
            display: inline-block;
            padding: 12px 24px;
            font-size: 16px;
            color: #fff;
            background-color: #ff9900;
            text-decoration: none;
            border-radius: 50px;
            box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
          "
        >
          Add to Google Calendar
        </a>
      </div>

      <!-- Event Venue Section with Location Icon -->
      <div
        style="
          background-color: #f9f9f9;
          padding: 20px;
          border-radius: 10px;
          margin: 20px 0;
        "
      >
        <h4 style="color: #333; font-size: 18px; margin-bottom: 5px">
          <strong>(Venue Updated)</strong>
          <br/><br/>
          📍 Event Venue:
        </h4>
        <p style="font-size: 16px; color: #555">
          Seminar Hall,<br />
          Admin Building,<br />
          NSHM Knowledge Campus, Durgapur<br />Via
          Muchipara Arrah, Durgapur, West Bengal, India
        </p>
      </div>

      <!-- Contact Us Section -->
      <div
        style="
          text-align: center;
          background-color: #ffffff;
          padding: 20px;
          border-radius: 10px;
        "
      >
        <p style="font-size: 14px; color: #555">
          Have any questions? <br />📧 Reach us at
          <a
            href="mailto:connectcodenest@gmail.com"
            style="color: #0073e6; text-decoration: none; font-weight: bold"
            >connectcodenest@gmail.com</a
          >.
        </p>
      </div>

      <!-- Footer -->
      <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 20px 0" />
      <p style="text-align: center; font-size: 12px; color: #999">
        © ${new Date().getFullYear()} CodeNEST. All rights reserved.
      </p>
    </div>
    `;

    // Send email with QR code attachment
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: collegeEmail,
      subject: `RSVP for CodeNEST!`,
      html: emailHtml,
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

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
exports.sendBulkEmails = async (req, res) => {
  try {
    // Fetch all users from the API
    // const response = await axios.get(
    //   "https://registrationsystem-1a4m.onrender.com/api/users/"
    // );
    // const users = [];

    if (!users || users.length === 0) {
      return res
        .status(404)
        .json({ message: "No users found to send emails to." });
    }

    // Send email to each user with a delay of 10 seconds between each email
    for (const user of users) {
      const { name, collegeEmail } = user;

      try {
        // Send POST request to mail API
        const mailData = {
          name: name,
          collegeEmail: collegeEmail,
        };

        const mailResponse = await axios.post(
          "http://localhost:5000/api/send-email",
          mailData
        );
        console.log(`Email sent to ${collegeEmail}:`, mailResponse.data); // Log success

        // Wait for 10 seconds before sending the next email
        await delay(5000);
      } catch (emailError) {
        console.error(
          `Error sending email to ${collegeEmail}:`,
          emailError.message
        );
      }
    }

    res.status(200).json({
      message: "All emails processed with a 5-second delay between each.",
    });
  } catch (error) {
    console.error("Error fetching users:", error);
    res
      .status(500)
      .json({ message: "Error processing emails. Please try again later." });
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

    res.status(200).json({
      message: "QR code generated successfully",
      qrCode: qrCodeDataUrl,
    });
  } catch (error) {
    console.error("Error generating QR code:", error.message);
    res.status(500).json({ message: "Internal server error" });
  }
};

exports.registerUser = async (req, res) => {
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

    // Validate input fields
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
        .json({ message: "Contact number must be 10 digits" });
    }

    if (!/^\d{10}$/.test(whatsappNumber)) {
      return res
        .status(400)
        .json({ message: "WhatsApp number must be 10 digits" });
    }

    // Check for existing email or ID
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

    // Generate JWT and encrypt it
    const tokenPayload = { collegeId, name, collegeEmail };
    const token = jwt.sign(tokenPayload, process.env.JWT_SECRET);
    const encryptedToken = encryptToken(token);

    // Generate QR Code for the encrypted token
    // const qrCodeDataUrl = await QRCode.toDataURL(encryptedToken);

    // Save user in the database
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
    // const qrCodeBuffer = Buffer.from(qrCodeDataUrl.split(",")[1], "base64");

    // Send email with QR code
    const transporter = nodemailer.createTransport({
      service: "Gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD,
      },
    });

    const emailHtml = `
            <div
      style="
        font-family: Arial, sans-serif;
        max-width: 600px;
        margin: auto;
        padding: 5px;
        border: 1px solid #e0e0e0;
        border-radius: 10px;
        background-color: #f4f4f9;
      "
    >
      <!-- Exciting Header Section -->
      <div
        style="
          text-align: center;
          background-color: #0073e6;
          padding: 20px;
          border-radius: 10px 10px 0 0;
        "
      >
        <img
          src="https://codenestnshm.netlify.app/web-app-manifest-192x192.png"
          alt="CodeNEST Logo"
          style="width: 80px; height: auto; border-radius: 50%"
        />
        <h2 style="color: #fff; font-size: 25px; margin-top: 10px">
          🎉 Welcome to CodeNEST! 🎉
        </h2>
      </div>

      <!-- Greeting Message with Icon -->
      <div
        style="
          padding: 20px;
          background-color: #ffffff;
          border-radius: 0 0 10px 10px;
          margin-bottom: 20px;
        "
      >
        <p style="font-size: 18px; color: #333; text-align: center">
          👋 Hello ${name},
        </p>

        <p style="font-size: 16px; color: #555; line-height: 1.6">
          Thank you for joining <strong>CodeNEST</strong>! We are beyond excited
          to have you as part of our open-source community. Together, we aim to
          foster creativity, collaboration, and learning. 🚀
        </p>

        <p style="font-size: 16px; color: #555; line-height: 1.8">
          To stay connected and up-to-date with our latest projects and events,
          we invite you to join our official Slack group. Let’s make innovation
          happen as a team!
        </p>
      </div>

      <!-- Join Slack Group Button -->
      <div style="text-align: center; margin-bottom: 30px">
        <a
          href="https://join.slack.com/t/codenestopens-znm8263/shared_invite/zt-2tegvnkcl-oxhiXZ5PP8OKQv~5Z3XjJQ"
          target="_blank"
          style="
            display: inline-block;
            padding: 12px 30px;
            font-size: 16px;
            color: #fff;
            background-color: #0073e6;
            text-decoration: none;
            border-radius: 50px;
            box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
          "
        >
          Join Group
        </a>
      </div>

      <!-- Join OSDC Section -->
      <div
        style="
          padding: 20px;
          background-color: #f9f9f9;
          border-radius: 10px;
          margin-bottom: 30px;
        "
      >
        <p
          style="
            font-size: 16px;
            color: #555;
            line-height: 1.6;
          "
        >
          Are you ready to take your coding journey to the next level? Join
          <strong>OSSDC</strong> (Open Source Student Developers Club) to become a
          part of an even larger network of passionate developers. Learn, share,
          and grow with coders from all around the globe! 🌍
        </p>

        <div style="text-align: center">
          <a
            href="https://www.commudle.com/communities/open-source-student-developers-club"
            target="_blank"
            style="
              display: inline-block;
              padding: 12px 20px;
              font-size: 15px;
              color: #fff;
              background-color: #34a853;
              text-decoration: none;
              border-radius: 50px;
              box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
            "
          >
            Join OSSDC Now
          </a>
        </div>
      </div>

      <!-- Visit Website Button -->
      <div style="text-align: center">
        <p
          style="
            font-size: 16px;
            color: #555;
            line-height: 1.6;
            text-align: justify;
            margin-bottom: 20px;
          "
        >
          Explore more about us and stay updated by visiting our official
          website.
        </p>
        <a
          href="https://codenestnshm.netlify.app/"
          target="_blank"
          style="
            display: inline-block;
            padding: 12px 20px;
            font-size: 15px;
            color: #fff;
            background-color: #e63946;
            text-decoration: none;
            border-radius: 50px;
            box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
          "
        >
          Visit Website
        </a>
      </div>

      <!-- Signature -->
      <p
        style="
          font-size: 16px;
          color: #333;
          font-weight: bold;
          text-align: center;
          margin-top: 30px;
        "
      >
        Regards,<br />Team CodeNEST
      </p>

      <!-- Contact Us Section -->
      <div
        style="
          text-align: center;
          background-color: #ffffff;
          padding: 20px;
          border-radius: 10px;
        "
      >
        <p style="font-size: 14px; color: #555">
          Have any questions? <br />📧 Reach us at
          <a
            href="mailto:connectcodenest@gmail.com"
            style="color: #0073e6; text-decoration: none; font-weight: bold"
            >connectcodenest@gmail.com</a
          >.
        </p>
      </div>

      <!-- Footer -->
      <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 20px 0" />
      <p style="text-align: center; font-size: 12px; color: #999">
        © ${new Date().getFullYear()} CodeNEST. All rights reserved.
      </p>
    </div>
    `;

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: collegeEmail,
      subject: `Welcome to CodeNEST, ${name}!`,
      html: emailHtml,
    };
    await transporter.sendMail(mailOptions);

    // Respond with success
    res.status(201).json({
      message: "User registered and email sent successfully",
    });
  } catch (error) {
    console.error("Error in registration process:", error.message);
    res
      .status(500)
      .json({ message: "Internal server error", error: error.message });
  }
};
