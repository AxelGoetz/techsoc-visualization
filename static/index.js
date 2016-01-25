import d3 from "d3";
import _ from "lodash";
import axios from "axios";

// Global to store member data
let memberData = [];
let membersPerDay = [];
let membersPerYear = [];
let facebookData = [];

// Extracting Data
// ----------------------------------------------------------

// Extracts data from csv, currently the only data we
// are interested in is the purchase data and the
// year in the email address
function extractData(dataPoint) {
  let msec = Date.parse(dataPoint['Order date'].slice(0, 10));
  let d = new Date(msec);

  let year = parseInt(dataPoint.Year);
  memberData.push({date: d, year: parseInt(year)});
}

function sortMembersPerDay(a, b) {
  a.key = new Date(a.key);
  b.key = new Date(b.key);
  return a.key - b.key;
}

// Adds days that are not in the current data
// with a membersPerDay of 0
function addMissingDays() {
  membersPerDay.sort(sortMembersPerDay);
  let length = membersPerDay.length - 1;
  for(let i = 0; i < length; i++) {
    membersPerDay[i].key = new Date(membersPerDay[i].key);
    membersPerDay[i].key.setHours(1);
    let nextDay = new Date(membersPerDay[i].key);
    nextDay.setDate(membersPerDay[i].key.getDate() + 1);

    let nextDayObject = new Date(membersPerDay[i + 1].key);
    nextDayObject.setHours(1);
    if(nextDay.getTime() != nextDayObject.getTime()) {
      let tempObj = {key: nextDay, membersJoined: 0, values: null};
      membersPerDay.push(tempObj);
      membersPerDay.sort(sortMembersPerDay);
      length++;
    }
  }
}

// Gets an array of dictionaries, containing how many members
// joined techsoc on a particular day and how many from each year
function getMembersPerDay() {
  membersPerDay = d3.nest()
    .key(d => d.date).sortKeys(d3.ascending)
    .key(d => d.year).sortKeys(d3.ascending)
    .rollup(leaves => leaves.length)
    .entries(memberData);

  membersPerDay.forEach((e, i, array) => {
    let membersJoined = 0;
    e.values.forEach((e2, i2, array2) => {
      membersJoined += e2.values;
    });
    e.membersJoined = membersJoined;
  });
  addMissingDays();
}

// Gets an array of dictionaries with as key the
// year that a member joined UCL and as a value
// the amount of members we have from that year
function getMembersPerYear() {
  membersPerYear = d3.nest()
    .key(d => d.year).sortKeys(d3.ascending)
    .rollup(leaves => leaves.length)
    .entries(memberData);
}

// Get facebook event data
// ----------------------------------------------------------
let ACCESS_TOKEN = "CAAK3kpvZBViIBAAs9SZBVlLXDnQzO8bZAvwjiB7UdzBuKPJsSqiSiYoND0ct8GQsmcGmBD5Y8pCTptMSNTNp9OflfyBLZBq0ijGoLZCbJifZCNcTtQjHh2MkdlW7fmOgFPymnrSIQpVOmz1cQA7TIwzUwzVzvcTtWkOag9OXQvVZC2jMKGU1gUW3fQQWPOZCLCoZD";

// Replaces string with a date for facebook events
function extractDate(dataPoint) {
  let msec = Date.parse(dataPoint.start_time.slice(0, 10));
  dataPoint.start_time = new Date(msec);
}

function sortFacebook(a, b) {
  a.start_time = new Date(a.start_time);
  b.start_time = new Date(b.start_time);
  return a.start_time - b.start_time;
}

// Checks if facebook event is too old or new
function filterOldandNewEvents() {
  let oldestTicket = new Date(membersPerDay[0].key).getTime();
  let newestTicket = new Date(membersPerDay[membersPerDay.length - 1].key).getTime();

  facebookData = _.filter(facebookData, (d) => {
    let date = new Date(d.start_time).getTime();
    return !((date < oldestTicket) || (date > newestTicket));
  });
}

// Adds the missing days before the first event
// in order to make sure that events align
function addMissingDaysFirstEvent() {
  while(facebookData[0].start_time.getTime() != (new Date(membersPerDay[0].key)).getTime()) {
    let prevDay = new Date(facebookData[0].start_time);
    prevDay.setDate(facebookData[0].start_time.getDate() - 1);
    let tempObj = {start_time: prevDay, id: "", attending_count: 0, interested_count: 0, name: ""};
    facebookData.push(tempObj);
    facebookData.sort(sortFacebook);
  }
}

