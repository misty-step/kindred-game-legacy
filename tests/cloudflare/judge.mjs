import { createServer } from "node:http";

// Isolated dependency-failure fixture, not a semantic judge or production API.
let available = true;
createServer(async (request, response) => {
  if (request.method === "POST" && request.url === "/unavailable") {
    available = false;
  } else if (request.method === "POST" && request.url === "/recover") {
    available = true;
  } else if (request.method === "POST" && request.url === "/decisions") {
    if (!available) {
      response.writeHead(503);
      response.end();
      return;
    }
    let text = "";
    for await (const chunk of request) text += chunk;
    const body = JSON.parse(text);
    response.setHeader("Content-Type", "application/json");
    response.end(
      JSON.stringify({
        answers: Object.fromEntries(
          Object.keys(body.questions).map((name) => [
            name,
            { type: "noul", noul: 0.01 },
          ]),
        ),
      }),
    );
    return;
  } else {
    response.writeHead(404);
  }
  response.end();
}).listen(43863, "127.0.0.1", () =>
  console.log("Synthetic distinct-only judge on127.0.0.1:43863"),
);
