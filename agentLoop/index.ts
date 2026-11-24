
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({
  apiKey: Bun.env.GEMINI_API_KEY!,
});

// 1. Weather function
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

  return `${city}: ${data.current.temperature_2m}°C`;
}

// 2. Agent loop
async function main() {
  let input: any =
    "Check weather in Gurgaon, Noida and Delhi. Use one tool call at a time.";

  let previousId: string | undefined;

  while (true) {
    const response = await ai.interactions.create({
      model: "gemini-3.5-flash-lite",
      input,
      previous_interaction_id: previousId,
      tools: [
        {
          type: "function",
          name: "get_weather",
          description: "Get weather of a city",
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

    const call = response.steps.find(
      (step) => step.type === "function_call"
    );

    // No more tool calls
    if (!call || call.type !== "function_call") {
      console.log(response.output_text);
      break;
    }

    // Execute the tool
    const { city } = call.arguments as { city: string };

    console.log("Checking:", city);

    const result = await getWeather(city);

    console.log("Result:", result);

    // Send result back to Gemini
    input = [
      {
        type: "function_result",
        name: call.name,
        call_id: call.id,
        result,
      },
    ];

    previousId = response.id;
  }
}

main().catch(console.error);
