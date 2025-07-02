# Airport Network Visualizer

This project utilizes Neo4j to visualize airport connectivity, allowing users to explore relationships between various airports and analyze flight paths efficiently.

## 1. Data Choice

For this project, I selected an airport and airline connectivity dataset, which originally contained the following files:

1. **Airports** – Contains airport metadata, including names, locations, and IATA codes.
2. **Routes** – Lists available flight connections between airports.
3. **Airlines** – Includes airline-specific details.
4. **Airplanes** – Provides aircraft data.

I decided to use only the **airports** and **routes** datasets while eliminating the airlines and airplanes datasets to maintain simplicity and avoid unnecessary complexity. The exclusion of airline-specific data prevents complications when visualizing general airport connectivity.

## 2. Process

### Loading the dataset

The process of loading the dataset was straightforward:

1. Copied the files to the Neo4j import directory.
2. Executed queries to import nodes (Airport) and relationships (FLIES_TO).

### Data Modifications

Despite the simplicity of loading, some refinements were needed:

#### Airport Data Cleaning:

- Many airports lacked IATA codes, making route mapping difficult.
- These records were removed to avoid unlinked airport nodes.

#### Route Data Adjustments:

- Some flight routes involved airports without valid IATA codes, which created inconsistencies in connectivity.
- Unnecessary columns (relevant only if airline and airplane data were included) were dropped to reduce data complexity and optimize query performance.

## 3. Volume

1. **Total Nodes: 6033**
2. **Total Relationships: 36708**

## 4. Interesting Queries

### 1. Find the busiest airport in a country:
Returns the airport with the highest number of direct connections.

    MATCH (a:Airport)-[r:FLIES_TO]->(b:Airport)
    WHERE a.country = "USA"
    RETURN a.name, COUNT(r) AS TotalFlights
    ORDER BY TotalFlights DESC
    LIMIT 1;

### 2. Find airports with minimal connectivity:
Returns airports within a country that have just one route—often remote airbases.

    MATCH (a:Airport)-[r:FLIES_TO]->(b:Airport)
    WITH a, COUNT(r) AS connections
    WHERE connections = 1
    RETURN a.name, a.iata;

### 3. Find the shortest path between two airports:
Returns the most direct route (if available) or reroutes via an intermediate airport.

    MATCH path = shortestPath((start:Airport {iata: "JFK"})-[:FLIES_TO*..5]->(end:Airport {iata: "LAX"}))
    RETURN nodes(path);

### 4. Find the shortest domestic-only path:
Restricts pathfinding to flights within the same country only.

    MATCH (start:Airport {iata: "DEL", country: "India"}),  
        (end:Airport {iata: "BOM", country: "India"})  
    WITH start, end  
    MATCH path = shortestPath((start)-[:FLIES_TO*..5]->(end))  
    WHERE ALL(node IN nodes(path) WHERE node.country = "India")  
    RETURN nodes(path);

### 5. Find direct connections between multiple airports:
Identifies airports that have direct flights between them.

    MATCH (a:Airport)-[:FLIES_TO]->(b:Airport)
    WHERE a.iata IN ["JFK", "ORD", "ATL"]
    RETURN a.name, COLLECT(b.name);

## 5. Bells and Whistles

To enhance user experience, the project features several interactive and performance improvements:

- Instead of displaying airports as simple graph nodes, they are mapped to real-world locations for better visualization.
- Users can zoom and pan dynamically for better navigation.
- Airports dynamically load per country to avoid cluttering the map.
- Flight paths are smoothly animated, showing connections progressively.
- Strategic indexing ensures faster lookups and graph traversal.

## 6. Limitations

Despite its strengths, some limitations remain:

- Some elements are visually inconsistent due to my limited frontend experience.
- Paths are based on route existence, not on travel time or price optimization.
- Currently, no way to select preferred airlines when visualizing paths.
- The dataset lacks some obvious airport routes, which may lead to unexpected detours.