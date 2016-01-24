import d3 from "d3";
import _ from "lodash";

const fs = require("fs");
const rp = require("request-promise");

// Global to store member data
let memberData = [];
let membersPerDay = [];
let membersPerYear = [];

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

// Actually extracting data from csv and
// placing in in the memberData, membersPerDay
// and membersPerYear variables
d3.csv('./data/members.csv', (error, data) => {
  _.map(data, extractData);
  getMembersPerDay();
  getMembersPerYear();
  // TODO: Call first visualize function here!!
});

// Get facebook event data
// ----------------------------------------------------------
var ACCESS_TOKEN = "CAAK3kpvZBViIBAAs9SZBVlLXDnQzO8bZAvwjiB7UdzBuKPJsSqiSiYoND0ct8GQsmcGmBD5Y8pCTptMSNTNp9OflfyBLZBq0ijGoLZCbJifZCNcTtQjHh2MkdlW7fmOgFPymnrSIQpVOmz1cQA7TIwzUwzVzvcTtWkOag9OXQvVZC2jMKGU1gUW3fQQWPOZCLCoZD";

function getFacebookEvents() {
  return rp({
    uri: "https://graph.facebook.com/v2.5/UCLUTechSoc/events",
    qs: {
      access_token: ACCESS_TOKEN,
      fields: [
        "attending_count",
        "interested_count"
      ].join(",")
    },
    json: true
  }).then(function(response) {
    console.log(response.data);
  });
}

getFacebookEvents();

// First Bar Chart Visualization
// ----------------------------------------------------------
