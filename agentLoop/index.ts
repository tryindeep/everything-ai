
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({
  apiKey: Bun.env.GEMINI_API_KEY!,
});

// Our weather function
async function getWeather(city: string) {
  const geo = await fetch(
    `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1`
  );

  const geoData = await geo.json() as any;
  const place = geoData.results?.[0];

  if (!place) throw new Error("City not found");

  const weather = await fetch(
    `https://api.open-meteo.com/v1/forecast?latitude=${place.latitude}&longitude=${place.longitude}&current=temperature_2m`
  );

  const data = await weather.json() as any;

  return `${place.name}: ${data.current.temperature_2m}°C`;
}

// Ask Gemini to use our tool
const response = await ai.interactions.create({
  model: "gemini-3.5-flash-lite",
  input: "What's the weather in delhi?",
  tools: [
    {
      type: "function",
      name: "get_weather",
      description: "Get current weather of a city",
      parameters: {
        type: "object",
        properties: {
          city: { type: "string" },
        },
        required: ["city"],
      },
    },
  ],
});

// Execute the tool
const call = response.steps.find(
  (step) => step.type === "function_call"
);

if (call && call.type === "function_call") {
  const args = call.arguments as { city: string };

  const result = await getWeather(args.city);

  // =============== Send result back to Gemini ===================== 
  const finalResponse = await ai.interactions.create({
    model: "gemini-3.5-flash-lite",
    previous_interaction_id: response.id,
    input: [
      {
        type: "function_result",
        name: call.name,
        call_id: call.id,
        result: result,
      },
    ],
  });

  console.log(finalResponse.output_text);
} else {
  console.log(response.output_text);
}
