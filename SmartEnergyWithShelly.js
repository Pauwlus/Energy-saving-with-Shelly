// Copyright Paul den Boer
//
// Shelly Script example: Turn on when price is below or equals CONFIG.maxPrice
// Turn off when price is above CONFIG.maxPrice

/////////////////////////////////////////////////////////
// *** Intitalize variabels ***
/////////////////////////////////////////////////////////
let CONFIG = {
  energyzeroEndpoint: "https://api.energyzero.nl/v1/energyprices",
  //check 2 times a day (every 12h)
  checkInterval: 1 * 60 * 60 * 1000,
  maxPrice: 0.08
};

let scheduleObjectArray = [];
let scheduleIDsArray = [];


/////////////////////////////////////////////////////////
// *** Functions ***
/////////////////////////////////////////////////////////

//Concat numberstring with comma separator
function AddNumber(currentString, element)
{
  if (currentString.length > 0) { currentString = currentString + ","};
  return (currentString + element);
}

//Data persistence in Key-Value-Store
function kvsSet(key, value) {
  Shelly.call(
      "KVS.Set",
      { "key": key, "value": value }
  );
}


//Concat EnergyZero URL
function getMyEnergyURL(daystimerange) {
  //additional timerange hours


  // declare and initialize
  let currentday = new Date();
  let nextday = new Date();

  //Add 24h to currentday
  nextday.setTime(currentday.getTime() + (((daystimerange-1) * 24) * 60 * 60 * 1000));

  //time range of next 48 hours
  let fromDate = new Date(currentday.getFullYear(),currentday.getMonth(),currentday.getDate(),0,0,0);
  let toDate = new Date(nextday.getFullYear(),nextday.getMonth(),nextday.getDate(),23,0,0);

  let fullURL = 
    CONFIG.energyzeroEndpoint +
    "?fromDate=" + 
    fromDate.toISOString() +
    "&tillDate=" +
    toDate.toISOString() +
    "&interval=4&usageType=1&inclBtw=false";
 
   kvsSet("SmartEnergyLastURL",fullURL);
   
   //Log last run in local time
   kvsSet("SmartEnergyLastRun",currentday.toUTCString());

  return (fullURL);
}

//Create new schedule scheme, based on concatenated hours and push in an array
function CreateScheduleArray(sID,hoursString, daysString,switchValue) {

  //Using cron based time settings
  //https://github.com/mongoose-os-libs/cron
  //https://shelly-api-docs.shelly.cloud/gen2/ComponentsAndServices/Schedule/

  //   Each expression contains 6 fields:
  // seconds, 0-59
  // minutes, 0-59
  // hours, 0-23
  // day of month, 1-31
  // month, 1-12 or JAN-DEC
  // day of week 0-6 or SUN-SAT


  //Concat timestring with all day,week, etc. according Cron-format
  let timeString = "0 0 " + hoursString  + " * * " + daysString;
 
  let scheduleElement = 
   {
    //"id": sID, // create own schedule_ID
    "enable": true,
    "timespec": timeString,
    "calls": [
        {
            "method": "switch.set",
            "params": {
                "id": 0,
                "on": switchValue
           }
        }
      ] 
    };

  // build up an array with schedule objects
  scheduleObjectArray.push(scheduleElement);

  console.log("*Schedule created*" );
  console.log("- Schedule   : " + timeString);
  console.log("- SwitchValue: ", switchValue);
 
 }

  //Recursive function, prevents stacking shelly calls problems
 function CreateSchedulers() {

  //create scheduler  
  Shelly.call("Schedule.Create",scheduleObjectArray[0],
  function (res, err, msg, data) {
    if (err !== 0) {
        print("FAILED, ERROR:",0);
    }
    else {
        print("SUCCESS:",res.id);

        //create an array of scheduleIDs and store in KVS
        scheduleIDsArray.push(res.id); 
        kvsSet("SmartEnergyScheduleIDs",scheduleIDsArray);  
        
    }
  });

  scheduleObjectArray.splice(0,1);

  if (scheduleObjectArray.length > 0) {
    Timer.set(1000, false, CreateSchedulers); //recursive to force one by one execution
  }

  

 }

// Get energy data and create scheduler
// - Determine and contcatenate ON/OFF hours based on energy price
// - Create schedulers; these functions are part off this function, because they have to wait on the results of the first step
function processHttpResponse(response,error_code,error_message,data) {

  //set hour strings//
  let hoursON = "";
  let hoursOFF = "";
  let nextreadingDate = new Date()
  let scheduleObjectArray = [];

  //Cleanup old schedules
  Shelly.call("Schedule.DeleteAll");
  console.log("All old schedules deleted");


  if (error_code != 0) {
     // process error
     console.log("Error reading energiedata: ", error_message);
  } else {
    // proces result
    let energyData = JSON.parse(response.body);
    
    // keep date of firste element
    let startreadingDate = new Date(energyData.Prices[0].readingDate); 
    
    for (let i = 0; i < energyData.Prices.length; i++) {

      let readingDate = new Date(energyData.Prices[i].readingDate);

      //it's a 48h energyprice array  
      //check if day flips, then first create schedule and clear hours for next day
      if (readingDate.getDate() !== startreadingDate.getDate() ) {
        CreateScheduleArray(1, hoursON,startreadingDate.getDay(),true);
        CreateScheduleArray(2, hoursOFF,startreadingDate.getDay(),false);

        //clear hours for next day
        let hoursON = "";
        let hoursOFF = "";

        startreadingDate = readingDate

      }

      if (energyData.Prices[i].price <= CONFIG.maxPrice) {
        let hoursON = AddNumber(hoursON,readingDate.getHours());

      } else {
        let hoursOFF = AddNumber(hoursOFF,readingDate.getHours());
        
      }


    }

    //Fill schedule array
    CreateScheduleArray(3, hoursON,readingDate.getDay(),true);
    CreateScheduleArray(4, hoursOFF,readingDate.getDay(),false);
    let hoursON = "";
    let hoursOFF = "";

    CreateSchedulers();
    
  }
}


function EnergyPriceControlMaxPrice() {


  Shelly.call("http.get", { url: getMyEnergyURL(2) },processHttpResponse);


}


////////////////////////////////////////////////////
// main script
//

//Timer.set(CONFIG.checkInterval, true, EnergyPriceControlMaxPrice);

EnergyPriceControlMaxPrice();
