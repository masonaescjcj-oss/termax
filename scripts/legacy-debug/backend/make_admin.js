const mongoose = require('mongoose');
const dotenv = require('dotenv');
const bcrypt = require('bcryptjs');

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/trade_app';

const userSchema = new mongoose.Schema({
    username: String,
    email: String,
    passwordHash: String,
    role: String
}, { collection: 'users' });

const User = mongoose.model('User', userSchema);

async function makeAdmin() {
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to DB');
    
    const hash = await bcrypt.hash('admin123456', 10);
    
    let admin = await User.findOne({ username: 'admin' });
    if (!admin) {
        admin = new User({ username: 'admin', email: 'admin@trade.com' });
    }
    
    admin.role = 'admin';
    admin.passwordHash = hash;
    await admin.save();
    
    console.log('Admin account ready! Username: admin, Password: admin123456');
    
    await mongoose.disconnect();
}

makeAdmin().catch(console.error);
