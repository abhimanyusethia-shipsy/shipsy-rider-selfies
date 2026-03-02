import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

const MODEL = "gemini-2.5-flash";
const FACE_MATCH_CONFIDENCE_THRESHOLD = 60;

// ── Public interfaces (unchanged — consumed by API routes) ──────────────────

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

// ── Internal interface (adds confidence score for threshold logic) ───────────

interface InternalSelfieResult extends SelfieValidationResult {
  face_match_confidence: number; // 0-100
}

// ── Prompts ─────────────────────────────────────────────────────────────────

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

const SELFIE_SYSTEM_INSTRUCTION = `You are an identity verification specialist. Your job is to accurately determine whether two face images belong to the same person.

Your core principles:
- You must be ACCURATE — both false approvals and false rejections are undesirable.
- Focus on PERMANENT STRUCTURAL facial features: bone structure, eye shape and spacing, nose bridge shape and width, jawline contour, and facial proportions.
- IGNORE environmental differences: lighting, shadows, camera angle, expression, clothing, background, image quality, resolution, and distance from camera are all EXPECTED to differ between a profile photo and a live selfie. These should NEVER be reasons to reject a match.
- Two different people of the same gender, ethnicity, or age group are NOT the same person — look at specific anatomy, not general appearance.
- When you are genuinely uncertain after careful structural analysis, reject the match. But do not reject simply because conditions differ between the two photos.`;

const SELFIE_PROMPT_PASS1 = `You are comparing two face images for identity verification.

IMAGE 1 (first image): A selfie just taken by a person.
IMAGE 2 (second image): The profile/ID photo on file for the account owner.

Perform your analysis step by step:

STEP 1 - FACE DETECTION:
Does the selfie (image 1) contain exactly one clearly visible human face?

STEP 2 - LIVENESS CHECK:
Is the selfie a genuine live photograph? Reject if it is a photo of another photo, a photo of a screen, a printout, or any reproduction.

STEP 3 - STRUCTURAL FEATURE COMPARISON:
Compare the following STRUCTURAL facial features between image 1 and image 2. For each, note if they are consistent or inconsistent:
a) Face shape and jawline contour
b) Eye shape, spacing, and depth
c) Nose shape, width, and bridge profile
d) Mouth width and lip shape
e) Forehead and cheekbone structure
f) Gender and approximate age range

IMPORTANT: Differences in lighting, camera angle, facial expression, clothing, background, and image quality are NORMAL between a profile photo and a live selfie. Do NOT count these as inconsistencies. Only flag genuine structural differences in facial anatomy.

STEP 4 - VERDICT:
Based on your structural analysis, determine whether these are the SAME person.
Assign a face_match_confidence score from 0 to 100:
- 0-30: Clearly different people (different facial structure)
- 31-50: Probably different people
- 51-70: Uncertain
- 71-85: Likely the same person
- 86-100: Very confident same person

Respond ONLY with valid JSON:
{
  "face_valid": true or false,
  "real_person": true or false,
  "face_match": true or false,
  "face_match_confidence": 0-100,
  "overall_status": "approved" or "rejected",
  "reasoning": ["face detection reason", "liveness reason", "face match reason citing specific structural features"]
}

Rules:
- overall_status is "approved" ONLY if face_valid AND real_person AND face_match are ALL true
- Keep each reasoning point under 25 words`;

const SELFIE_PROMPT_PASS2 = `You are performing identity verification by comparing two face images.

IMAGE 1 (first image): A selfie submitted for verification.
IMAGE 2 (second image): The reference profile photo on file.

Perform your analysis step by step:

STEP 1 - FACE DETECTION:
Is there exactly one clearly visible face in the selfie (image 1)?

STEP 2 - LIVENESS CHECK:
Is the selfie an authentic live photograph, not a reproduction?

STEP 3 - HOLISTIC IDENTITY COMPARISON:
Look at both faces as a whole. If you saw these two people walking down the street, would you recognize them as the same individual?

Consider:
- Do the faces have the same overall proportions and geometry?
- Are the key identifying features (eyes, nose, jawline) structurally consistent?
- Are there any distinctive features (moles, scars, dimples, facial asymmetries) that appear in one image but not the other?
- Could this be a DIFFERENT person who merely shares the same gender, ethnicity, or age range?

IMPORTANT: The selfie and profile photo will naturally look different due to lighting, angle, expression, clothing, and camera quality. These surface differences are completely expected and should NOT factor into your match decision. Focus on whether the underlying facial STRUCTURE and IDENTITY is the same person.

STEP 4 - FINAL DECISION:
Based on your holistic assessment, decide: same person or different person?
Assign a face_match_confidence from 0 to 100.

Respond ONLY with valid JSON:
{
  "face_valid": true or false,
  "real_person": true or false,
  "face_match": true or false,
  "face_match_confidence": 0-100,
  "overall_status": "approved" or "rejected",
  "reasoning": ["face detection reason", "liveness reason", "face match reason - explain what structural features led to your decision"]
}

Rules:
- overall_status is "approved" ONLY if face_valid AND real_person AND face_match are ALL true
- Keep each reasoning point under 25 words`;

