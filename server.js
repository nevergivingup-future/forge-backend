const express = require('express');
const axios = require('axios');
const cors = require('cors');
const admin = require('firebase-admin');
require('dotenv').config();

/**
 * FORGE AI BACKEND - SERVER.JS
 * Handles Shopify OAuth, Product Injections, and 
 * updates the Firebase tier for your users automatically.
 */

// Initialize Firebase Admin (Required for secure database updates)
if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    try {
        const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
        });
        console.log("✅ Forge Firebase Engine: Online");
    } catch (e) {
        console.error("❌ Firebase Init Error: Verify your FIREBASE_SERVICE_ACCOUNT variable.");
    }
}

const db = admin.firestore();
const app = express();
app.use(cors());
app.use(express.json());

const TIKAPI_KEY = process.env.TIKAPI_KEY;
const CLIENT_ID = process.env.SHOPIFY_CLIENT_ID;
const CLIENT_SECRET = process.env.SHOPIFY_CLIENT_SECRET;

// 1. OAUTH HANDSHAKE: Triggered when user clicks "Connect Store"
app.get('/api/auth/shopify', (req, res) => {
    const { shop, uid, appId } = req.query; 
    if (!shop || !uid) return res.status(400).send("Missing required parameters (shop/uid).");

    const protocol = req.headers['x-forwarded-proto'] || 'http';
    const host = req.get('host');
    const redirectUri = `${protocol}://${host}/api/shopify/callback`;

    const scopes = "write_products,read_analytics,write_script_tags";
    // Passing user metadata through the 'state' parameter to link the token back to the right UID
    const state = JSON.stringify({ uid, appId });
    
    const authUrl = `https://${shop}/admin/oauth/authorize?client_id=${CLIENT_ID}&scope=${scopes}&redirect_uri=${redirectUri}&state=${state}`;
    res.redirect(authUrl);
});

// 2. OAUTH CALLBACK: Exchange code for token & Auto-Upgrade User
app.get('/api/shopify/callback', async (req, res) => {
    const { shop, code, state } = req.query;
    try {
        const { uid, appId } = JSON.parse(state);

        const response = await axios.post(`https://${shop}/admin/oauth/access_token`, {
            client_id: CLIENT_ID,
            client_secret: CLIENT_SECRET,
            code
        });
        
        const accessToken = response.data.access_token;

        // SECURE STORAGE & AUTO-UPGRADE
        // We update the user's profile to 'Commander' (Merchant) status automatically
        await db.doc(`artifacts/${appId}/users/${uid}/settings/profile`).set({
            accessToken: accessToken,
            shopUrl: shop,
            storeLinked: true,
            tier: 'Commander',
            upgradedAt: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

        res.send(`
            <div style="font-family:sans-serif; text-align:center; padding: 50px; background: #0A0A0B; color: white; height: 100vh; display: flex; flex-direction: column; justify-content: center; align-items: center;">
                <div style="background: #f59e0b; width: 80px; height: 80px; border-radius: 24px; display: flex; align-items: center; justify-content: center; margin-bottom: 24px; box-shadow: 0 0 30px rgba(245, 158, 11, 0.3);">
                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="black" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                </div>
                <h1 style="margin: 0; font-size: 36px; font-weight: 900; font-style: italic; text-transform: uppercase; letter-spacing: -1px;">Forge Linked</h1>
                <p style="color: #64748b; margin-top: 10px; font-size: 18px;">Merchant Status: <strong>Commander (Activated)</strong></p>
                <p style="color: #475569; font-size: 14px; margin-top: 20px;">You can now close this window and return to the app.</p>
            </div>
        `);
    } catch (error) {
        console.error("OAuth Exchange Error:", error);
        res.status(500).send("Handshake failed. Ensure your Shopify App settings match your Railway URL.");
    }
});

// 3. PRODUCT INJECTION: Push AI product to the live Shopify store
app.post('/api/launch', async (req, res) => {
    const { name, script, shopUrl, userToken, imageUrl } = req.body;
    try {
        const response = await axios.post(`https://${shopUrl}/admin/api/2024-01/products.json`, {
            product: {
                title: name,
                body_html: `<div>${script}</div>`,
                vendor: "Forge AI",
                status: "active",
                images: [{ src: imageUrl }]
            }
        }, {
            headers: { 'X-Shopify-Access-Token': userToken }
        });
        res.json({ success: true, url: `https://${shopUrl}/products/${response.data.product.handle}` });
    } catch (error) {
        res.status(500).json({ error: "Shopify API rejected the product injection." });
    }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`🚀 Forge Engine processing on port ${PORT}`));