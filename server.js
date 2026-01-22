const express = require('express');
const axios = require('axios');
const cors = require('cors');
const admin = require('firebase-admin');
require('dotenv').config();

/**
 * FORGE AI BACKEND - OAUTH & INJECTION ENGINE
 * VERSION: 1.0.11 - Enhanced Test Suite & Path Debugging
 */

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
const appId = "forge-app"; // Standardized appId

app.use(cors({ origin: '*' }));
app.use(express.json());

const SHOPIFY_API_KEY = process.env.SHOPIFY_CLIENT_ID;
const SHOPIFY_API_SECRET = process.env.SHOPIFY_CLIENT_SECRET;
const BACKEND_URL = "https://forge-backend-production-b124.up.railway.app";

// --- MIDDLEWARE: LOG ALL REQUESTS ---
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
});

app.get('/', (req, res) => res.send(`Forge v1.0.11 Live. <a href="/health">Check Health</a>`));

app.get('/health', (req, res) => {
    res.json({
        status: "Online",
        version: "1.0.11",
        firebase: !!admin.apps.length,
        firestorePath: `/artifacts/${appId}/users/{uid}`,
        env: {
            hasApiKey: !!SHOPIFY_API_KEY,
            hasSecret: !!SHOPIFY_API_SECRET
        }
    });
});

/**
 * TEST HANDSHAKE (REFINED)
 * Simulation to verify Firestore write permissions are active.
 */
app.get('/api/test/handshake', async (req, res) => {
    const { uid } = req.query;
    if (!uid) return res.status(400).send("Missing uid. Usage: /api/test/handshake?uid=your_id");

    try {
        if (!db) throw new Error("Database (Admin SDK) not initialized. Check FIREBASE_SERVICE_ACCOUNT.");

        // We use the full path syntax which is required for the platform's security rules
        const userRef = db.collection('artifacts').doc(appId).collection('users').doc(uid);
        
        const testData = {
            tier: 'Commander',
            shopUrl: 'test-store.myshopify.com',
            shopifyToken: 'mock_token_' + Math.floor(Math.random() * 10000),
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        };

        await userRef.set(testData, { merge: true });

        console.log(`✅ Success: Updated user ${uid} to Commander rank.`);

        res.send(`
            <html>
                <body style="background: #0A0A0B; color: white; font-family: sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; padding: 20px;">
                    <div style="text-align: center; border: 1px solid #34d399; padding: 40px; border-radius: 20px; background: #064e3b; max-width: 500px; box-shadow: 0 0 50px rgba(52,211,153,0.3);">
                        <h1 style="color: #34d399; margin-bottom: 20px;">FIRESTORE VERIFIED</h1>
                        <p style="font-size: 1.1rem;">The backend successfully wrote to the database.</p>
                        <div style="background: rgba(0,0,0,0.3); padding: 15px; border-radius: 10px; margin: 20px 0; text-align: left; font-family: monospace; font-size: 0.85rem; color: #a7f3d0;">
                            Path: /artifacts/${appId}/users/${uid}<br>
                            Status: COMMANDER_ACTIVATED
                        </div>
                        <p style="color: #6ee7b7; font-size: 0.9rem;">Your Forge UI will now update automatically.</p>
                        <script>
                            localStorage.setItem('rank_${uid}', 'Commander');
                            setTimeout(() => window.close(), 4000);
                        </script>
                    </div>
                </body>
            </html>
        `);
    } catch (e) {
        console.error("❌ Handshake Error:", e.message);
        res.status(500).send(`
            <div style="font-family: sans-serif; padding: 40px; background: #450a0a; color: #fecaca; height: 100vh;">
                <h1>Handshake Test Failed</h1>
                <p><b>Error:</b> ${e.message}</p>
                <p>Ensure Firestore is enabled in the Google Cloud Console and the Service Account has 'Editor' or 'Owner' permissions.</p>
            </div>
        `);
    }
});

// --- OAUTH ENDPOINTS ---

app.get('/api/auth/shopify', (req, res) => {
    const { shop, uid } = req.query;
    if (!shop) return res.status(400).send("Missing shop parameter");
    
    const scopes = 'read_products,write_products,read_content,write_content';
    const redirectUri = `${BACKEND_URL}/api/shopify/callback`;
    const state = uid || "default_merchant";
    
    const installUrl = `https://${shop}/admin/oauth/authorize?client_id=${SHOPIFY_API_KEY}&scope=${scopes}&redirect_uri=${redirectUri}&state=${state}`;
    
    console.log(`🚀 Starting Handshake for: ${shop}`);
    res.redirect(installUrl);
});

app.get('/api/shopify/callback', async (req, res) => {
    const { shop, code, state: uid } = req.query;
    if (!code) return res.status(400).send("No authorization code provided");

    try {
        const response = await axios.post(`https://${shop}/admin/oauth/access_token`, {
            client_id: SHOPIFY_API_KEY,
            client_secret: SHOPIFY_API_SECRET,
            code
        });

        if (db && uid && uid !== 'default_merchant') {
            const userRef = db.collection('artifacts').doc(appId).collection('users').doc(uid);
            await userRef.set({
                tier: 'Commander',
                shopUrl: shop,
                shopifyToken: response.data.access_token,
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
        }

        res.send(`
            <div style="text-align:center; padding:50px; font-family:sans-serif; background:#0A0A0B; color:white; height:100vh;">
                <h1 style="color:#f59e0b;">RANK UPGRADED</h1>
                <p>Handshake with ${shop} successful.</p>
                <script>window.close();</script>
            </div>
        `);
    } catch (e) {
        console.error("Callback Error:", e.message);
        res.status(500).send("Handshake Callback Failed.");
    }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`🔥 Forge Engine v1.0.11 active on port ${PORT}`));