// Adds missing days with no events to facebook
// Also removes very old events and events in the fuuuuutureeee
function addMissingDaysFacebook() {
  facebookData.sort(sortFacebook);
  filterOldandNewEvents();

  let length = facebookData.length - 1;
  for(let i = 0; i < length; i++) {
    facebookData[i].start_time = new Date(facebookData[i].start_time);
    facebookData[i].start_time.setHours(1);
    let nextDay = new Date(facebookData[i].start_time);
    nextDay.setDate(facebookData[i].start_time.getDate() + 1);

    let nextDayObject = new Date(facebookData[i + 1].start_time);
    nextDayObject.setHours(1);
    if(facebookData[i].start_time.getTime() == nextDayObject.getTime()) {
      let amountPeople1 = facebookData[i].attending_count + facebookData[i].interested_count;
      let amountPeople2 = facebookData[i + 1].attending_count + facebookData[i + 1].interested_count;
      if(amountPeople1 > amountPeople2) {
        facebookData.splice(i, 1);
      } else {
        facebookData.splice(i + 1, 1);
      }
      length--; i--;
    } else if(nextDay.getTime() != nextDayObject.getTime()) {
      let tempObj = {start_time: nextDay, id: "", attending_count: 0, interested_count: 0, name: ""};
      facebookData.push(tempObj);
      facebookData.sort(sortFacebook);
      length++;
    }
  }
  addMissingDaysFirstEvent();
}

// Gets the data for all the events that are on facebook
function getFacebookEvents() {
  axios.get("https://graph.facebook.com/v2.5/UCLUTechSoc/events", {
    params: {
      access_token: ACCESS_TOKEN,
      fields: [
        "name",
        "start_time",
        "attending_count",
        "interested_count"
      ].join(","),
      limit: 200, // Assuming techsoc will never have more than 200 event :P
      json: true
    }
  })
  .then(function(response) {
    facebookData = response.data.data;
    _.map(facebookData, extractDate);
    addMissingDaysFacebook();
    membersBarChart();
  });
}

// GET ALL THE DATAAAAA
// ----------------------------------------------------------

// Actually extracting data from csv and
// placing in in the memberData, membersPerDay
// and membersPerYear variables
d3.csv('./data/members.csv', (error, data) => {
  _.map(data, extractData);
  getMembersPerDay();
  getMembersPerYear();
  getFacebookEvents();
});

// Visualization helper functions
// ----------------------------------------------------------

// Removes any old svg's and then adds a new one
function addNewSVG(bounds) {
  d3.select('svg').remove();
  let body = d3.select('body');
  let svg = body.append('svg');

  svg
    .attr("width", bounds.width + bounds.margin.left + bounds.margin.right)
    .attr("height", bounds.height + bounds.margin.top + bounds.margin.bottom);

  return svg.append('g')
    .attr("transform", "translate(" + bounds.margin.left + "," + bounds.margin.top + ")");
}

// Get the bounds of the svg and the g element
// in the svg in order to allow for margins
function getBounds() {
  let body = d3.select('body');
  let bounds = body.node().getBoundingClientRect();

  let bound = {height: bounds.height, width: bounds.width, margin:
    {top: 50, right: 30, bottom: 30, left: 100}};

  bound.height -= 100; // because of header
  bound.width -= (bound.margin.left + bound.margin.right);
  bound.height -= (bound.margin.top + bound.margin.bottom);

  return bound;
}


// First Bar Chart Visualization
// ----------------------------------------------------------

// Add axis to the membersPerDay bar chart
function addAxisMemberBarChart(g, bounds, y) {
  let x = d3.scale.ordinal()
    .rangeRoundBands([0, bounds.width], 0.1);

  let xAxis = d3.svg.axis()
    .scale(x)
    .orient("bottom");

  let yAxis = d3.svg.axis()
    .scale(y)
    .orient("left");

  g.append("g")
    .attr("class", "x axis")
    .attr("transform", "translate(0," + bounds.height/2 + ")")
    .call(xAxis);

  g.append("g")
      .attr("class", "y axis")
      .call(yAxis)
    .append("text")
      .attr("transform", "rotate(-90)")
      .attr("y", 6)
      .attr("dy", ".71em")
      .style("text-anchor", "end")
      .text("Members");
}

// Adds y axis for facebook events
function addFacebookAxis(g, y) {
  let yAxis = d3.svg.axis()
    .scale(y)
    .orient("left");

  g.append("g")
    .attr("class", "y axis")
    .call(yAxis);
}

// Adds the hidden text to every bar
// containing how many members joined that day
// and which year they joined ucl
function addTextMemberBarChart(bar, bounds) {
  let text = bar.append("text")
    .attr("x", 0)
    .attr("y", 0)
    .attr('transform', 'translate(' + -100 + ", " + 0 + ")")
    .attr("display", "none");

  text.selectAll('tspan')
      .data((d) => d.values === null ? [] : d.values)
    .enter().append('tspan')
      .attr('x', 0)
      .attr('dy', '1.2em')
      .text((d) => ("20" + d.key + ": " + d.values));

  let totalSpan = text.insert('tspan', ":first-child");
  totalSpan
    .attr('x', 0)
    .attr('dy', '1.2em')
    .text(d => "Total: " + d.membersJoined);

  let date = text.insert('tspan', ":first-child");
  date
    .attr('x', 0)
    .attr('dy', '1.2em')
    .text(d => String(d.key).slice(4, 15));
}

