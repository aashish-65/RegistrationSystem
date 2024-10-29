const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({

    name: {
        type: String,
        required: true
    },
    email: {
        type: String,
        required: true
    },
    collegeId: {
        type: String,
        required: true
    },
    department: {
        type: String,
        required: true
    },
    isPresent:{
        type: Boolean,
        default: false
    }
});

module.exports = mongoose.model('User', userSchema);