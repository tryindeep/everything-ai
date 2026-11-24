import { GoogleGenAI } from "@google/genai";
import { createInterface } from "node:readline/promises";

const ai = new GoogleGenAI({
  apiKey: Bun.env.GEMINI_API_KEY!,
});

// 1. Weather tool
async function getWeather(city: string) {
  const geo = await fetch(
    `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1`
  );

  const geoData = await geo.json() as any;
  const place = geoData.results?.[0];

  if (!place) return "City not found";

  const weather = await fetch(
    `https://api.open-meteo.com/v1/forecast?latitude=${place.latitude}&longitude=${place.longitude}&current=temperature_2m`
  );

  const data = await weather.json() as any;

  return `${city}: ${data.current.temperature_2m}°C`;
}

// 2. Tell Gemini which tool is available
const tools = [
  {
    type: "function" as const,
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
];

// 3. Chat
async function main() {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  let previousId: string | undefined;

  while (true) {
    const question = await rl.question("\nYou: ");

    if (question.toLowerCase() === "exit") break;

    let input: any = question;

    // 4. Agent loop
    while (true) {
      const response = await ai.interactions.create({
        model: "gemini-3.5-flash-lite",
        input,
        tools,
        previous_interaction_id: previousId,
      });

      const call = response.steps.find(
        (step) => step.type === "function_call"
      );

      // No tool call: Gemini has answered
      if (!call || call.type !== "function_call") {
        console.log("\nGemini:", response.output_text);
        previousId = response.id;
        break;
      }

      // Execute tool
      const { city } = call.arguments as { city: string };

      const result = await getWeather(city);

      console.log("Tool:", result);

      // Send result back to Gemini
      input = [
        {
          type: "function_result",
          name: call.name,
          call_id: call.id,
          result: [{ type: "text", text: result }],
        },
      ];

      previousId = response.id;
    }
  }

  rl.close();
}

main().catch(console.error);