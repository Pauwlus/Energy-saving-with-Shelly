let hour = 1
let price = 2
let ctPeriod = 3

Shelly.call("Schedule.Create", {
    "id": 0, "enable": false, "timespec": "0 0 12,13,14,15 * * 4",
    "calls": [{
        "method": "Switch.Set",
        "params": {
            "id": 0,
            "on": false
                  }
              }]
    },
    function (res, err, msg, data) {
        if (err !== 0) {
            print("FAILED, ERROR:",0);
        }
        else {
            print("SUCCESS:",res.id);
            //_.schedId.push(res.id); //create an array of scheduleIDs
            
        }
    },
//    { hour: hour, price: price, ctPeriod: ctPeriod }
);





//Use auto_on_delay on device 0 for max price setting 
function GetMaxPriceUserSetting {
    Shelly.call(
    "switch.getconfig",
    {
      //for more than one switch devices use the respective id
      id: 0,
    },
    function (result, error_code, error_message) {
        Return (result.auto_on_delay);
    }
  );
  }
  
  
  
  //print ("Max price:", GetMaxPriceUserSetting);