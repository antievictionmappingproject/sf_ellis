$(document).ready(function () {

  /* Initialize animation variables. These will be generated dynamically from the cartoDB data */
  var startingTime, counterTime, step, timer;
  var finalRadiusMultiplier = .5; //0.6

  /*Tooltip showing address info*/
  var tooltip = d3.select("body")
    .append("div")
    .attr("class", "tooltip")
    .style("position", "absolute")
    .style("z-index", "60")
    .style("visibility", "hidden")
    .text("tooltip");


  // Initialize a map centered at (34.0953048,-118.265477) at zoom level 13
  var map = L.map('map').setView([37.7623504, -122.4099611], 13);
  // Style URL format in XYZ PNG format; see our documentation for more options
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 20,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  }).addTo(map);

  /* Initialize the SVG layer */
  map._initPathRoot()

  /* Pass map SVG layer to d3 */
  var svg = d3.select("#map").select("svg"),
    g = svg.append("g");

  /*Animation Timing Variables*/
  var startingTime = 86166720000;
  var step = 1500000000;
  var timer;
  var isPlaying = false;
  var counterTime = startingTime;

  fetch('https://raw.githubusercontent.com/antievictionmappingproject/sf_ellis/main/data/evictions.csv')
    .then(response => {
      return response.text()
    }) // Read as text first
    .then(text => {
      return Papa.parse(text, { header: true, skipEmptyLines: true }).data;
    })
    .then(rawData => {
      return rawData.sort((a, b) => Date.parse(a.date_filed) - Date.parse(b.date_filed));
    })
    .then(sortedData => {
      return sortedData.filter((row) => row.lat && row.long)
    })
    .then(filteredData => {
      return filteredData.map((record) => {
        record.units = Number(record.units)
        record.lat = Number(record.lat)
        record.long = Number(record.long)

        return record
      })
    })
    .then(filteredData => {
      var cumEvictions = 0;
      startingTime = Date.parse(filteredData[0].date_filed) - 1000000;
      const maxTime = Date.parse(filteredData[filteredData.length - 1].date_filed) + 4000000;
      counterTime = startingTime;
      filteredData.forEach(function (d) {
        d.LatLng = new L.LatLng(d.lat, d.long);
        cumEvictions += d.units;
        d.totalEvictions = cumEvictions;
      });

      /*Add an svg group for each data point*/
      var node = g.selectAll(".node").data(filteredData).enter().append("g");
      var feature = node.append("circle")
        .attr("r", function (d) { return 1 + d.units; })
        .attr("class", "center")
        .attr("r", function (d) { return (d.units / 1.5 * finalRadiusMultiplier) + 4; })
        .style("stroke", function (d) {
          if (d.type === "OMI") {
            return "#606";
          } else if (d.type === "DEMO") {
            return "#066";
          }
          return "#f30";
        });
      /*show node info on mouseover*/
      node.on("mouseover", function (d) {
        var fullDate = d.date_filed;
        var thisYear = new Date(fullDate).getFullYear();
        var currMonth = new Date(fullDate).getMonth() + 1;
        var currDay = new Date(fullDate).getDate();
        var units = d.units;
        var unitText = units + " eviction";
        if (units > 1) {
          unitText = units + " evictions"
        }
        var dateString = currMonth + "/" + currDay + "/" + thisYear;
        $(".tooltip").html(d.address_1 + "<br>" + d.owner + "<br>" + unitText + "<br>" + dateString);
        return tooltip.style("visibility", "visible");
      })
        .on("mousemove", function () {
          return tooltip.style("top",
            (d3.event.pageY - 10) + "px").style("left", (d3.event.pageX + 10) + "px");
        })
        .on("click", function (d) {
          tooltip.text(d.address_1 + ", " + d.owner);
          return tooltip.style("visibility", "visible");
        })
        .on("mouseout", function () { return tooltip.style("visibility", "hidden"); });

      /*Initialize play button and slider*/
      $("#play").click(togglePlay);
      $("#slider").slider({
        max: maxTime, min: startingTime, value: maxTime, step: step, start: function (event, ui) {
          clearInterval(timer);
        }, change: function (event, ui) {
          counterTime = $("#slider").slider("value");
          filterCurrentPoints();
        }, slide: function (event, ui) {
          counterTime = $("#slider").slider("value");
          filterCurrentPoints();
        }, stop: function (event, ui) {
          if (isPlaying) {
            playAnimation();
          }
          filterCurrentPoints();
        }
      });
      /*Starting setup*/
      var currDate = new Date(counterTime).getFullYear();
      //stopAnimation();
      filterCurrentPoints();
      map.on("zoomend", update);
      update();
      playAnimation();

      /*Filter map points by date*/
      function filterCurrentPoints() {
        var filtered = node.attr("visibility", "hidden")
          .filter(function (d) { return Date.parse(d.date_filed) < counterTime })
          .attr("visibility", "visible");
        // console.log(JSON.stringify(filtered[0]));
        // updateCounter(filtered[0].length-1);
        filtered.filter(function (d) {
          return Date.parse(d.date_filed) > counterTime - step
        })
          .append("circle")
          .attr("r", 8)
          .style("fill", "red")
          .style("fill-opacity", 0.8)
          .transition()

          .duration(800)
          .ease(Math.sqrt)
          .attr("r", function (d) { return d.units * 10; })
          .style("fill", "#f40")
          .style("fill-opacity", 1e-6)
          .remove();
        updateCounter(filtered[0].length - 1);
      }

      /*Update map counters*/
      function updateCounter(latestEvictionIndex) {
        const totalEvictions = latestEvictionIndex > 0 ? filteredData[latestEvictionIndex].totalEvictions : 0
        document.getElementById('counter').innerHTML = totalEvictions + " ";
        currDate = new Date(counterTime).getFullYear();
        var currMonth = new Date(counterTime).getMonth() + 1;
        var currDay = new Date(counterTime).getDate();

        document.getElementById('date').innerHTML = "1/1/1994 - " + currMonth + "/" + currDay + "/" + currDate;

      }

      /*Update slider*/
      function playAnimation() {
        counterTime = $("#slider").slider("value");
        if (counterTime >= maxTime) {
          $("#slider").slider("value", startingTime);

        }
        isPlaying = true;
        timer = setInterval(function () {
          counterTime += step;
          $("#slider").slider("value", counterTime);
          if (counterTime >= maxTime) {
            stopAnimation();
          }
        }, 500);

      }

      function stopAnimation() {
        clearInterval(timer);
        $('#play').css('background-image', 'url(images/play.png)');
        isPlaying = false;
      }

      /*Scale dots when map size or zoom is changed*/
      function update() {
        var up = map.getZoom() / 13;
        node.attr("transform", function (d) { return "translate(" + map.latLngToLayerPoint(d.LatLng).x + "," + map.latLngToLayerPoint(d.LatLng).y + ") scale(" + up + ")" });

      }

      /*called when play/pause button is pressed*/
      function togglePlay() {
        if (isPlaying) {
          stopAnimation();
        } else {
          $('#play').css('background-image', 'url(images/pause.png)');
          playAnimation();
        }
      }
    }).catch(error => console.error("Error fetching data:", error));

  /*Show info about on mouseover*/
  $(".popup").hide();
  $(".triggerPopup").mouseover(function (e) {
    $(".popup").position();
    var id = $(this).attr('id');
    if (id == "ellis") {
      $("#ellisPopup").show();
    } else if (id == "omi") {
      $("#omiPopup").show();
    } else {
      $("#demoPopup").show();
    }
    $('.popup').css("top", e.pageY + 20);
  });

  $(".triggerPopup").on("mouseout", function () { $(".popup").hide(); });
});