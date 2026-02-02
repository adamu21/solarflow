import { GoogleGenAI, Type } from "@google/genai";
import { Lead, LeadSource } from '../types';

// Helper to get client with current key
const getClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    throw new Error("API Key not found in environment.");
  }
  return new GoogleGenAI({ apiKey });
};

export const analyzeLeadSpam = async (lead: Lead): Promise<{ score: number; reason: string }> => {
  try {
    const ai = getClient();
    const prompt = `
      You are an assistant for a Solar Company in Alberta, Canada. 
      Analyze this lead to determine if it is SPAM or a LEGITIMATE residential solar inquiry.
      
      Context:
      - We get leads from Tesla, Enmax, and our Website.
      - Spam often looks like SEO offers, marketing services, or inquiries from outside Canada/USA without clear intent.
      - Legitimate leads ask about quotes, bills, roofs, or specific solar products.

      Lead Data:
      Name: ${lead.name}
      Email: ${lead.email}
      Source: ${lead.source}
      Message: ${lead.messageBody}
      Address: ${lead.address}

      Return JSON with:
      - score (integer 0-100, where 100 is definitely spam)
      - reason (short explanation)
    `;

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            score: { type: Type.INTEGER },
            reason: { type: Type.STRING }
          },
          required: ["score", "reason"]
        }
      }
    });

    const text = response.text;
    if (!text) throw new Error("No response from AI");
    return JSON.parse(text);

  } catch (error) {
    console.error("Error analyzing lead:", error);
    return { score: 0, reason: "AI Analysis failed" };
  }
};

export const draftResponseEmail = async (lead: Lead, templateBody: string): Promise<string> => {
  try {
    const ai = getClient();
    const prompt = `
      You are Jake from Rocky Mountain Solar. 
      Draft a personalized email based on this template: "${templateBody}".
      
      Customize it for this lead:
      Name: ${lead.name}
      Address: ${lead.address}
      Source: ${lead.source}
      Lead's Message: "${lead.messageBody}"

      If the lead asked a specific question in their message, try to briefly acknowledge it in the email before the standard template text.
      Keep it professional but friendly.
    `;

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
    });

    return response.text || templateBody;
  } catch (error) {
    console.error("Error generating email:", error);
    return templateBody.replace('{name}', lead.name).replace('{address}', lead.address);
  }
};

export const extractBillData = async (billTextOrBase64: string): Promise<any> => {
    // This is a placeholder for the actual bill extraction logic which uses vision capabilities
    // For this demo, we simulate extraction from text provided
    try {
        const ai = getClient();
        const prompt = `
            Extract electricity usage data from this bill text. 
            Return JSON with "totalAnnualUsage" (number) and "monthlyUsage" (array of 12 numbers).
            Input Data: ${billTextOrBase64.substring(0, 1000)}...
        `;
        
         const response = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: prompt,
            config: {
                responseMimeType: "application/json"
            }
        });
        
        return JSON.parse(response.text || "{}");
    } catch (e) {
        return { totalAnnualUsage: 0, monthlyUsage: [] };
    }
}