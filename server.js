const express = require('express');
const axios = require('axios');
const cors = require('cors');
const admin = require('firebase-admin');
require('dotenv').config();

/**
 * FORGE AI BACKEND - OAUTH & INJECTION ENGINE
 * VERSION: 1.0.14 - Database Instance Binding Fix
 */

if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    try {
        const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
        if (!admin.apps.length) {
            admin.initializeApp({
                credential: admin.credential.cert(serviceAccount),
                databaseURL: `https://${serviceAccount.project_id}.firebaseio.com`
            });
        }
        console.log("✅ Forge Firebase Engine: Online");
    } catch (e) {
        console.error("❌ Firebase Init Error:", e.message);
    }
}

// Ensure we are targeting the project-specific Firestore instance
const db = admin.firestore();

const app = express();
const appId = "forge-app"; 

app.use(cors({ origin: '*' }));
app.use(express.json());

const SHOPIFY_API_KEY = process.env.SHOPIFY_CLIENT_ID;
const SHOPIFY_API_SECRET = process.env.SHOPIFY_CLIENT_SECRET;
const BACKEND_URL = "https://forge-backend-production-b124.up.railway.app";

app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
});

app.get('/', (req, res) => res.send(`Forge v1.0.14 Live. <a href="/health">Check Health</a>`));

app.get('/health', (req, res) => {
    res.json({
        status: "Online",
        version: "1.0.14",
        firebase: !!admin.apps.length,
        projectId: "forgedmapp",
        env: {
            hasApiKey: !!SHOPIFY_API_KEY,
            hasSecret: !!SHOPIFY_API_SECRET
        }
    });
});

/**
 * TEST HANDSHAKE
 * Verification for forgedmapp Firestore instance.
 */
app.get('/api/test/handshake', async (req, res) => {
    const { uid } = req.query;
    if (!uid) return res.status(400).send("Missing uid.");

    try {
        if (!db) throw new Error("Firestore not initialized.");

        // We use a simplified path to test if the root collection 'artifacts' can be reached
        const userRef = db.collection('artifacts').doc(appId).collection('users').doc(uid);
        
        const testData = {
            tier: 'Commander',
            shopUrl: 'test-store.myshopify.com',
            shopifyToken: 'mock_token_' + Math.floor(Math.random() * 10000),
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        };

        // Execution of write
        await userRef.set(testData, { merge: true });

        res.send(`
            <html>
                <body style="background: #0A0A0B; color: white; font-family: sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; padding: 20px;">
                    <div style="text-align: center; border: 1px solid #34d399; padding: 40px; border-radius: 20px; background: #064e3b; max-width: 500px; box-shadow: 0 0 50px rgba(52,211,153,0.3);">
                        <h1 style="color: #34d399;">FIRESTORE VERIFIED</h1>
                        <p>Project: <b>forgedmapp</b></p>
                        <p>Status: Database instance reached successfully.</p>
                        <script>
                            localStorage.setItem('rank_${uid}', 'Commander');
                            setTimeout(() => window.close(), 4000);
                        </script>
                    </div>
                </body>
            </html>
        `);
    } catch (e) {
        console.error("❌ Firestore Error Details:", e);
        res.status(500).send(`
            <div style="font-family: sans-serif; padding: 40px; background: #450a0a; color: #fecaca; height: 100vh;">
                <h1>Handshake Failed (v1.0.14)</h1>
                <p><b>Error Message:</b> ${e.message}</p>
                <hr style="border-color: #7f1d1d;">
                <p><b>Final Resolution Steps:</b></p>
                <ol>
                    <li>Go to <a href="https://console.firebase.google.com/project/forgedmapp/firestore" style="color:white">Firebase Firestore Console</a>.</li>
                    <li>If you see a "Create Database" button, you <b>must</b> click it.</li>
                    <li>Ensure you select <b>"Start in test mode"</b>.</li>
                    <li>Ensure the Database ID is <b>(default)</b>.</li>
                </ol>
            </div>
        `);
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
            const userRef = db.collection('artifacts').doc(appId).collection('users').doc(uid);
            await userRef.set({
                tier: 'Commander',
                shopUrl: shop,
                shopifyToken: response.data.access_token,
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
        }

        res.send("<h1>Rank Activated</h1><script>window.close()</script>");
    } catch (e) {
        res.status(500).send("Callback error");
    }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`🔥 Forge Engine v1.0.14 on port ${PORT}`));
