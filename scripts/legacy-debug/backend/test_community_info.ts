import Community from './src/models/Community';
import dotenv from 'dotenv';
dotenv.config();

async function testFindCommunity() {
  try {
    const community = await Community.findOne({ name: 'Forex Ideas 💡', isActive: true });
    console.log("Community found:", community);
  } catch (e) {
    console.error(e);
  }
}

testFindCommunity();
