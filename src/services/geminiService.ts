import { GoogleGenAI, Type } from "@google/genai";

// FIX: Initialize GoogleGenAI with environment variable (will be undefined if not set)
const apiKey = (import.meta as any).env?.VITE_GEMINI_API_KEY;
const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;

/**
 * Client-Side Bill Forecaster (Free Tier)
 * This function uses simple statistical projection to forecast the next bill amount.
 * It runs instantly in the browser with no API calls.
 */
export const forecastBillAmount = async (
  billType: string,
  previousBills: number[]
): Promise<{ amount: number; explanation:string; }> => {
  // Simulate a slight delay for user experience
  await new Promise(resolve => setTimeout(resolve, 300));

  if (previousBills.length < 2) {
      return {
          amount: previousBills[0] || 0,
          explanation: `Not enough data for an accurate forecast. At least two past bills are needed.`
      }
  }

  // Simple projection logic
  const average = previousBills.reduce((a, b) => a + b, 0) / previousBills.length;
  const fluctuation = average * 0.10; // +/- 10%
  const predictedAmount = Math.round(
    average + (Math.random() * fluctuation * 2) - fluctuation
  );

  const trend = previousBills[previousBills.length - 1] > previousBills[0]
      ? 'a slight upward trend'
      : 'a stable or downward trend';
      
  const explanation = `Based on a simple forecast of your spending, which shows ${trend}, your next ${billType} bill is projected to be around ₹${predictedAmount}.`;
  
  return { amount: predictedAmount, explanation };
};


/**
 * Advanced AI Bill Predictor (Premium Tier)
 * This function calls the Gemini API to get a more sophisticated prediction.
 * It provides a more insightful explanation for the predicted amount.
 */
export const predictBillAmountWithAI = async (
  billType: string,
  previousBills: number[]
): Promise<{ amount: number; explanation: string }> => {
    
  const prompt = `You are a financial assistant. A user wants to predict their next bill amount for "${billType}". Their previous payments in INR were [${previousBills.join(', ')}]. Analyze this trend and predict the next bill amount. Provide a brief, one-sentence explanation for your prediction, mentioning the trend (e.g., upward, stable, fluctuating).`;

  if (!ai) {
    throw new Error("Gemini API key not configured. Please set VITE_GEMINI_API_KEY in your environment variables.");
  }

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            predictedAmount: {
              type: Type.NUMBER,
              description: "The predicted bill amount as a number.",
            },
            explanation: {
              type: Type.STRING,
              description: "A brief, one-sentence explanation for the prediction."
            },
          },
          required: ["predictedAmount", "explanation"],
        },
      },
    });

    const result = JSON.parse(response.text?.trim() || '{}');
    if (!result.predictedAmount || !result.explanation) {
      throw new Error("Invalid response from AI model");
    }
    return { amount: result.predictedAmount, explanation: result.explanation };

  } catch (error) {
    console.error("Gemini API call failed:", error);
    throw new Error("The AI model failed to generate a response. Please check the console for details.");
  }
};
