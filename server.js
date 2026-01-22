const express = require('express');
const axios = require('axios');
const cors = require('cors');
const admin = require('firebase-admin');
require('dotenv').config();

/**
 * FORGE AI BACKEND - OAUTH & INJECTION ENGINE
 * VERSION: 1.0.18 - Test Handshake Logging
 */

let db;

if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    try {
        const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
        
        // Use explicit project ID from the JSON to avoid "Project not found" listing errors
        if (!admin.apps.length) {
            admin.initializeApp({
                credential: admin.credential.cert(serviceAccount),
                projectId: serviceAccount.project_id 
            });
        }
        
        db = admin.firestore();
        // Force settings to ensure we are connecting to the correct instance
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

app.get('/', (req, res) => res.send(`Forge v1.0.18 Live. <a href="/health">Check Health</a>`));

app.get('/health', (req, res) => {
    res.json({
        status: "Online",
        version: "1.0.18",
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
 * Final diagnostic for forgedmapp Firestore.
 */
app.get('/api/test/handshake', async (req, res) => {
    const { uid } = req.query;
    console.log(`🧪 Handshake Test Initiated for UID: ${uid || 'UNKNOWN'}`);
    
    if (!uid) return res.status(400).send("Missing uid.");

    try {
        if (!db) throw new Error("Firestore not initialized. Check your Service Account JSON.");

        const userRef = db.collection('artifacts').doc(appId).collection('users').doc(uid);
        
        await userRef.set({
            tier: 'Commander',
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            diagnostic: "v1.0.18-passed"
        }, { merge: true });

        console.log(`✨ Handshake Success for ${uid}`);

        res.send(`
            <html>
                <body style="background: #0A0A0B; color: white; font-family: sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; padding: 20px;">
                    <div style="text-align: center; border: 1px solid #34d399; padding: 40px; border-radius: 20px; background: #064e3b; max-width: 500px; box-shadow: 0 0 50px rgba(52,211,153,0.3);">
                        <h1 style="color: #34d399;">FIRESTORE VERIFIED</h1>
                        <p>Project: <b>forgedmapp</b></p>
                        <p>Status: Permission binding successful (v1.0.18).</p>
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
                <h1 style="color: #ef4444;">Project Discovery Error</h1>
                <p>Firebase cannot find project <b>forgedmapp</b> or permissions are insufficient.</p>
                <div style="background: #2d2d2d; padding: 20px; border-radius: 10px; margin: 20px 0; border-left: 5px solid #ef4444;">
                    <strong>Critical Fix:</strong>
                    <ol>
                        <li>In Google Cloud Console, ensure the Service Account has the <b>"Cloud Datastore User"</b> or <b>"Editor"</b> role.</li>
                        <li>Ensure you are using the Service Account JSON specifically generated for <b>forgedmapp</b>.</li>
                        <li>Go to <b>Project Settings > Service Accounts</b> and click <b>"Generate new private key"</b> if the current one is failing.</li>
                    </ol>
                </div>
                <p><b>Technical Error:</b> ${e.message}</p>
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
app.listen(PORT, () => console.log(`🔥 Forge Engine v1.0.18 active`));
