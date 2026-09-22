// src/routes/auth.routes.js
const express = require('express');
const { signup, signin } = require('../controllers/auth.controller');

const router = express.Router();

// POST /api/auth/signup
router.post('/signup', signup);

// POST /api/auth/signin
router.post('/signin', signin);

module.exports = router;