const mongoose = require("mongoose");

const testSchema = new mongoose.Schema({
  count: {
    type: Number,
  },
}, { timestamps: true });

module.exports = mongoose.model("Test", testSchema);
