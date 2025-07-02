let highlightedAirport = null;
let defaultAirports = [];
let mapProjection = null;
let currentZoomLevel = 1;
let zoomBehavior;

async function visualizePath(responseData, svg, pathClass) {
  console.log(responseData);
  if (!Array.isArray(responseData) || responseData.length < 1) {
    alert("No path found between the selected airports.");
    console.error("Invalid or insufficient response data for visualization.");
    return;
  }

  if (!mapProjection) {
    console.error("Projection not set. Make sure the map is rendered first.");
    return;
  }

  const mapContent = svg.select("g.map-content");
  if (mapContent.empty()) {
    console.error("No .map-content group found in SVG.");
    return;
  }

  mapContent.selectAll(`.${pathClass}`).remove(); // Clear old paths
  const pathLayer = mapContent.append("g").attr("class", pathClass);

  const projectedPoints = responseData.map((airport) => {
    if (airport && airport.latitude !== undefined && airport.longitude !== undefined) {
      const rawCoords = [airport.longitude, airport.latitude];
      const projectedCoords = mapProjection(rawCoords);

      return {
        rawCoords,
        projectedCoords,
        name: airport.name,
        iata: airport.iata,
      };
    } else {
      console.warn("Invalid airport data:", airport);
      return null;
    }
  }).filter((point) => point !== null);

  if (projectedPoints.length < 2) {
    alert("Not enough valid airports to draw the path.");
    console.error("Not enough valid airports to draw the path.");
    return;
  }

  // Animate drawing each line sequentially
  for (let i = 0; i < projectedPoints.length - 1; i++) {
    const from = projectedPoints[i].projectedCoords;
    const to = projectedPoints[i + 1].projectedCoords;

    await new Promise(resolve => {
      const line = pathLayer.append("line")
        .attr("x1", from[0])
        .attr("y1", from[1])
        .attr("x2", from[0])
        .attr("y2", from[1])
        .attr("stroke", "#FF4500")
        .attr("stroke-width", 3 / currentZoomLevel) // Adjust stroke width based on zoom
        .attr("stroke-linecap", "round")
        .attr("stroke-linejoin", "round");

      line.transition()
        .duration(1000) // Slower transition for better visual effect
        .attr("x2", to[0])
        .attr("y2", to[1])
        .ease(d3.easeCubic)
        .on("end", resolve);
    });
  }

  // Animate airport points with a slight delay
  projectedPoints.forEach((airport, index) => {
    // Add the airport circle
    pathLayer.append("circle")
      .attr("cx", airport.projectedCoords[0])
      .attr("cy", airport.projectedCoords[1])
      .attr("r", 0 / currentZoomLevel)
      .attr("fill", "#FFD700")
      .transition()
      .delay(index * 1000) // Delay based on sequence
      .duration(500)
      .attr("r", 8 / currentZoomLevel)
      .ease(d3.easeBackOut);
  
    // Add labels with a slight delay
    pathLayer.append("text")
  .attr("x", airport.projectedCoords[0] + 4)
  .attr("y", airport.projectedCoords[1] - 4)
  .attr("fill", "#000")                  // Fill color (text color)
  .attr("stroke", "#fff")                // Stroke color (border color)
  .attr("stroke-width", 3 / currentZoomLevel)  // Stroke width, scaled with zoom
  .attr("paint-order", "stroke")         // Ensures stroke is behind fill
  .attr("font-size", 12 / currentZoomLevel)
  .attr("opacity", 0)
  .text(`${index + 1}. ${airport.name}`)
  .transition()
  .delay(index * 1000 + 500)
  .duration(300)
  .attr("opacity", 1);
  });  
}

function adjustProjectionForAirports(airports, svg) {
  const projection = d3.geoMercator().fitSize(
    [svg.attr("width"), svg.attr("height")],
    {
      type: "FeatureCollection",
      features: airports.map((airport) => ({
        type: "Feature",
        geometry: {
          type: "Point",
          coordinates: airport.rawCoords, // Ensure coordinates match the raw latitude/longitude
        },
        properties: { name: airport.name },
      })),
    }
  );

  mapProjection = projection; // Update the global map projection
}

