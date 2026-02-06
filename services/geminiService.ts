
import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { CANFrame, SignalAnalysis } from "../types.ts";

/**
 * Analyzes CAN bus traffic using Gemini AI.
 * This function handles sending a summary of frames to the model and parsing the response.
 */
export async function analyzeCANData(frames: CANFrame[]): Promise<SignalAnalysis> {
  // Always initialize GoogleGenAI inside the function with a named parameter to ensure it uses the most up-to-date process.env.API_KEY.
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
    2. Look for patterns in the data bytes that suggest specific signals (e.g., counters, checksums, or physical values like RPM/Speed).
    3. Detect any timing anomalies or suspicious message ID patterns.
    4. Suggest diagnostic steps.
    
    Provide your analysis in a structured format. Keep it concise.
  `;

  try {
    // Using ai.models.generateContent with both model name and prompt in parameters as required.
    const response: GenerateContentResponse = await ai.models.generateContent({
      model: model,
      contents: prompt,
    });

    // Access text directly from the response property (do not call text() as a method).
    const text = response.text || "No analysis available.";

    return {
      summary: text,
      detectedProtocols: text.toLowerCase().includes('j1939') ? ['J1939'] : text.toLowerCase().includes('obd') ? ['OBD-II'] : ['Generic CAN'],
      anomalies: text.toLowerCase().includes('anomaly') ? ['Timing jitter detected'] : [],
      recommendations: "Review signal cycle times and verify parity bits.",
      sources: [] 
    };
  } catch (error) {
    console.error("Gemini Analysis Error:", error);
    throw error;
  }
}
