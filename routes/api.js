const express = require('express');
const router = express.Router();
const userControllers = require('../controllers/userController');

router.post('/register', userControllers.registerUser);
router.get('/users', userControllers.getUsers);
router.get('/users/:id', userControllers.getUser);
// router.delete('/users/delete/:id', userControllers.deleteUser);
router.get('/users/verify/:encryptedToken', userControllers.verifyUser);
router.get('/registrations/count', userControllers.getRegistrationCount);
// router.get('/users/scan/:id', userControllers.scanUser);
// router.put('/users/update/:id', userControllers.updateUser);
// router.delete('/users/delete-all', userControllers.deleteAllUsers);
// router.post('/send-email', userControllers.sendEmail);
// router.get('/send-bulk-email', userControllers.sendBulkEmails)
// router.get('/send-jwt-token', userControllers.sendJWTToken);
// router.get('/qr-generate/:encryptedToken',userControllers.generateQRCode)

module.exports = router;