import https from "https";
import "dotenv/config";

const options = {
  hostname: "3b4c5b59-0324-48dd-bf38-4c24cb59d805.us-east4-0.gcp.cloud.qdrant.io",
  port: 6333,
  path: "/collections",
  method: "GET",
  headers: {
    // Exact same header format as curl
    "api-key":
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhY2Nlc3MiOiJtIn0.x6NrWBMMtPqcep5dNxOqjXT42sQhATAMdxEqVFDJKew",
  },
  rejectUnauthorized: false,
};

console.log("Making request with options:", {
  ...options,
  headers: { ...options.headers, "api-key": "[REDACTED]" },
});

const req = https.request(options, (res) => {
  console.log("Status:", res.statusCode);
  console.log("Headers:", res.headers);

  let data = "";
  res.on("data", (chunk) => {
    data += chunk;
  });
  res.on("end", () => {
    try {
      console.log("Response:", JSON.parse(data));
    } catch {
      console.log("Raw response:", data);
    }
  });
});

req.on("error", (e) => {
  console.error("Error:", e);
});

req.end();
