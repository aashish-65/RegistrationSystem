# **Registration System - Industry-Level Documentation**

## **1. Project Overview**

### **Project Name:** Registration System

### **Description:**
The Registration System is a robust backend service designed for managing user registrations, sending seminar pass emails, and verifying user attendance for events. Built using Node.js, Express, and MongoDB, it ensures efficient user management with authentication and encryption mechanisms.

## **2. Installation**

### **Prerequisites:**
Ensure the following are installed on your system:
- Node.js (>= 14.x)
- MongoDB (local or cloud instance)
- Git

### **Setup Instructions:**

1. **Clone the repository:**
   ```sh
   git clone <repository-url>
   cd RegistrationSystem
   ```

2. **Install dependencies:**
   ```sh
   npm install
   ```

3. **Setup Environment Variables:**
   Create a `.env` file in the root directory and configure it as follows:
   ```env
   MONGODB_URI=<your-mongodb-uri>
   PORT=<your-port>
   JWT_SECRET=<your-jwt-secret>
   EMAIL_USER=<your-email>
   EMAIL_PASSWORD=<your-email-password>
   AES_SECRET=<your-aes-secret>
   AES_IV=<your-aes-iv>
   ```

4. **Start the server:**
   ```sh
   npm start
   ```
   The server will run on the specified port in `.env` or default to `5000`.

## **3. API Documentation**

### **Base URL:**
```
http://localhost:<PORT>/api
```

### **Endpoints**

#### **User Registration and Management**

- **POST /register** - Register a new user.
  - **Request Body:**
    ```json
    {
      "name": "John Doe",
      "collegeEmail": "john.doe@nshm.edu.in",
      "collegeId": "12345678901",
      "year": "3rd",
      "department": "CSE",
      "contactNumber": "1234567890",
      "whatsappNumber": "0987654321"
    }
    ```
  - **Response:**
    ```json
    {
      "message": "User created successfully",
      "newUser": { ... },
      "token": "<encrypted-token>"
    }
    ```

- **GET /users** - Fetch all registered users.
  - **Response:**
    ```json
    [ { ... }, { ... } ]
    ```

- **GET /users/:id** - Retrieve user details by college ID.
  - **Response:**
    ```json
    {
      "message": "User found",
      "user": { ... }
    }
    ```

- **PUT /users/update/:id** - Update user information by college ID.
  - **Request Body:** *(Only fields that need updating should be sent)*
    ```json
    {
      "name": "John Doe",
      "year": "4th",
      "department": "CSE",
      "contactNumber": "9876543210"
    }
    ```
  - **Response:**
    ```json
    {
      "user": { ... },
      "message": "User updated successfully"
    }
    ```

- **GET /users/verify/:encryptedToken** - Verify user check-in using an encrypted token.
  - **Response:**
    ```json
    {
      "message": "User checked in successfully",
      "user": { ... }
    }
    ```

- **GET /registrations/count** - Get the total count of registered users.
  - **Response:**
    ```json
    {
      "count": 100
    }
    ```

## **4. Data Models**

### **User Model**

**File:** `models/userModel.js`

```js
const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  collegeEmail: { type: String, required: true, unique: true },
  collegeId: { type: String, required: true, unique: true },
  year: { type: String, required: true },
  department: { type: String, required: true },
  contactNumber: { type: String, required: true },
  whatsappNumber: { type: String, required: true },
  token: { type: String },
  isPresent: { type: Boolean, default: false },
  isSeminarAttendee: { type: Boolean, default: false }
}, { timestamps: true });

module.exports = mongoose.model("User", userSchema);
```

## **5. Controllers**

### **User Controller**

**File:** `controllers/userController.js`

Handles user registration, retrieval, updating, and email functionalities.

## **6. Services**

### **Email Service**

Handles email notifications, such as sending seminar passes and verification emails.

### **Ping Service**

Prevents server sleep by periodically sending requests to keep it active.

## **7. Environment Variables**

Ensure the following variables are correctly configured in your `.env` file:

```env
MONGODB_URI=<your-mongodb-uri>
PORT=<your-port>
JWT_SECRET=<your-jwt-secret>
EMAIL_USER=<your-email>
EMAIL_PASSWORD=<your-email-password>
AES_SECRET=<your-aes-secret>
AES_IV=<your-aes-iv>
```

## **8. Contributing**

### **Contribution Guidelines**

1. **Fork the repository.**
2. **Create a feature branch:**
   ```sh
   git checkout -b feature-branch
   ```
3. **Implement your changes.**
4. **Commit your changes:**
   ```sh
   git commit -m "Add new feature"
   ```
5. **Push to your branch:**
   ```sh
   git push origin feature-branch
   ```
6. **Create a Pull Request on GitHub.**

