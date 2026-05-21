import app from "./routes/server.ts";

const port = 5050;

app.listen({ 
  port, 
  hostname: "0.0.0.0" 
});

console.log(`[INFO] Server is running at port http://localhost:${port}`);