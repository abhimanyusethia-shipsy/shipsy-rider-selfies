import { GoogleGenAI } from "@google/genai";

let _ai: GoogleGenAI | null = null;

function getAI(): GoogleGenAI {
  if (!_ai) {
    _ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });
  }
  return _ai;
}

export interface ProfileValidationResult {
  valid: boolean;
  face_detected: boolean;
  real_person: boolean;
  reasoning: string[];
}

export interface SelfieValidationResult {
  face_valid: boolean;
  real_person: boolean;
  face_match: boolean;
  overall_status: "approved" | "rejected";
  reasoning: string[];
}

const PROFILE_PROMPT = `Analyze this image for use as a profile/identification photo. Check the following:

1. Does it contain exactly one clearly visible human face? (not zero faces, not multiple faces)
2. Is this a real photograph of a real, live person? (NOT a photo of another photo, NOT a screenshot of an image, NOT a picture of an ID card, NOT a drawing or illustration)

Respond ONLY with valid JSON in this exact format:
{
  "valid": true or false (true only if BOTH checks pass),
  "face_detected": true or false,
  "real_person": true or false,
  "reasoning": ["brief reason 1", "brief reason 2"]
}

Keep each reasoning point under 15 words. Be strict about detecting photos of photos or ID cards.`;

const SELFIE_PROMPT = `You are a strict identity verification system. You MUST carefully compare two face images.

IMAGE 1 (first image): A selfie just taken by a person.
IMAGE 2 (second image): The profile/ID photo on file for the account owner.

Perform these THREE checks:

CHECK 1 - FACE DETECTION: Does the selfie (image 1) contain exactly one clearly visible human face?

CHECK 2 - LIVENESS: Is the selfie a real, live photograph? Reject if it is a photo of another photo, a photo of a screen, a photo of an ID card, a printout, or any reproduction.

CHECK 3 - FACE MATCHING (CRITICAL - BE VERY STRICT):
Compare the person in image 1 (selfie) with the person in image 2 (profile photo).
Look carefully at these specific facial features:
- Face shape and bone structure
- Eyes (shape, spacing, size)
- Nose (shape, width, bridge)
- Mouth and lip shape
- Eyebrows
- Skin tone
- Gender
- Approximate age range

IMPORTANT: These MUST be the SAME person. Different people of the same gender, ethnicity, or age group are NOT matches. If you see ANY significant differences in facial structure, bone structure, or key features, set face_match to FALSE. When in doubt, REJECT the match. A false approval is much worse than a false rejection.

Respond ONLY with valid JSON:
{
  "face_valid": true or false,
  "real_person": true or false,
  "face_match": true or false,
  "overall_status": "approved" or "rejected",
  "reasoning": ["reason for face detection result", "reason for liveness result", "reason for face match result - mention specific features compared"]
}

Rules:
- overall_status is "approved" ONLY if ALL THREE checks are true
- If face_match is false, explain WHICH facial features differ
- Keep each reasoning point under 20 words
- Be VERY strict on face matching - reject if there is any doubt`;

export async function validateProfilePicture(
  imageBase64: string,
  mimeType: string
): Promise<ProfileValidationResult> {
  try {
    const response = await getAI().models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        {
          role: "user",
          parts: [
            { inlineData: { mimeType, data: imageBase64 } },
            { text: PROFILE_PROMPT },
          ],
        },
      ],
      config: {
        responseMimeType: "application/json",
      },
    });

    const text = response.text || "";
    console.log("[Gemini] Profile validation response:", text);
    return JSON.parse(text) as ProfileValidationResult;
  } catch (error) {
    console.error("Gemini profile validation error:", error);
    return {
      valid: false,
      face_detected: false,
      real_person: false,
      reasoning: ["AI validation failed - please try again"],
    };
  }
}

export async function validateSelfie(
  selfieBase64: string,
  selfieMimeType: string,
  profileBase64: string,
  profileMimeType: string
): Promise<SelfieValidationResult> {
  try {
    console.log("[Gemini] Sending selfie validation request with 2 images...");

    const response = await getAI().models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        {
          role: "user",
          parts: [
            { text: "IMAGE 1 (selfie to verify):" },
            { inlineData: { mimeType: selfieMimeType, data: selfieBase64 } },
            { text: "IMAGE 2 (profile photo on file):" },
            { inlineData: { mimeType: profileMimeType, data: profileBase64 } },
            { text: SELFIE_PROMPT },
          ],
        },
      ],
      config: {
        responseMimeType: "application/json",
      },
    });

    const text = response.text || "";
    console.log("[Gemini] Selfie validation response:", text);
    return JSON.parse(text) as SelfieValidationResult;
  } catch (error) {
    console.error("Gemini selfie validation error:", error);
    return {
      face_valid: false,
      real_person: false,
      face_match: false,
      overall_status: "rejected",
      reasoning: ["AI validation failed - please try again"],
    };
  }
}
