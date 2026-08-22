import ChatMessage from './src/models/ChatMessage';
import dotenv from 'dotenv';
dotenv.config();

async function testFind() {
  try {
    const messages = await ChatMessage.find({ room: 'Forex Ideas 💡' })
      .sort({ createdAt: -1 })
      .limit(50)
      .populate('replyTo', 'username text mediaUrl')
      .lean();
    
    console.log("ChatMessage.find count:", messages?.length);
    if (messages && messages.length > 0) {
      console.log("First message in find:", messages[0]);
    }
  } catch (e) {
    console.error(e);
  }
}

testFind();