async function getPath() {
  resetAirportHighlights();

  const airportList = document.getElementById("selected-airport-list");
  const airports = Array.from(airportList.children).map(item => {
    const textSpan = item.querySelector("span");
    return textSpan ? textSpan.textContent.match(/\((.*?)\)/)[1] : null; // Extract IATA code
  });

  const svg = d3.select("#world-map");
  const domesticSwitch = document.getElementById("domestic-toggle").checked; // ✅ Check if domestic mode is enabled
  const selectedCountry = document.getElementById("country-selector").value; // ✅ Get selected country

  try {
    if (airports.length === 2) {
      // **Use Domestic API if enabled**
      const apiEndpoint = domesticSwitch
        ? `/shortest-path-in-country?source=${airports[0]}&destination=${airports[1]}&country=${selectedCountry}`
        : `/shortest-path?source=${airports[0]}&destination=${airports[1]}`;

      const response = await fetch(apiEndpoint);
      const data = await response.json();
      await visualizePath(data, svg, "shortest-path-layer");

    } else if (airports.length > 2) {
      // **Use standard multi-airport path**
      const iataCodes = airports.join(",");
      const response = await fetch(`/direct-path?iataCodes=${iataCodes}`);
      const data = await response.json();
      await visualizePath(data, svg, "multiple-airports-path-layer");

    } else {
      alert("Please select at least two airports to get a path.");
    }
  } catch (error) {
    console.error("Error fetching path data:", error);
  }
}

function renderWorldMapOnce() {
  resizeMapToDiv();

  const svg = d3.select("#world-map")
    .style("background-color", "#90e0ef");

  const width = svg.attr("width");
  const height = svg.attr("height");

  const g = svg.append("g").attr("class", "map-content");

  const projection = d3.geoMercator();
  const path = d3.geoPath().projection(projection);
  mapProjection = projection;

  zoomBehavior = d3.zoom()
  .scaleExtent([1, 20])
  .translateExtent([[0, 0], [width, height]])
  .on("zoom", (event) => {
    const transform = event.transform;
    currentZoomLevel = transform.k; // Save zoom level
    
    g.attr("transform", transform);
    
    // Scale all airport circles to maintain visual size
    g.selectAll("circle")
      .attr("r", d => d.highlighted ? 8 / currentZoomLevel : 5 / currentZoomLevel) // Adjust radius
      .attr("stroke-width", 0.5 / currentZoomLevel); // Adjust stroke-width based on zoom level
  });

  svg.call(zoomBehavior);

  d3.json("world_geo.json")
    .then(geoData => {
      projection.fitSize([width, height], {
        type: "FeatureCollection",
        features: geoData.features,
      });

      g.selectAll("path")
        .data(geoData.features)
        .enter()
        .append("path")
        .attr("d", path)
        .attr("fill", "#FFB703")
        .attr("stroke", "#023047")
        .attr("stroke-width", 0.5 / currentZoomLevel);
    })
    .catch(error => console.error("Error loading GeoJSON file:", error));
}

function resizeMapToDiv() {
  const mapWindow = document.querySelector('.map-window');
  const svg = d3.select('#world-map');

  const width = mapWindow.offsetWidth;
  const height = mapWindow.offsetHeight;

  svg.attr('width', width)
     .attr('height', height);
}

function handleCountrySelection() {
  const selectedCountry = document.getElementById("country-selector").value;

  // Toggle buttons
  document.getElementById("highlight-most-connections").disabled = !selectedCountry;
  document.getElementById("highlight-remote-airports").disabled = !selectedCountry;

  const svg = d3.select("#world-map");
  const g = svg.select("g.map-content");

  if (selectedCountry) {
    // Load airports for selected country
    fetch(`/airports-by-country?country=${selectedCountry}`)
      .then(response => response.json())
      .then(airports => {
        defaultAirports = airports;
        updateAirportsAndZoom(selectedCountry, airports);
      })
      .catch(error => console.error("Error fetching airports:", error));
  } else {
    // If no country is selected:
    // 1. Remove airport markers
    g.selectAll("circle").remove();

    // 2. Reset zoom to original map view
    const width = +svg.attr("width");
    const height = +svg.attr("height");

    d3.json("custom.geo.json")
      .then(geoData => {
        mapProjection.fitSize([width, height], {
          type: "FeatureCollection",
          features: geoData.features,
        });

        svg.transition()
          .duration(1000)
          .call(
            zoomBehavior.transform,
            d3.zoomIdentity
          );
      })
      .catch(error => console.error("Error resetting map projection:", error));
  }
}

