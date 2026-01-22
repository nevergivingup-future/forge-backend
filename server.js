const express = require('express');
const axios = require('axios');
const cors = require('cors');
const admin = require('firebase-admin');
require('dotenv').config();

/**
 * FORGE AI BACKEND - OAUTH & INJECTION ENGINE
 */

// Initialize Firebase
if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    try {
        const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
        });
        console.log("✅ Forge Firebase Engine: Online");
    } catch (e) {
        console.error("❌ Firebase Init Error");
    }
}

const db = admin.firestore();
const app = express();
app.use(cors());
app.use(express.json());

// Environment Variables from Railway
const SHOPIFY_API_KEY = process.env.SHOPIFY_CLIENT_ID;
const SHOPIFY_API_SECRET = process.env.SHOPIFY_CLIENT_SECRET;
const BACKEND_URL = "https://forge-backend-production-b124.up.railway.app";

app.get('/', (req, res) => res.send("Forge Engine is running."));

// --- STEP 1: START THE HANDSHAKE ---
// Matches your Dashboard App URL: /api/auth/shopify
app.get('/api/auth/shopify', (req, res) => {
    const { shop, uid } = req.query;
    
    if (!shop) return res.status(400).send("Missing shop parameter");

    // Scopes match your Shopify Partner Dashboard exactly
    const scopes = 'read_products,write_products,read_content,write_content';
    
    // Redirect URI matches your Shopify Partner Dashboard: /api/shopify/callback
    const redirectUri = `${BACKEND_URL}/api/shopify/callback`;
    
    // We pass the UID as the state to identify the user on return
    const state = uid || "default_merchant";
    
    const installUrl = `https://${shop}/admin/oauth/authorize?client_id=${SHOPIFY_API_KEY}&scope=${scopes}&redirect_uri=${redirectUri}&state=${state}`;
    
    console.log(`🚀 Redirecting to Shopify for store: ${shop}`);
    res.redirect(installUrl);
});

// --- STEP 2: COMPLETE THE HANDSHAKE (CALLBACK) ---
// Matches your Dashboard Redirect URL: /api/shopify/callback
app.get('/api/shopify/callback', async (req, res) => {
    const { shop, code, state: uid } = req.query;

    if (!code) return res.status(400).send("No authorization code provided");

    try {
        // Exchange authorization code for permanent Access Token
        const accessTokenResponse = await axios.post(`https://${shop}/admin/oauth/access_token`, {
            client_id: SHOPIFY_API_KEY,
            client_secret: SHOPIFY_API_SECRET,
            code
        });

        const accessToken = accessTokenResponse.data.access_token;
        console.log(`✅ Access Token secured for ${shop}`);

        // Update Rank to Commander in Firestore
        if (db && uid && uid !== "default_merchant") {
            const userRef = db.collection('artifacts').doc('forge-app').collection('users').doc(uid);
            await userRef.set({
                tier: 'Commander',
                shopUrl: shop,
                shopifyToken: accessToken,
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
            console.log(`🏆 User ${uid} promoted to Commander`);
        }

        // Return Success UI to close the window
        res.send(`
            <html>
                <body style="background: #0A0A0B; color: white; font-family: sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0;">
                    <div style="text-align: center; border: 1px solid #f59e0b; padding: 40px; border-radius: 20px; background: #121214; max-width: 400px; box-shadow: 0 0 50px rgba(245,158,11,0.2);">
                        <h1 style="color: #f59e0b; margin-bottom: 10px; font-size: 2rem;">RANK ACTIVATED</h1>
                        <p style="color: #94a3b8;">Neural link to <b>${shop}</b> established.</p>
                        <p style="font-size: 0.8rem; color: #475569; margin-top: 20px;">Closing window and returning to Forge Terminal...</p>
                        <script>
                            // Signal the local session
                            localStorage.setItem('rank_${uid}', 'Commander');
                            setTimeout(() => window.close(), 2500);
                        </script>
                    </div>
                </body>
            </html>
        `);
    } catch (error) {
        console.error("❌ OAuth Error:", error.response?.data || error.message);
        res.status(500).send("Handshake failed. Check Railway environment variables and Shopify API keys.");
    }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`🔥 Forge Engine burning on port ${PORT}`));
