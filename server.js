const express = require('express');
const axios = require('axios');
const cors = require('cors');
const admin = require('firebase-admin');
require('dotenv').config();

/**
 * FORGE AI BACKEND - OAUTH & INJECTION ENGINE
 * VERSION: 1.0.6 - Debugging & Route Verification
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
        console.error("❌ Firebase Init Error:", e.message);
    }
}

const db = admin.firestore();
const app = express();

// 1. GLOBAL MIDDLEWARE
app.use(cors());
app.use(express.json());

// Request Logger: This will help us see exactly what Railway is receiving
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
});

// Environment Variables from Railway
const SHOPIFY_API_KEY = process.env.SHOPIFY_CLIENT_ID;
const SHOPIFY_API_SECRET = process.env.SHOPIFY_CLIENT_SECRET;
const BACKEND_URL = "https://forge-backend-production-b124.up.railway.app";

// 2. PRIMARY ENDPOINTS

// HEALTH CHECK (Verify this version is live)
app.get('/health', (req, res) => {
    res.json({
        status: "Online",
        version: "1.0.6",
        timestamp: new Date().toISOString(),
        endpoints: ["/api/auth/shopify", "/api/shopify/callback", "/api/test/handshake"],
        firebase: !!admin.apps.length
    });
});

app.get('/', (req, res) => {
    res.send("Forge Engine is running. Visit /health to verify endpoints.");
});

/**
 * TEST ENDPOINT: SIMULATE HANDSHAKE SUCCESS
 * URL: /api/test/handshake?uid=YOUR_UID
 */
app.get('/api/test/handshake', async (req, res) => {
    const { uid } = req.query;
    if (!uid) return res.status(400).send("Missing uid for testing. Add ?uid=xyz to the URL.");

    try {
        if (db) {
            const userRef = db.collection('artifacts').doc('forge-app').collection('users').doc(uid);
            await userRef.set({
                tier: 'Commander',
                shopUrl: 'test-store.myshopify.com',
                shopifyToken: 'mock_token_12345',
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
            console.log(`✅ Test Handshake Successful for UID: ${uid}`);
        }

        res.send(`
            <html>
                <body style="background: #0A0A0B; color: white; font-family: sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0;">
                    <div style="text-align: center; border: 1px solid #34d399; padding: 40px; border-radius: 20px; background: #064e3b; max-width: 400px; box-shadow: 0 0 50px rgba(52,211,153,0.2);">
                        <h1 style="color: #34d399; margin-bottom: 10px;">TEST SUCCESS</h1>
                        <p style="color: #a7f3d0;">Simulated Handshake for UID: <b>${uid}</b></p>
                        <p style="font-size: 0.8rem; color: #065f46; margin-top: 20px;">The UI in your other tab should flip to Commander now.</p>
                        <script>
                            localStorage.setItem('rank_${uid}', 'Commander');
                            setTimeout(() => window.close(), 3000);
                        </script>
                    </div>
                </body>
            </html>
        `);
    } catch (e) {
        console.error("Test Fail:", e.message);
        res.status(500).send("Test simulation failed: " + e.message);
    }
});

// --- STEP 1: START THE HANDSHAKE ---
app.get('/api/auth/shopify', (req, res) => {
    const { shop, uid } = req.query;
    if (!shop) return res.status(400).send("Missing shop parameter");

    const scopes = 'read_products,write_products,read_content,write_content';
    const redirectUri = `${BACKEND_URL}/api/shopify/callback`;
    const state = uid || "default_merchant";
    
    const installUrl = `https://${shop}/admin/oauth/authorize?client_id=${SHOPIFY_API_KEY}&scope=${scopes}&redirect_uri=${redirectUri}&state=${state}`;
    
    console.log(`🚀 Redirecting to Shopify for store: ${shop}`);
    res.redirect(installUrl);
});

// --- STEP 2: COMPLETE THE HANDSHAKE (CALLBACK) ---
app.get('/api/shopify/callback', async (req, res) => {
    const { shop, code, state: uid } = req.query;

    if (!code) return res.status(400).send("No authorization code provided");

    try {
        const accessTokenResponse = await axios.post(`https://${shop}/admin/oauth/access_token`, {
            client_id: SHOPIFY_API_KEY,
            client_secret: SHOPIFY_API_SECRET,
            code
        });

        const accessToken = accessTokenResponse.data.access_token;

        if (db && uid && uid !== "default_merchant") {
            const userRef = db.collection('artifacts').doc('forge-app').collection('users').doc(uid);
            await userRef.set({
                tier: 'Commander',
                shopUrl: shop,
                shopifyToken: accessToken,
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
        }

        res.send(`
            <html>
                <body style="background: #0A0A0B; color: white; font-family: sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0;">
                    <div style="text-align: center; border: 1px solid #f59e0b; padding: 40px; border-radius: 20px; background: #121214; max-width: 400px; box-shadow: 0 0 50px rgba(245,158,11,0.2);">
                        <h1 style="color: #f59e0b; margin-bottom: 10px; font-size: 2rem;">RANK ACTIVATED</h1>
                        <p style="color: #94a3b8;">Neural link to <b>${shop}</b> established.</p>
                        <script>
                            localStorage.setItem('rank_${uid}', 'Commander');
                            setTimeout(() => window.close(), 2500);
                        </script>
                    </div>
                </body>
            </html>
        `);
    } catch (error) {
        console.error("❌ OAuth Error:", error.response?.data || error.message);
        res.status(500).send("Handshake failed. Check Railway environment variables.");
    }
});

// Catch-all for 404s
app.use((req, res) => {
    res.status(404).send(`Route ${req.url} not found on this server.`);
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`🔥 Forge Engine burning on port ${PORT}`);
    console.log(`📍 Health check available at ${BACKEND_URL}/health`);
});
