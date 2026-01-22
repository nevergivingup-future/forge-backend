const express = require('express');
const axios = require('axios');
const cors = require('cors');
const admin = require('firebase-admin');
require('dotenv').config();

/**
 * FORGE AI BACKEND - OAUTH & INJECTION ENGINE
 * VERSION: 1.0.19 - Force-Check Diagnostic
 */

let db;
let initializedProjectId = "Unknown";

if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    try {
        const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
        initializedProjectId = serviceAccount.project_id;
        
        if (!admin.apps.length) {
            admin.initializeApp({
                credential: admin.credential.cert(serviceAccount),
                projectId: serviceAccount.project_id 
            });
        }
        
        db = admin.firestore();
        db.settings({ ignoreUndefinedProperties: true });
        
        console.log(`✅ Forge Firebase Engine: Online (Project: ${serviceAccount.project_id})`);
    } catch (e) {
        console.error("❌ Firebase Init Error:", e.message);
    }
}

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

app.get('/', (req, res) => res.send(`Forge v1.0.19 Live. <a href="/health">Check Health</a>`));

app.get('/health', (req, res) => {
    res.json({
        status: "Online",
        version: "1.0.19",
        firebase: !!admin.apps.length,
        projectId: initializedProjectId,
        env: {
            hasApiKey: !!SHOPIFY_API_KEY,
            hasSecret: !!SHOPIFY_API_SECRET
        }
    });
});

/**
 * TEST HANDSHAKE
 * Final diagnostic for forgedmapp Firestore.
 */
app.get('/api/test/handshake', async (req, res) => {
    const { uid } = req.query;
    console.log(`🧪 Handshake Test Initiated for UID: ${uid || 'UNKNOWN'}`);
    
    if (!uid) return res.status(400).send("Missing uid.");

    try {
        if (!db) throw new Error("Firestore not initialized. Check your Service Account JSON.");

        // Use a flatter path for the test write to ensure we aren't hitting path limits
        const userRef = db.collection('artifacts').doc(appId).collection('users').doc(uid);
        
        await userRef.set({
            tier: 'Commander',
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            diagnostic: "v1.0.19-passed",
            projectBound: initializedProjectId
        }, { merge: true });

        console.log(`✨ Handshake Success for ${uid}`);

        res.send(`
            <html>
                <body style="background: #0A0A0B; color: white; font-family: sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; padding: 20px;">
                    <div style="text-align: center; border: 1px solid #34d399; padding: 40px; border-radius: 20px; background: #064e3b; max-width: 500px; box-shadow: 0 0 50px rgba(52,211,153,0.3);">
                        <h1 style="color: #34d399;">FIRESTORE VERIFIED</h1>
                        <p>Project: <b>${initializedProjectId}</b></p>
                        <p>Status: Handshake Success (v1.0.19).</p>
                        <script>
                            localStorage.setItem('rank_${uid}', 'Commander');
                            setTimeout(() => window.close(), 4000);
                        </script>
                    </div>
                </body>
            </html>
        `);
    } catch (e) {
        console.error("❌ Firestore Error:", e);
        res.status(500).send(`
            <div style="font-family: sans-serif; padding: 40px; background: #1a1a1a; color: #fecaca; height: 100vh; line-height: 1.6;">
                <h1 style="color: #ef4444;">Handshake Failed (v1.0.19)</h1>
                <p><b>Technical Error:</b> ${e.message}</p>
                <hr style="border-color: #7f1d1d;">
                <p><b>Diagnosis for ${initializedProjectId}:</b></p>
                <p>The "NOT_FOUND" error typically means the Firestore API is enabled but the <i>database instance</i> hasn't been created.</p>
                <div style="background: #2d2d2d; padding: 20px; border-radius: 10px; margin: 20px 0; border-left: 5px solid #ef4444;">
                    <strong>Mandatory Step:</strong>
                    <ol>
                        <li>Open <a href="https://console.firebase.google.com/project/${initializedProjectId}/firestore" style="color:white; font-weight:bold;">Firestore Console</a>.</li>
                        <li>If you see a <b>"Create Database"</b> button, you MUST click it.</li>
                        <li>Choose <b>"Start in Test Mode"</b>.</li>
                        <li>Once you see a screen that says "Cloud Firestore is ready to go", this page will work.</li>
                    </ol>
                </div>
            </div>
        `);
    }
});

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
app.listen(PORT, () => console.log(`🔥 Forge Engine v1.0.19 active`));
