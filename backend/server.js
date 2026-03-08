const express = require('express');
const cors = require('cors');
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { authenticateToken, authorizeRole } = require('./middleware/auth');
require('dotenv').config();

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET;

app.use(cors());
app.use(express.json());

// --- ROUTES ---

// 1. Updated Register Route with Security Validation (Admin Only)
app.post('/register', authenticateToken, authorizeRole('ADMIN'), async (req, res) => {
    const { full_name, email, password, role } = req.body;

    // Security Check: Password Complexity
    if (!password || password.length < 8) {
        return res.status(400).json({ error: "Password must be at least 8 characters long." });
    }

    try {
        // Task 3: Implement bcrypt encryption
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(password, saltRounds);

        const newUser = await prisma.user.create({
            data: { 
                full_name, 
                email, 
                password_hash: hashedPassword, // Store only the hash
                role: role || 'EMPLOYEE'
            }
        });
        res.status(201).json({ message: "User registered securely." });
    } catch (error) {
        res.status(400).json({ error: "Registration failed. Email might already be in use." });
    }
});

// 2. Login Route
app.post('/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        // Find user by email
        const user = await prisma.user.findUnique({ 
            where: { email: email } 
        });

        if (!user) {
            return res.status(401).json({ message: "Invalid credentials" });
        }

        // Compare plain text password with password_hash from DB
        const isMatch = await bcrypt.compare(password, user.password_hash);
        
        if (!isMatch) {
            return res.status(401).json({ message: "Invalid credentials" });
        }

        // Create JWT
        const token = jwt.sign(
            { user_id: user.user_id, role: user.role }, 
            process.env.JWT_SECRET, 
            { expiresIn: '1d' }
        );
        
        res.json({ 
            token, 
            user: { user_id: user.user_id, full_name: user.full_name, role: user.role } 
        });
    } catch (error) {
        console.error("Login Error:", error);
        res.status(500).json({ error: "Server error" });
    }
});

// 3. Equipment Management Route (Admin Only)
app.post('/api/equipment', authenticateToken, authorizeRole('ADMIN'), async (req, res) => {
    const { name, quantity, condition, status } = req.body;
    try {
        const newEquipment = await prisma.equipment_Inventory.create({
            data: { name, quantity, condition, status: status || 'Available' }
        });
        res.status(201).json({ message: "Equipment added successfully", equipment: newEquipment });
    } catch (error) {
        res.status(500).json({ error: "Failed to add equipment" });
    }
});

// Health Check Endpoint (for Docker/Kubernetes health monitoring)
app.get('/health', async (req, res) => {
    try {
        // Check database connection
        await prisma.$queryRaw`SELECT 1`;
        res.status(200).json({ 
            status: 'healthy',
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
            database: 'connected'
        });
    } catch (error) {
        res.status(503).json({ 
            status: 'unhealthy',
            timestamp: new Date().toISOString(),
            database: 'disconnected',
            error: error.message
        });
    }
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