// Adds the text on hover for facebook
function addTextFacebookBarChart(bar, bounds) {
  let text = bar.append("text")
    .attr("x", 0)
    .attr("y", 0)
    .attr('transform', 'translate(' + -100 + ", " + (bounds.height - 100) + ")")
    .attr("display", "none");

  text.append('tspan')
    .attr('x', 0)
    .attr('dy', '1.2em')
    .text(d => d.name);

  text.append('tspan')
    .attr('x', 0)
    .attr('dy', '1.2em')
    .text(d => String(d.start_time).slice(4, 15));

  text.append('tspan')
    .attr('x', 0)
    .attr('dy', '1.2em')
    .text(d => ("Attending: " + d.attending_count));

  text.append('tspan')
    .attr('x', 0)
    .attr('dy', '1.2em')
    .text(d => ("Interested: " + d.interested_count));
}


// Function responsible for actually adding the member bars
function addMembersBars(bounds, g, barWidth) {
  let y = d3.scale.linear()
    .range([(bounds.height/2), 0]);

  y.domain([0, d3.max(membersPerDay, d => d.membersJoined )]);

  let bar = g.selectAll(".members")
      .data(membersPerDay)
    .enter().append("g")
      .attr("transform", (d, i) => ("translate(" + i * barWidth + ",0)"))
      .attr("class", "bar members")
      .on('mouseover',function() {
        d3.select(this)
          .select('text')
          .attr('display', 'inline');
      })
      .on('mouseout', function() {
        d3.select(this)
          .select('text')
          .attr('display', 'none');
      });

  bar.append("rect")
    .attr("width", barWidth - 1)
    // uncomment below for an animation
    // .attr("height", 0)
    // .attr("y", bounds.height/2)
    // .transition().delay(function (d,i){ return i * 300;})
    // .duration(100)
    .attr("y", d => y(d.membersJoined))
    .attr("height", d => (bounds.height/2 - y(d.membersJoined)));


  addTextMemberBarChart(bar, bounds);
  addAxisMemberBarChart(g, bounds, y);
}

// Adds the bars for all of the facebook events
function addEventsBars(bounds, g, barWidth) {
  let y = d3.scale.linear()
    .range([(bounds.height/2), (bounds.height)]);

  y.domain([0, d3.max(facebookData, d =>
    (d.interested_count > d.attending_count) ? d.interested_count : d.attending_count)
  ]);

  let bar = g.selectAll(".events")
      .data(facebookData)
    .enter().append("g")
      .attr("transform", (d, i) => ("translate(" + i * barWidth + "," + 0 + ")"))
      .attr("class", "bar facebook")
      .on('mouseover',function() {
        d3.select(this)
          .select('text')
          .attr('display', 'inline');
      })
      .on('mouseout', function() {
        d3.select(this)
          .select('text')
          .attr('display', 'none');
      });

  bar.append("rect")
    .attr('class', 'interested')
    .attr('x', 0)
    .attr("y", bounds.height/2)
    .attr("height", d => (y(d.interested_count) - (bounds.height/2)))
    .attr("width", barWidth/2 - 1);

  bar.append("rect")
    .attr('class', 'attending')
    .attr('x', barWidth/2)
    .attr("y", bounds.height/2)
    .attr("height", d => (y(d.attending_count) - (bounds.height/2)))
    .attr("width", barWidth/2 - 1);


  addTextFacebookBarChart(bar, bounds);
  addFacebookAxis(g, y);
}

// Main function that is responsible for adding
// the bar chart
function membersBarChart() {
  let bounds = getBounds();
  let g = addNewSVG(bounds);

  let barWidth = bounds.width / membersPerDay.length;
  addMembersBars(bounds, g, barWidth);
  addEventsBars(bounds, g, barWidth);
}

// Cumulative line chart visualization
// ----------------------------------------------------------

// Calcualtes the total amount of members
function totalMembers() {
  let members = 0;
  _.map(membersPerDay, (d) => (members += d.membersJoined));
  return members;
}

