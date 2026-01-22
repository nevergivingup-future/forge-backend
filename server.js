const express = require('express');
const axios = require('axios');
const cors = require('cors');
const admin = require('firebase-admin');
require('dotenv').config();

/**
 * FORGE AI BACKEND - OAUTH & INJECTION ENGINE
 * VERSION: 1.0.10 - Resilient Firestore Write Logic
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

app.get('/', (req, res) => res.send(`Forge v1.0.10 Live. <a href="/health">Check Health</a>`));

app.get('/health', (req, res) => {
    res.json({
        status: "Online",
        version: "1.0.10",
        firebase: !!admin.apps.length,
        firestorePath: `/artifacts/${appId}/users/{uid}`
    });
});

/**
 * TEST HANDSHAKE
 * Simulation to verify Firestore write permissions are active.
 */
app.get('/api/test/handshake', async (req, res) => {
    const { uid } = req.query;
    if (!uid) return res.status(400).send("Missing uid.");

    try {
        if (!db) throw new Error("Database not initialized");

        // Use collection/doc syntax which is often more robust for initial setup
        const userRef = db
            .collection('artifacts')
            .doc(appId)
            .collection('users')
            .doc(uid);
        
        await userRef.set({
            tier: 'Commander',
            shopUrl: 'test-store.myshopify.com',
            shopifyToken: 'mock_token_12345',
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

        res.send(`
            <html>
                <body style="background: #0A0A0B; color: white; font-family: sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0;">
                    <div style="text-align: center; border: 1px solid #34d399; padding: 40px; border-radius: 20px; background: #064e3b; max-width: 400px; box-shadow: 0 0 50px rgba(52,211,153,0.3);">
                        <h1 style="color: #34d399;">FIRESTORE ACTIVE</h1>
                        <p>User <b>${uid}</b> promoted to Commander.</p>
                        <script>
                            localStorage.setItem('rank_${uid}', 'Commander');
                            setTimeout(() => window.close(), 3000);
                        </script>
                    </div>
                </body>
            </html>
        `);
    } catch (e) {
        console.error("Firestore Test Error:", e.message);
        res.status(500).send("Handshake Test Failed: " + e.message);
    }
});

// --- OAUTH ENDPOINTS ---

app.get('/api/auth/shopify', (req, res) => {
    const { shop, uid } = req.query;
    if (!shop) return res.status(400).send("Missing shop");
    const scopes = 'read_products,write_products,read_content,write_content';
    const redirectUri = `${BACKEND_URL}/api/shopify/callback`;
    const installUrl = `https://${shop}/admin/oauth/authorize?client_id=${SHOPIFY_API_KEY}&scope=${scopes}&redirect_uri=${redirectUri}&state=${uid || 'anon'}`;
    res.redirect(installUrl);
});

app.get('/api/shopify/callback', async (req, res) => {
    const { shop, code, state: uid } = req.query;
    if (!code) return res.status(400).send("No code");

    try {
        const response = await axios.post(`https://${shop}/admin/oauth/access_token`, {
            client_id: SHOPIFY_API_KEY,
            client_secret: SHOPIFY_API_SECRET,
            code
        });

        if (db && uid && uid !== 'anon') {
            const userRef = db
                .collection('artifacts')
                .doc(appId)
                .collection('users')
                .doc(uid);

            await userRef.set({
                tier: 'Commander',
                shopUrl: shop,
                shopifyToken: response.data.access_token,
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
        }

        res.send("<h1>Rank Activated</h1><script>window.close()</script>");
    } catch (e) {
        console.error("Callback Error:", e.message);
        res.status(500).send("Callback error");
    }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`🔥 Forge Engine v1.0.10 on port ${PORT}`));
