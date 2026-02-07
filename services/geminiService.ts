
import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { CANFrame, SignalAnalysis } from "../types.ts";
import { authService, User } from "./authService.ts";

/**
 * Analyzes CAN bus traffic using Gemini AI and logs the query to the Google Script backend.
 */
export async function analyzeCANData(
  frames: CANFrame[], 
  user?: User, 
  sessionId?: string
): Promise<SignalAnalysis> {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const model = 'gemini-3-pro-preview';
  
  const frameSummary = frames.slice(0, 50).map(f => ({
    id: f.id,
    data: f.data.join(' '),
    period: f.periodMs + 'ms'
  }));

  const prompt = `
    As a senior automotive embedded engineer, analyze this snippet of CAN bus traffic captured from a PCAN interface.
    Frames: ${JSON.stringify(frameSummary)}
    
    1. Identify the likely protocol (OBD-II, J1939, UDS, or proprietary).
    2. Look for patterns in the data bytes that suggest specific signals.
    3. Detect any timing anomalies or suspicious message ID patterns.
    4. Suggest diagnostic steps.
    
    Provide your analysis in a structured format. Keep it concise.
  `;

  try {
    const response: GenerateContentResponse = await ai.models.generateContent({
      model: model,
      contents: prompt,
    });

    const text = response.text || "No analysis available.";
    const isUnclear = text.length < 50 || text.toLowerCase().includes("cannot determine") || text.toLowerCase().includes("anomaly");

    // LOG TO SPREADSHEET VIA APPS SCRIPT
    // Now logging both the Prompt AND the resulting AI Analysis
    if (user && sessionId) {
      authService.logQuery(user, prompt.substring(0, 500), text, isUnclear, sessionId).catch(console.error);
    }

    return {
      summary: text,
      detectedProtocols: text.toLowerCase().includes('j1939') ? ['J1939'] : text.toLowerCase().includes('obd') ? ['OBD-II'] : ['Generic CAN'],
      anomalies: text.toLowerCase().includes('anomaly') ? ['Signal patterns identified as potential faults'] : [],
      recommendations: "Verify bus load and check for potential termination resistor failure.",
      sources: [] 
    };
  } catch (error) {
    console.error("Gemini Analysis Error:", error);
    throw error;
  }
}
