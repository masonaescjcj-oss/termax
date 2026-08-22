import axios from 'axios';

const CLIENT_ID = process.env.CTRADER_CLIENT_ID || '';
const CLIENT_SECRET = process.env.CTRADER_CLIENT_SECRET || '';
const REDIRECT_URI = process.env.CTRADER_REDIRECT_URI || 'http://localhost:5000/api/v1/trade/callback';
const TOKEN_URL = 'https://openapi.ctrader.com/apps/token';

export const getAuthUrl = () => {
    // Generate the URL for the user to login and authorize our app
    const authUrl = `https://connect.spotware.com/apps/auth?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&scope=trading`;
    return authUrl;
};

export const getAccessToken = async (authCode: string) => {
    try {
        const response = await axios.post(TOKEN_URL, null, {
            params: {
                grant_type: 'authorization_code',
                code: authCode,
                client_id: CLIENT_ID,
                client_secret: CLIENT_SECRET,
                redirect_uri: REDIRECT_URI
            }
        });

        // The response will contain: accessToken, refreshToken, and expiresIn
        return response.data;
    } catch (error: any) {
        console.error('Error fetching access token:', error.response?.data || error.message);
        throw new Error('Failed to get access token from cTrader');
    }
};

// We will store the token here temporarily in memory. 
// In a real app, this goes to the MongoDB user document.
let currentAccessToken: string | null = null;
let currentAccountId: string | null = null; // cTrader account ID

export const setToken = (token: string) => {
    currentAccessToken = token;
};

export const getToken = () => {
    return currentAccessToken;
};
