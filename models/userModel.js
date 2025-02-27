const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  collegeEmail: {
    type: String,
    required: true,
  },
  collegeId: {
    type: Number,
    required: true,
  },
  year: {
    type: String,
    required: true,
  },
  department: {
    type: String,
    required: true,
  },
  contactNumber: {
    type: Number,
    required: true,
  },
  whatsappNumber: {
    type: Number,
    required: true,
  },
  token: {
    type: String,
    required: true,
  },
  isPresent: {
    type: Boolean,
    default: false,
  },
  isSeminarAttendee: {
    type: Boolean,
    default: false,
  },
});

module.exports = mongoose.model("User", userSchema);
