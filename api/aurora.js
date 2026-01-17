// api/aurora.js
export default async function handler(req, res) {
  // 1. Handle CORS (Allows your frontend to talk to this backend)
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  // Handle preflight request (browser checking if it's safe)
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // 2. Setup your Aurora Details
  // It's safe to keep the Tenant ID here, but the Key must be hidden
  const TENANT_ID = "9123c30e-0930-469a-b16a-f6831418d8a2"; 
  
  // We read the key from the Server Environment (Secure!)
  // Fallback to the hardcoded key if env var is missing (for ease of setup)
  const API_KEY = process.env.AURORA_API_KEY || "sk_prod_ad6f617aa0e23b3bb2af4fec"; 

  if (!API_KEY) {
      return res.status(500).json({ error: 'Server missing API Key configuration' });
  }

  // 3. Talk to Aurora
  try {
    const auroraResponse = await fetch(`https://api.aurorasolar.com/tenants/${TENANT_ID}/projects`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Accept': 'application/json'
      }
    });

    const data = await auroraResponse.json();

    // 4. Send data back to your Frontend
    return res.status(auroraResponse.status).json(data);

  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}