// Add the axis for the cumulative graph
function addAxisCumulativeChart(g, bounds, y) {
  let x = d3.scale.ordinal()
    .rangeRoundBands([0, bounds.width], 0.1);

  let xAxis = d3.svg.axis()
    .scale(x)
    .orient("bottom");

  let yAxis = d3.svg.axis()
    .scale(y)
    .orient("left");

  g.append("g")
    .attr("class", "x axis")
    .attr("transform", "translate(0," + bounds.height + ")")
    .call(xAxis);

  g.append("g")
      .attr("class", "y axis")
      .call(yAxis)
    .append("text")
      .attr("transform", "rotate(-90)")
      .attr("y", 6)
      .attr("dy", ".71em")
      .style("text-anchor", "end")
      .text("Members");
}

// Adds the text information to the circle
// elements
function addTextCumulativeGraph(circles, bounds) {
  let text = circles.append("text")
    .attr("x", 0)
    .attr("y", 0)
    .attr('transform', 'translate(' + -100 + ", " + -50 + ")")
    .attr("display", "none");

  text.selectAll('tspan')
      .data((d) => d.values === null ? [] : d.values)
    .enter().append('tspan')
      .attr('x', 0)
      .attr('dy', '1.2em')
      .text((d) => ("20" + d.key + ": " + d.values));

  let totalSpan = text.insert('tspan', ":first-child");
  totalSpan
    .attr('x', 0)
    .attr('dy', '1.2em')
    .text(d => "Total: " + d.membersJoined);

  let date = text.insert('tspan', ":first-child");
  date
    .attr('x', 0)
    .attr('dy', '1.2em')
    .text(d => String(d.key).slice(4, 15));
}

// Function responsible for drawing lines
function drawLines(g, bounds, y, linex) {
  let currentTotal = 0;
  let line = d3.svg.line()
    .x((d, i) => (i * linex))
    .y((d) => {
      currentTotal += d.membersJoined;
      return y(currentTotal);
    });

  g.append('path')
    .datum(membersPerDay)
    .attr('class', 'line')
    .attr('d', line);
}

// Draw the circles, which we will use to display more
// information
function drawCircles(g, bounds, y, linex) {
  let currentTotal = 0;
  let circles = g.selectAll("g")
    .data(membersPerDay)
  .enter().append("g")
    .attr('class', 'bar')
    .attr("transform", (d, i) => {
      currentTotal += d.membersJoined;
      return "translate(" + linex*i + "," + y(currentTotal) + ")";
    })
    .on('mouseover',function() {
      d3.select(this)
        .select('text')
        .attr('display', 'inline');
    })
    .on('mouseout', function() {
      d3.select(this)
        .select('text')
        .attr('display', 'none');
    });

  circles.append("circle")
      .attr("cx", 0)
      .attr("cy", 0)
      .attr("r", 2);

  addTextCumulativeGraph(circles, bounds);
}

// Main function that is responsible for adding the
// cumulative line chart
function cumulativeLineChart() {
  let bounds = getBounds();
  let g = addNewSVG(bounds);

  let y = d3.scale.linear()
    .range([bounds.height, 0]);
  y.domain([0, totalMembers()]);
  let linex = bounds.width / membersPerDay.length;

  drawLines(g, bounds, y, linex);
  drawCircles(g, bounds, y, linex);

  addAxisCumulativeChart(g, bounds, y);
}

// Members per year visualization
// ----------------------------------------------------------

// This function draws the bars
function drawYearBarChart(g, bounds, barWidth, y) {
  let bar = g.selectAll("g")
      .data(membersPerYear)
    .enter().append("g")
      .attr("transform", (d, i) => ("translate(" + i * barWidth + ",0)"))
      .attr("class", "bar year");

  bar.append("rect")
    .attr("width", barWidth - 1)
    .attr("y", d => y(d.values))
    .attr("height", d => (bounds.height - y(d.values)));

  let text = bar.append("text")
    .attr("x", barWidth/3)
    .attr("y", (d) => (y(d.values) - 40));

  text.append('tspan')
    .attr('x', barWidth/3)
    .attr('dy', '1.2em')
    .text((d) => ('20' + d.key));

  text.append('tspan')
    .attr('x', barWidth/4)
    .attr('dy', '1.2em')
    .text((d) => ('Total: ' + d.values));
}

// Main function for the members organized
// per year bar chart
function membersPerYearBarChart() {
  let bounds = getBounds();
  let g = addNewSVG(bounds);

  let y = d3.scale.linear()
    .range([bounds.height, 0]);
  y.domain([0, d3.max(membersPerYear, d => d.values)]);
  let barWidth = bounds.width / membersPerYear.length;

  drawYearBarChart(g, bounds, barWidth, y);
  addAxisCumulativeChart(g, bounds, y);
}

// Adding Event Listeners
// ----------------------------------------------------------
let id1 = document.getElementById('function1');
let id2 = document.getElementById('function2');
let id3 = document.getElementById('function3');

id1.addEventListener("click", membersBarChart);
id2.addEventListener("click", cumulativeLineChart);
id3.addEventListener("click", membersPerYearBarChart);
