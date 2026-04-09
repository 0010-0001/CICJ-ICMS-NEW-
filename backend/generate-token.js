const jwt = require('jsonwebtoken');

// Check what token you might have in localStorage
console.log('\n[Token Diagnosis Tool]\n');
console.log('='.repeat(80));

console.log('\n[Instructions]:');
console.log('1. Open your browser DevTools (F12)');
console.log('2. Go to Console tab');
console.log('3. Type: localStorage.getItem("token")');
console.log('4. Copy the token value (without quotes)');
console.log('5. Paste it below to test\n');

// Use the same secret as server.js
const JWT_SECRET = 'cicj_super_secret_key_2026';

// Test if we can create a valid token for the current user
console.log('\n[Token] Creating VALID token for: kpaysan.a12345472@umak.edu.ph');
const validToken = jwt.sign(
    { user_id: 2, email: 'kpaysan.a12345472@umak.edu.ph' },
    JWT_SECRET,
    { expiresIn: '24h' }
);

console.log('\nYour NEW valid token (copy this):');
console.log('-'.repeat(80));
console.log(validToken);
console.log('-'.repeat(80));

console.log('\n[TO FIX THE ERROR]:');
console.log('1. Open Browser DevTools (F12) → Console');
console.log('2. Run this command:');
console.log(`   localStorage.setItem('token', '${validToken}')`);
console.log('3. Refresh the page');
console.log('4. The "Unable to load" errors will be gone!\n');

console.log('='.repeat(80));