function loadCountries() {
  fetch("/countries")
    .then(response => response.json())
    .then(countries => {
      const countrySelector = document.getElementById("country-selector");
      if (countrySelector) {
        countries.forEach(country => {
          const option = document.createElement("option");
          option.value = country;
          option.textContent = country;
          countrySelector.appendChild(option);
        });
      } else {
        console.error("Element with ID 'country-selector' not found.");
      }
    })
    .catch(error => console.error("Error fetching countries:", error));
}

function highlightMostConnectedAirport() {
  const selectedCountry = document.getElementById("country-selector").value;
  if (!selectedCountry) return;

  fetch(`/busiest-airport?country=${selectedCountry}`)
    .then(response => response.json())
    .then(data => {
      const svg = d3.select("#world-map");

      // Highlight only the most connected airport
      svg.selectAll("circle")
        .attr("visibility", d => d.name === data.AirportName ? "visible" : "hidden")
        .attr("fill", d => d.name === data.AirportName ? "#FFD700" : "#4682b4") // Gold color for the most connected airport
        .attr("r", d => d.name === data.AirportName ? 12 / currentZoomLevel : 5 / currentZoomLevel); // Increase radius

      // Show the pop-up for the most connected airport in the sidebar
      const airport = { name: data.AirportName };
      showPopupInSidebar(airport);
    })
    .catch(error => console.error("Error fetching busiest airport:", error));
}

function highlightRemoteAirports() {
  const selectedCountry = document.getElementById("country-selector").value;
  if (!selectedCountry) return;

  fetch(`/remote-airports?country=${selectedCountry}`)
    .then(response => response.json())
    .then(data => {
      const airportNames = data.map(a => a.airportName);
      const svg = d3.select("#world-map");

      // Highlight only airports with a single connection
      svg.selectAll("circle")
        .attr("visibility", d => airportNames.includes(d.name) ? "visible" : "hidden")
        .attr("fill", d => airportNames.includes(d.name) ? "#FF4500" : "#4682b4") // Orange-red color for remote airports
        .attr("r", d => airportNames.includes(d.name) ? 8 / currentZoomLevel : 5 / currentZoomLevel); // Increase radius
    })
    .catch(error => console.error("Error fetching remote airports:", error));
}

function updateAirportsAndZoom(countryName, airports) {
  const svg = d3.select("#world-map");
  const g = svg.select("g.map-content");
  g.selectAll("circle").remove();

  const projection = mapProjection;
  const path = d3.geoPath().projection(projection);

  // Step 1: Draw the airports
  if (airports && airports.length) {
    g.selectAll("circle")
      .data(airports)
      .enter()
      .append("circle")
      .attr("cx", d => projection([d.longitude, d.latitude])[0])
      .attr("cy", d => projection([d.longitude, d.latitude])[1])
      .attr("r", 5 / currentZoomLevel)
      .attr("fill", "#4682b4")
      .attr("stroke", "#fff")
      .attr("stroke-width", 0.1 / currentZoomLevel)
      .each(function(d) {
        d.highlighted = false;
      })
      .on("mouseover", function (event, d) {
        d3.select(this)
          .transition()
          .duration(200)
          .attr("r", 8 / currentZoomLevel)
          .attr("fill", "#FF6F61");
      })
      .on("mouseout", function (event, d) {
        if (!d.highlighted) {
          d3.select(this)
            .transition()
            .duration(200)
            .attr("r", 5 / currentZoomLevel)
            .attr("fill", "#4682b4");
        }
      })
      .on("click", function (event, d) {
        if (!d) {
          console.error("Selected airport data is undefined.");
          return;
        }
      
        d3.selectAll("circle")
          .each(d => {
            if (d) d.highlighted = false; // ✅ Ensure d is defined
          })
          .attr("fill", "#4682b4")
          .attr("r", 5 / currentZoomLevel);
      
        d.highlighted = true;
        d3.select(this)
          .attr("fill", "#FF6F61")
          .attr("r", 8 / currentZoomLevel);

        showPopupInSidebar(d);
      });
  }

  // Step 2: Calculate bounds of the airports
  const [[minX, minY], [maxX, maxY]] = d3.extent(airports, d => projection([d.longitude, d.latitude]))
    .reduce(([min, max], point) => {
      return [
        [Math.min(min[0], point[0]), Math.min(min[1], point[1])],
        [Math.max(max[0], point[0]), Math.max(max[1], point[1])]
      ];
    }, [[Infinity, Infinity], [-Infinity, -Infinity]]);

  const bounds = [[minX, minY], [maxX, maxY]];
  const dx = bounds[1][0] - bounds[0][0];
  const dy = bounds[1][1] - bounds[0][1];
  const cx = (bounds[0][0] + bounds[1][0]) / 2;
  const cy = (bounds[0][1] + bounds[1][1]) / 2;

  const svgWidth = +svg.attr("width");
  const svgHeight = +svg.attr("height");

  // Adjust scale based on the bounds of the selected airports
  let scale = Math.max(1, Math.min(25, 0.9 / Math.max(dx / svgWidth, dy / svgHeight)));

  // Optional: Add a maximum zoom scale to prevent zooming too deep
  scale = Math.min(scale, 5); // Limit the scale to a maximum of 4 for example

  const translate = [svgWidth / 2 - scale * cx, svgHeight / 2 - scale * cy];

  svg.transition()
    .duration(1000)
    .call(
      zoomBehavior.transform,
      d3.zoomIdentity.translate(translate[0], translate[1]).scale(scale)
    );
}

