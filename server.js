const express = require('express');
const axios = require('axios');
const cors = require('cors');
const admin = require('firebase-admin');
require('dotenv').config();

/**
 * FORGE AI BACKEND - OAUTH & INJECTION ENGINE
 * VERSION: 1.0.21 - Ready for Live Testing
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

app.get('/', (req, res) => res.send(`Forge v1.0.21 Live. <a href="/health">Check Health</a>`));

app.get('/health', (req, res) => {
    res.json({
        status: "Online",
        version: "1.0.21",
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
 * Diagnostic for forgedmapp Firestore.
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
            diagnostic: "v1.0.21-passed",
            projectBound: initializedProjectId
        }, { merge: true });

        console.log(`✨ Handshake Success for ${uid}`);

        res.send(`
            <html>
                <body style="background: #0A0A0B; color: white; font-family: sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; padding: 20px;">
                    <div style="text-align: center; border: 1px solid #34d399; padding: 40px; border-radius: 20px; background: #064e3b; max-width: 500px; box-shadow: 0 0 50px rgba(52,211,153,0.3);">
                        <h1 style="color: #34d399;">FIRESTORE VERIFIED</h1>
                        <p>Project: <b>${initializedProjectId}</b></p>
                        <p>Status: Handshake Success (v1.0.21).</p>
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
                <h1 style="color: #ef4444;">Handshake Failed (v1.0.21)</h1>
                <p><b>Technical Error:</b> ${e.message}</p>
                <hr style="border-color: #7f1d1d;">
                <p><b>Diagnosis for ${initializedProjectId}:</b></p>
                <p>Ensure your Firestore Database instance is created and set to "Test Mode" in the Firebase Console.</p>
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

/**
 * SHOPIFY CALLBACK - AUTO UPGRADE ENGINE
 */
app.get('/api/shopify/callback', async (req, res) => {
    const { shop, code, state: uid } = req.query;
    if (!code) return res.status(400).send("No code");

    try {
        console.log(`🔄 Processing OAuth for ${shop}...`);
        
        const response = await axios.post(`https://${shop}/admin/oauth/access_token`, {
            client_id: SHOPIFY_API_KEY,
            client_secret: SHOPIFY_API_SECRET,
            code
        });

        // MERCHANT AUTO-UPGRADE LOGIC
        if (db && uid && uid !== 'anon') {
            const userRef = db.collection('artifacts').doc(appId).collection('users').doc(uid);
            
            // Auto-promoting to Commander on successful Shopify link
            await userRef.set({
                tier: 'Commander', 
                shopUrl: shop,
                shopifyToken: response.data.access_token,
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                upgradeSource: 'shopify_oauth_auto'
            }, { merge: true });
            
            console.log(`🎖️ Merchant ${uid} Auto-Upgraded to Commander via ${shop}`);
        }

        res.send(`
            <html>
                <body style="background: #0A0A0B; color: white; font-family: sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0;">
                    <div style="text-align: center;">
                        <h1 style="color: #f59e0b;">RANK ACTIVATED</h1>
                        <p>Your store <b>${shop}</b> is now connected.</p>
                        <p>You have been promoted to <b>Commander</b>.</p>
                        <script>
                            localStorage.setItem('rank_${uid}', 'Commander');
                            setTimeout(() => window.close(), 3000);
                        </script>
                    </div>
                </body>
            </html>
        `);
    } catch (e) {
        console.error("❌ OAuth/Upgrade Error:", e.message);
        res.status(500).send("Authorization failed. Please try again.");
    }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`🔥 Forge Engine v1.0.21 active`));
