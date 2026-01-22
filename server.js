const express = require('express');
const axios = require('axios');
const cors = require('cors');
const admin = require('firebase-admin');
require('dotenv').config();

/**
 * FORGE AI BACKEND - OAUTH & INJECTION ENGINE
 * VERSION: 1.0.26 - Enhanced Handshake & Signal
 */

let db;
if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    try {
        const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
        if (!admin.apps.length) {
            admin.initializeApp({
                credential: admin.credential.cert(serviceAccount),
                projectId: serviceAccount.project_id 
            });
        }
        db = admin.firestore();
    } catch (e) { console.error("Firebase Init Error:", e.message); }
}

const app = express();
const appId = "forge-app"; 

app.use(cors({ origin: '*' }));
app.use(express.json());

const SHOPIFY_API_KEY = process.env.SHOPIFY_CLIENT_ID;
const SHOPIFY_API_SECRET = process.env.SHOPIFY_CLIENT_SECRET;
const BACKEND_URL = "https://forge-backend-production-b124.up.railway.app";

app.get('/health', (req, res) => res.json({ status: "Online", version: "1.0.26", firebase: !!db }));

// 1. Redirect to Shopify
app.get('/api/auth/shopify', (req, res) => {
    const { shop, uid } = req.query;
    if (!shop) return res.status(400).send("Missing shop domain");
    
    // Ensure the shop URL is clean
    const cleanShop = shop.includes('myshopify.com') ? shop : `${shop}.myshopify.com`;
    
    const scopes = 'read_products,write_products';
    const redirectUri = `${BACKEND_URL}/api/shopify/callback`;
    
    const installUrl = `https://${cleanShop}/admin/oauth/authorize?client_id=${SHOPIFY_API_KEY}&scope=${scopes}&redirect_uri=${redirectUri}&state=${uid || 'anon'}`;
    
    console.log(`🔗 Authorizing Store: ${cleanShop} for UID: ${uid}`);
    res.redirect(installUrl);
});

// 2. Callback from Shopify
app.get('/api/shopify/callback', async (req, res) => {
    const { shop, code, state: uid } = req.query;
    if (!code) return res.status(400).send("No authorization code provided");

    try {
        // Exchange code for token
        const response = await axios.post(`https://${shop}/admin/oauth/access_token`, {
            client_id: SHOPIFY_API_KEY,
            client_secret: SHOPIFY_API_SECRET,
            code
        });

        const accessToken = response.data.access_token;

        // CRITICAL: Force the Firestore Update
        if (db && uid && uid !== 'anon') {
            const userRef = db.collection('artifacts').doc(appId).collection('users').doc(uid);
            
            await userRef.set({
                tier: 'Commander', 
                shopUrl: shop,
                shopifyToken: accessToken,
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                handshakeVersion: "1.0.26"
            }, { merge: true });
            
            console.log(`🎖️ UID ${uid} successfully promoted to COMMANDER`);
        }

        // Return a high-visibility success page
        res.send(`
            <html>
                <head>
                    <title>Forge Verified</title>
                    <meta name="viewport" content="width=device-width, initial-scale=1">
                    <style>
                        body { background: #0A0A0B; color: white; font-family: sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
                        .card { border: 2px solid #f59e0b; padding: 40px; border-radius: 30px; text-align: center; background: #121214; box-shadow: 0 0 50px rgba(245,158,11,0.2); }
                        h1 { color: #f59e0b; font-size: 2.5rem; margin: 0 0 10px 0; font-style: italic; font-weight: 900; }
                        p { opacity: 0.6; font-size: 0.9rem; letter-spacing: 1px; }
                        .loader { width: 40px; height: 40px; border: 3px solid #f59e0b; border-top-color: transparent; border-radius: 50%; animation: spin 1s linear infinite; margin: 20px auto; }
                        @keyframes spin { to { transform: rotate(360deg); } }
                    </style>
                </head>
                <body>
                    <div class="card">
                        <h1>RANK ACTIVATED</h1>
                        <p>COMMANDER STATUS VERIFIED</p>
                        <div class="loader"></div>
                        <p style="font-size: 10px; margin-top: 20px;">SYNCING WITH TERMINAL...</p>
                        <script>
                            // Set local storage just in case, but Firebase listener is the primary driver
                            localStorage.setItem('rank_${uid}', 'Commander');
                            setTimeout(() => { window.close(); }, 2500);
                        </script>
                    </div>
                </body>
            </html>
        `);
    } catch (e) {
        console.error("❌ Handshake Error:", e.response?.data || e.message);
        res.status(500).send(`
            <div style="background: #1a1a1a; color: #fecaca; padding: 40px; font-family: sans-serif;">
                <h1>Handshake Failed</h1>
                <p>${e.message}</p>
                <button onclick="window.close()">Close and Try Again</button>
            </div>
        `);
    }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`🔥 Forge Engine v1.0.26 Live on Port ${PORT}`));
