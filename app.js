'use strict';

process.env.DEBUG = 'actions-on-google:*';
let Assistant = require('actions-on-google').ApiAiAssistant;
let express = require('express');
let bodyParser = require('body-parser');
var Client = require('node-rest-client').Client;
var client = new Client();
var moment = require('moment');

var surfSpots = {};
var TARGET_DATE = null;

let app = express();
app.use(bodyParser.json({type: 'application/json'}));

const DATE_ARG = 'date-time';
const LOCATION_ARG = 'geo-city';
const SURFSPOT_ARG = 'surf_spot';
const SURFREGION_ARG = 'surf_region';
const CONDITION_TYPES = {"POOR": 0, "POOR-FAIR":1, "FAIR":2};


client.registerMethod("jsonMethod", "http://api.spitcast.com/api/spot/all", "GET");
client.methods.jsonMethod(function (data, response) {
  for(var i in data) {
    surfSpots[data[i].spot_name.toLowerCase()] = data[i];
  }
});

function surfSpotRequest(){

}
function rankedRequest(){

}
function locationBasedRequest(){
  //http://api.spitcast.com/api/spot-forecast/search?longitude=-122.447759&latitude=37.768137&distance=10&year=2013&month=11&day=9&shape_min=1&size_max=6&size_min=2
}

function formatResponse(spot_condition, date, county_data){
  console.log(county_data);
  let message = "";
  let conditions = spot_condition.shape_full.replace("-", " to ");
  let waveHeight = "";
  if (date){
    message = "On " + date.format("dddd")+ " morning at "+ spot_condition.spot_name +", conditions are expected to be " + conditions + ".";
  } else {
    message = "Currently at " + spot_condition.spot_name+ " conditions are " + conditions + ".";
  }
  let waveCoeficient = (1/6) * spot_condition.size;
  let low = Math.round(spot_condition.size - waveCoeficient);
  let high = Math.round(spot_condition.size + waveCoeficient);
  if (low == high){
    if (low == 1) message += " Waves are about a foot high."
    else message += " Waves are " + low + " feet."
  } else {
    message += " Waves are between " + low + " and " + high + " feet.";
  } 
  let wind_direction = county_data.direction_text.replace("N", "North").replace("S", "South").replace("E", " East").replace("W", " West")
  message += " Wind should be out of the " + wind_direction + " at "+ county_data.speed_kts + " knots. Have fun out there!"
  console.log(message);
  return message;
};

app.post('/', function (req, res) {
  const assistant = new Assistant({request: req, response: res});

  let surf_spot = "";
  let surf_region = "";
  
  function responseHandler (assistant) {
    TARGET_DATE = assistant.getArgument(DATE_ARG);
    if (assistant.getArgument(SURFSPOT_ARG)){
      surf_spot = assistant.getArgument(SURFSPOT_ARG).toLowerCase();
    } else if( assistant.getArgument(SURFREGION_ARG)){
      surf_region = assistant.getArgument(SURFREGION_ARG).toLowerCase();
    }
    var sclient = new Client();
    sclient.get("http://api.spitcast.com/api/spot/all", function (data, response) {
        for(var i in data) {
            surfSpots[data[i].spot_name.toLowerCase()] = data[i];
        }
        if (!surfSpots[surf_spot]){
            console.log("The surf spot was not found.");
            assistant.tell('I am really sorry! I could not find that surf spot. Please try another name, or I can also look for spots close to you.');
            return;
        }
        console.log("Getting http://api.spitcast.com/api/spot/forecast/"+surfSpots[surf_spot].spot_id+"/?dcat=week");
        sclient.get("http://api.spitcast.com/api/spot/forecast/"+surfSpots[surf_spot].spot_id+"/?dcat=week", function (data, response) {
        let county_name = surfSpots[surf_spot].county_name.toLowerCase().replace(" ", "-");
        sclient.get("http://api.spitcast.com/api/county/wind/"+county_name+"/?dcat=week", function (countydata, countyresponse) {
            //console.log(countydata)
            if (response.statusCode==500){
              assistant.tell('I am sorry! Something went wrong trying to get the forcast for that location. Please try another surf spot.');
              return;
            }
            //console.log(response.statusCode);
            if (!TARGET_DATE) {
              assistant.tell(formatResponse(data[0], null, countydata[0]));
            } else {
              console.log("----------------------------")
              let surfDate = moment(TARGET_DATE);
              console.log(surfDate);
              for (var i in data){
                let dataDate = moment(data[i].date, "dddd MMM DD YYYY");
                if ((surfDate.diff(dataDate, 'days')==0) && (data[i].hour=='6AM')){
                  console.log(data[i]);
                  for (var j in countydata){
                    console.log(countydata[j]);
                    let countyDate = moment(countydata[j].date, "dddd MMM DD YYYY");
                    console.log(countyDate)
                    if ((surfDate.diff(countyDate, 'days')==0) && (countydata[j].hour=='6AM')){
                      assistant.tell(formatResponse(data[i], surfDate, countydata[j]));
                      break;
                    }
                  }
                }
              }
            }
        });
    });
    }).on('error', function (err) {
        console.log('Something went wrong on the request', err.request.options);
        assistant.tell("I am sorry! Something went wrong trying to get the forcast for that location. Please try another surf spot.");
    });
  }
  assistant.handleRequest(responseHandler);
});

if (module === require.main) {
  let server = app.listen(process.env.PORT || 8080, function () {
    let port = server.address().port;
    console.log('App listening on port %s', port);
  });
}

module.exports = app;