// ── Helper: single Gemini pass ──────────────────────────────────────────────

async function runSinglePass(
  selfieBase64: string,
  selfieMimeType: string,
  profileBase64: string,
  profileMimeType: string,
  prompt: string
): Promise<InternalSelfieResult> {
  const response = await ai.models.generateContent({
    model: MODEL,
    contents: [
      {
        role: "user",
        parts: [
          { text: "IMAGE 1 (selfie to verify):" },
          { inlineData: { mimeType: selfieMimeType, data: selfieBase64 } },
          { text: "IMAGE 2 (profile photo on file):" },
          { inlineData: { mimeType: profileMimeType, data: profileBase64 } },
          { text: prompt },
        ],
      },
    ],
    config: {
      temperature: 0,
      systemInstruction: SELFIE_SYSTEM_INSTRUCTION,
      responseMimeType: "application/json",
    },
  });

  const text = response.text || "";
  return JSON.parse(text) as InternalSelfieResult;
}

// ── Public functions ────────────────────────────────────────────────────────

export async function validateProfilePicture(
  imageBase64: string,
  mimeType: string
): Promise<ProfileValidationResult> {
  try {
    const response = await ai.models.generateContent({
      model: MODEL,
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
        temperature: 0,
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
    console.log("[Gemini] Starting two-pass selfie validation...");

    // Run both passes in parallel to minimize latency
    const [pass1, pass2] = await Promise.all([
      runSinglePass(selfieBase64, selfieMimeType, profileBase64, profileMimeType, SELFIE_PROMPT_PASS1),
      runSinglePass(selfieBase64, selfieMimeType, profileBase64, profileMimeType, SELFIE_PROMPT_PASS2),
    ]);

    console.log("[Gemini] Pass 1 result:", JSON.stringify(pass1));
    console.log("[Gemini] Pass 2 result:", JSON.stringify(pass2));

    // ── Consensus logic ──────────────────────────────────────────────────
    // For face_valid and real_person: reject if EITHER pass rejects
    const face_valid = pass1.face_valid && pass2.face_valid;
    const real_person = pass1.real_person && pass2.real_person;

    // For face_match: require BOTH passes to approve AND both confidence scores above threshold
    const conf1 = pass1.face_match_confidence ?? 0;
    const conf2 = pass2.face_match_confidence ?? 0;
    const avgConfidence = Math.round((conf1 + conf2) / 2);

    const face_match =
      pass1.face_match &&
      pass2.face_match &&
      conf1 >= FACE_MATCH_CONFIDENCE_THRESHOLD &&
      conf2 >= FACE_MATCH_CONFIDENCE_THRESHOLD;

    const overall_status: "approved" | "rejected" =
      face_valid && real_person && face_match ? "approved" : "rejected";

    // ── Merge reasoning ──────────────────────────────────────────────────
    const reasoning: string[] = [];

    // Face detection
    if (!face_valid) {
      if (!pass1.face_valid) reasoning.push(pass1.reasoning?.[0] || "Face not detected");
      else if (!pass2.face_valid) reasoning.push(pass2.reasoning?.[0] || "Face not detected");
    } else {
      reasoning.push(pass1.reasoning?.[0] || "Face detected");
    }

    // Liveness
    if (!real_person) {
      if (!pass1.real_person) reasoning.push(pass1.reasoning?.[1] || "Liveness check failed");
      else if (!pass2.real_person) reasoning.push(pass2.reasoning?.[1] || "Liveness check failed");
    } else {
      reasoning.push(pass1.reasoning?.[1] || "Real person confirmed");
    }

    // Face match — include both perspectives and confidence
    const matchSummary = face_match
      ? `Match confirmed (confidence: ${avgConfidence}%)`
      : `Match rejected (confidence: ${avgConfidence}%, pass1: ${conf1}, pass2: ${conf2})`;
    reasoning.push(matchSummary);

    console.log("[Gemini] Consensus result:", {
      face_valid,
      real_person,
      face_match,
      overall_status,
      avgConfidence,
      conf1,
      conf2,
    });

    return {
      face_valid,
      real_person,
      face_match,
      overall_status,
      reasoning,
    };
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
