const express = require('express');
const router = express.Router();
const userControllers = require('../controllers/userController');

router.post('/register', userControllers.register);
router.get('/users', userControllers.getUsers);
router.get('/users/:id', userControllers.getUser);
router.get('/users/scan/:id', userControllers.scanUser);
router.put('/users/update/:id', userControllers.updateUser);
router.delete('/users/delete/:id', userControllers.deleteUser);


module.exports = router;
