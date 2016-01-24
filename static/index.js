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

  let year = dataPoint['User email'].split('.')[2].slice(0, 2);
  year = parseInt(year);
  if(!isNaN(year)) {
    memberData.push({date: d, year: parseInt(year)});
  }
}

function sortMembersPerDay(a, b) {
  return a.key - b.key;
}

// Adds days that are not in the current data
// with a membersPerDay of 0
function addMissingDays() {
  let length = membersPerDay.length - 1;
  for(var i = 0; i < length; i++) {
    membersPerDay[i].key = new Date(membersPerDay[i].key);
    let nextDay = new Date(membersPerDay[i].key.getTime());
    nextDay.setDate(membersPerDay[i].key.getDate() + 1);

    let nextDayObject = new Date(membersPerDay[i + 1].key);
    if(nextDay != nextDayObject) {
      let tempObj = {key: nextDay, membersJoined: 0, values: null};
      membersPerDay.push(tempObj);
      membersPerDay.sort(sortMembersPerDay);
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
var ACCESS_TOKEN = "CAAK3kpvZBViIBAAs9SZBVlLXDnQzO8bZAvwjiB7UdzBuKPJsSqiSiYoND0ct8GQsmcGmBD5Y8pCTptMSNTNp9OflfyBLZBq0ijGoLZCbJifZCNcTtQjHh2MkdlW7fmOgFPymnrSIQpVOmz1cQA7TIwzUwzVzvcTtWkOag9OXQvVZC2jMKGU1gUW3fQQWPOZCLCoZD";

// Replaces string with a date for facebook events
function extractDate(dataPoint) {
  let msec = Date.parse(dataPoint.start_time.slice(0, 10));
  dataPoint.start_time = new Date(msec);
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
  membersBarChart();
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
    {top: 20, right: 30, bottom: 30, left: 40}};

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

  let tspan = text.insert('tspan', ":first-child");

  tspan
    .attr('x', 0)
    .attr('dy', '1.2em')
    .text(d => "Members joined: " + d.membersJoined);

}


// Function responsible for actually adding the member bars
function addMembersBars(bounds, g, y, barWidth) {
  let bar = g.selectAll("g")
      .data(membersPerDay)
    .enter().append("g")
      .attr("transform", (d, i) => ("translate(" + i * barWidth + ",0)"))
      .attr("class", "bar")
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
    .attr("y", d => y(d.membersJoined))
    .attr("height", d => (bounds.height/2 - y(d.membersJoined)))
    .attr("width", barWidth - 1);

  addTextMemberBarChart(bar, bounds);
  addAxisMemberBarChart(g, bounds, y);
}

// Functions that adds the barchart for then
// membersPerDay data
function membersBarChart() {
  let bounds = getBounds();
  let g = addNewSVG(bounds);

  let y = d3.scale.linear()
    .range([(bounds.height/2), 0]);

  y.domain([0, d3.max(membersPerDay, d => d.membersJoined )]);
  let barWidth = bounds.width / membersPerDay.length;
  addMembersBars(bounds, g, y, barWidth);
  //addEventsBars(bounds, g, y, barWidth);
}
