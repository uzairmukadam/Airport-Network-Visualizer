/* eslint-disable no-undef */
const express = require("express");
const neo4j = require("neo4j-driver");
const path = require("path");

const app = express();
const port = 3000;

// Connect to Neo4j
const driver = neo4j.driver("bolt://localhost:7687", neo4j.auth.basic("neo4j", "password"));
const session = driver.session({ database: "neo4j" });

// Serve static files
app.use(express.static(path.join(__dirname, "public")));

/* Utility Function for Database Queries */
async function runQuery(query, params = {}) {
  try {
    const result = await session.run(query, params);
    return result.records;
  } catch (err) {
    throw new Error("Database Query Failed");
  }
}

/* --- ROUTES --- */

// Fetch unique countries
app.get("/countries", async (req, res) => {
  try {
    const records = await runQuery(`
      MATCH (a:Airport)
      RETURN DISTINCT a.country AS country
      ORDER BY country
    `);
    res.json(records.map(r => r.get("country")));
  } catch (err) {
    res.status(500).send("Server Error");
  }
});

// Airports in a country
app.get("/airports-by-country", async (req, res) => {
  try {
    const { country } = req.query;
    const records = await runQuery(`
      MATCH (a:Airport {country: $country})
      RETURN a
      ORDER BY a.name
    `, { country });
    res.json(records.map(r => r.get("a").properties));
  } catch (err) {
    res.status(500).send("Server Error");
  }
});

// Shortest path between two airports
app.get("/shortest-path", async (req, res) => {
  try {
    const { source, destination } = req.query;
    const records = await runQuery(`
      MATCH path = shortestPath((x:Airport {iata: $source})-[:FLIES_TO*..5]->(y:Airport {iata: $destination}))
      RETURN nodes(path) AS pathNodes
    `, { source, destination });

    res.json(records[0]?.get("pathNodes").map(node => node.properties) || []);
  } catch (err) {
    res.status(500).send("Server Error");
  }
});

// Shortest path within the same country
app.get("/shortest-path-in-country", async (req, res) => {
  try {
    const { source, destination, country } = req.query;
    const records = await runQuery(`
      MATCH (start:Airport {iata: $source, country: $country}),
      (end:Airport {iata: $destination, country: $country})
      WITH start, end
      MATCH path = shortestPath((start)-[:FLIES_TO*..5]->(end))
      WHERE ALL(node IN nodes(path) WHERE node.country = $country)
      RETURN nodes(path) AS pathNodes
    `, { source, destination, country });

    res.json(records[0]?.get("pathNodes").map(node => node.properties) || []);
  } catch (err) {
    res.status(500).send("Server Error");
  }
});

// Direct connections
app.get("/direct-path", async (req, res) => {
  try {
    const iataCodes = req.query.iataCodes.split(",");
    const records = await runQuery(`
      UNWIND range(0, size($iataCodes) - 2) AS idx
      MATCH (a:Airport {iata: $iataCodes[idx]})-[:FLIES_TO]->(b:Airport {iata: $iataCodes[idx+1]})
      RETURN a AS start, b AS end
    `, { iataCodes });

    const nodes = [];
    records.forEach(record => {
      [record.get("start").properties, record.get("end").properties].forEach(node => {
        if (!nodes.find(n => n.iata === node.iata)) nodes.push(node);
      });
    });

    res.json(nodes);
  } catch (err) {
    res.status(500).send("Server Error");
  }
});

// Get busiest airport
app.get("/busiest-airport", async (req, res) => {
  try {
    const { country } = req.query;
    const records = await runQuery(`
      MATCH (a:Airport)-[r:FLIES_TO]->(b:Airport)
      WHERE a.country = $country
      RETURN a.name AS AirportName, COUNT(r) AS TotalFlights
      ORDER BY TotalFlights DESC
      LIMIT 1
    `, { country });

    res.json(records[0]?.toObject() || {});
  } catch (err) {
    res.status(500).send("Server Error");
  }
});

// Get remote airports
app.get("/remote-airports", async (req, res) => {
  try {
    const { country } = req.query;
    const records = await runQuery(`
      MATCH (a:Airport)-[r:FLIES_TO]->(b:Airport)
      WHERE a.country = $country
      WITH a, COUNT(r) AS TotalFlights
      WHERE TotalFlights = 1
      RETURN a.name AS AirportName, TotalFlights
      ORDER BY AirportName
    `, { country });

    res.json(records.map(r => ({
      airportName: r.get("AirportName"),
      totalFlights: r.get("TotalFlights").toInt()
    })));
  } catch (err) {
    res.status(500).send("Server Error");
  }
});

// Start the server
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
