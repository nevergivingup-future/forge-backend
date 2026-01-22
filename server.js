const express = require('express');
const axios = require('axios');
const cors = require('cors');
const admin = require('firebase-admin');
require('dotenv').config();

/**
 * FORGE AI BACKEND - OAUTH & INJECTION ENGINE
 * VERSION: 1.0.15 - Diagnostic Database Auto-Binding
 */

if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    try {
        const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
        if (!admin.apps.length) {
            admin.initializeApp({
                credential: admin.credential.cert(serviceAccount),
                // Explicitly targeting the project ID from the service account
                projectId: serviceAccount.project_id 
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

app.get('/', (req, res) => res.send(`Forge v1.0.15 Live. <a href="/health">Check Health</a>`));

app.get('/health', (req, res) => {
    res.json({
        status: "Online",
        version: "1.0.15",
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

        // Version 1.0.15 uses a flattened path to verify if the collection can be created
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
        
        // Critical Logic: If we still get NOT_FOUND, provide a direct link to create the DB
        res.status(500).send(`
            <div style="font-family: sans-serif; padding: 40px; background: #450a0a; color: #fecaca; height: 100vh;">
                <h1>Handshake Failed (v1.0.15)</h1>
                <p><b>Error Message:</b> ${e.message}</p>
                <hr style="border-color: #7f1d1d;">
                <p><b>This error means the Firestore database instance does not exist yet.</b></p>
                <p>To fix this immediately:</p>
                <ol>
                    <li>Open your Firebase Console: <a href="https://console.firebase.google.com/project/forgedmapp/firestore" style="color:white; font-weight:bold;">Click here to open Firestore for forgedmapp</a></li>
                    <li>If it says <b>"Cloud Firestore is ready to go"</b>, verify you see a "Data" tab.</li>
                    <li>If it says <b>"Create Database"</b>, you MUST click it.</li>
                    <li>Choose <b>"Start in Test Mode"</b> and a location (like us-central).</li>
                </ol>
                <p>Once you see the "Data" tab in the Firebase console, refresh this page.</p>
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
app.listen(PORT, () => console.log(`🔥 Forge Engine v1.0.15 on port ${PORT}`));
