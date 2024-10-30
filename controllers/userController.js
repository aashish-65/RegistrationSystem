const userModel = require("../models/userModel");

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
