// Copyright Paul den Boer
//
// Shelly Script example: Turn on when price is below or equals CONFIG.maxPrice
// Turn off when price is above CONFIG.maxPrice

/////////////////////////////////////////////////////////
// *** Intitalize variabels ***
/////////////////////////////////////////////////////////
let CONFIG = {
  energyzeroEndpoint: "https://api.energyzero.nl/v1/energyprices",
  //check every 60 seconds
  checkInterval: 12 * 60 * 60 * 1000,
  maxPrice: 0.08
};

//ON/OFF strings, to create Cron based time settings
//https://github.com/mongoose-os-libs/cron

/////////////////////////////////////////////////////////
// *** Functions ***
/////////////////////////////////////////////////////////

//Concat numberstring with comma separator
function AddNumber(currentString, element)
{
  if (currentString.length > 0) { currentString = currentString + ","};
  return (currentString + element);
}


//Concat EnergyZero URL
function getMyEnergyURL(maxPrice) {

  // declare and initialize
  let currentday = new Date();
  let nextday = new Date();

  //Add 24h to currentday
  //nextday.setTime(currentday.getTime() + (24 * 60 * 60 * 1000));

  //time range of next 48 hours
  let fromDate = new Date(currentday.getFullYear(),currentday.getMonth(),currentday.getDate(),0,0,0);
  let toDate = new Date(nextday.getFullYear(),nextday.getMonth(),nextday.getDate(),23,0,0);

  return (
    CONFIG.energyzeroEndpoint +
    "?fromDate=" + 
    fromDate.toISOString() +
    "&tillDate=" +
    toDate.toISOString() +
    "&interval=4&usageType=1&inclBtw=false"
  );
}

//Create new schedule scheme, based on concatenated hours
function CreateSchedule(sID,hoursString, daysString,switchValue) {

  //Concat timestring with all day,week, etc. according Cron-format
  let timeString = "0 0 " + hoursString  + " * * " + daysString;

   Shelly.call("Schedule.Create",
 
        {
          "id": sID, // create own schedule_ID
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
      }

   );
   
  console.log("*Schedule created*" );
  console.log("- Schedule   : " + timeString);
  console.log("- SwitchValue: ", switchValue);
 
 }

// Get energy data and create scheduler
// - Determine and contcatenate ON/OFF hours based on energy price
// - Create schedulers; these functions are part off this function, because they have to wait on the results of the first step
function processHttpResponse(response,error_code,error_message,data) {

  //set hour strings//
  let hoursON = "";
  let hoursOFF = "";
  let nextreadingDate = new Date()


  //Cleanup old schedules
  Shelly.call("Schedule.DeleteAll");
  console.log("All old schedules deleted");


  if (error_code != 0) {
     // process error
     console.log("Error reading energiedata: ", error_message);
  } else {
    // proces result
    let energyData = JSON.parse(response.body);


      for (let i = 0; i < energyData.Prices.length; i++) {

        let readingDate = new Date(energyData.Prices[i].readingDate);

        if (energyData.Prices[i].price <= CONFIG.maxPrice) {
          let hoursON = AddNumber(hoursON,readingDate.getHours());

        } else {
          let hoursOFF = AddNumber(hoursOFF,readingDate.getHours());
          
        }

        if (i < (energyData.Prices.length-5)) {
          
          let nextreadingDate = new Date(energyData.Prices[i+1].readingDate);

          //it's a 48h energyprice array  
          //check if day flips, then first create schedule and clear hours for next day
          if (readingDate.getDay() !== nextreadingDate.getDay() ) {
            CreateSchedule(1, hoursON,readingDate.getDay(),true);
            CreateSchedule(2, hoursOFF,readingDate.getDay(),false);

            //clear hours for next day
            let hoursON = "";
            let hoursOFF = "";

          }
        }

 
      }

    //create schedules
    CreateSchedule(3, hoursON,readingDate.getDay(),true);
    CreateSchedule(4, hoursOFF,readingDate.getDay(),false);
    let hoursON = "";
    let hoursOFF = "";



  }
}


function EnergyPriceControlMaxPrice() {

  Shelly.call("http.get", { url: getMyEnergyURL(CONFIG.maxPrice) },processHttpResponse);
 

}

////////////////////////////////////////////////////
// main script
//

//Timer.set(CONFIG.checkInterval, true, EnergyPriceControlMaxPrice);

EnergyPriceControlMaxPrice();