function showPopupInSidebar(airport) {
  highlightedAirport = airport;
  const sidebarPopup = document.getElementById('sidebar-airport-details');
  const airportNameElement = document.getElementById('sidebar-airport-name');
  airportNameElement.textContent = airport.name;
  sidebarPopup.style.display = 'block';
}

function closePopup() {
  const popup = document.getElementById("airport-popup");
  popup.style.display = 'none';
}

function updateAirportListNumbers() {
  const airportList = document.getElementById("selected-airport-list");
  if (!airportList) return;

  const listItems = airportList.querySelectorAll("li");
  listItems.forEach((item, index) => {
    const textSpan = item.querySelector("span");
    if (textSpan) {
      const originalText = textSpan.textContent.split(". ")[1] || textSpan.textContent;
      textSpan.textContent = `${index + 1}. ${originalText}`;
    }
  });
}

function addHighlightedAirportToList() {
  if (!highlightedAirport) return;

  const airportList = document.getElementById("selected-airport-list");
  const existingItem = Array.from(airportList.children).find(
    item => item.textContent.includes(`${highlightedAirport.name} (${highlightedAirport.iata})`)
  );

  if (existingItem) {
    alert("Airport is already in the list.");
    return;
  }

  const listItem = document.createElement("li");
  listItem.innerHTML = `
    <span>${highlightedAirport.name} (${highlightedAirport.iata})</span>
    <button onclick="removeAirportFromList(this)" style="width: 80px; background-color: #e63946; color: white; border: none; padding: 6px 10px; border-radius: 5px; cursor: pointer;">Remove</button>
  `;

  airportList.appendChild(listItem);
  updateAirportListNumbers(); // Update numbering
  closePopup(); // Clear the sidebar after adding the airport
}

function removeAirportFromList(button) {
  const listItem = button.parentElement; // Get the parent <li> element
  listItem.remove(); // Remove the <li> element from the DOM
  updateAirportListNumbers(); // Update numbering
}

function resetAirportHighlights() {
  const svg = d3.select("#world-map");
  svg.selectAll("circle")
    .attr("visibility", "visible")
    .attr("fill", "#4682b4")
    .attr("r", 5 / currentZoomLevel);
  svg.selectAll(".multiple-airports-path-layer, .shortest-path-layer").remove();
  closePopup();
}

function showSidebarDetails(airport) {
  const sidebarDetails = document.getElementById("sidebar-airport-details");
  const airportNameElement = document.getElementById("sidebar-airport-name");
  
  airportNameElement.textContent = airport.name;
  sidebarDetails.style.display = "block";
}

function closeSidebarDetails() {
  document.getElementById("sidebar-airport-details").style.display = "none";
}

document.getElementById("zoom-in").addEventListener("click", () => {
  const svg = d3.select("#world-map");
  svg.transition().duration(300).call(zoomBehavior.scaleBy, 1.2);
});

document.getElementById("zoom-out").addEventListener("click", () => {
  const svg = d3.select("#world-map");
  svg.transition().duration(300).call(zoomBehavior.scaleBy, 0.8);
});

document.addEventListener("DOMContentLoaded", () => {
  renderWorldMapOnce();
  loadCountries();
});