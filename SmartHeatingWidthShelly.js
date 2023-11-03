// This script is calculating next day heating time based on weather forecast, 
// and turn on your heating system for cheapest hours based on electricity market price.

// It's scheduled to run daily after 23:00 to set heating timeslots for next day.
// by Leivo Sepp, 14.01.2023

// Set the country Estonia-ee, Finland-fi, Lthuania-lt, Latvia-lv
let country = "ee";

let alwaysOnMaxPrice = 70;
let alwaysOffMinPrice = 300;

// Parameter heatingCurve is used to set proper heating curve for your house. This is very personal and also crucial component.
// You can start with the default number 5, and take a look how this works for you.
// If you feel cold, then increase this number. If you feel too warm, then decrease this number.
// You can see the dependency of temperature and and this parameter from this visualization: "link will be here..."
// Heating hours are calculated by this quadratic equation: (startingTemp-avgTemp)^2 + (heatingCurve / powerFactor) * (startingTemp-avgTemp)
let heatingCurve = 5;

// Parameter startingTemp is used as starting point for heating curve.
// For example if startingTemp = 10, then the heating is not turned on for any temperature warmer than 10 degrees.
let startingTemp = 10;

// powerFactor is used to set quadratic equation parabola curve flat or steep. Change it with your own responsibility.
let powerFactor = 0.2;

// This parameter used to set a number of heating hours in a day in case the weather forecast fails. Number 1-24. 
// If Shelly was able to get the forecast, then this number is owerwritten by the heating curve calculation.
// For example if this number is set to 5 then Shelly will be turned on for 5 most cheapest hours during a day. 
// If the cheapest hours are 02:00, 04:00, 07:00, 15:00 and 16:00, then the Shelly is turned on 02-03, 04-05, 07-08 and 15-17 (two hours in a row).
let heatingTime = 5;

// If getting electricity prices from Elering fails, then use this number as a time to start Shelly. 2 means 02:00. 
// For example if there is no internet connection at all, and heatingTime=5, default_start_time=1 then the Shelly is turned on from 01:00 to 06:00
let default_start_time = 1;

// Keep this is_reverse value "false", I think 99% of the situations are required so.
// Rarely some heating systems requires reversed relay. Put this "true" if you are sure that your appliance requires so.
// For example my personal ground source heat pump requires reversed management. If Shelly relay is activated (ON), then the pump is turned off.
let is_reverse = false;

// This is timezone for EE, LT, LV and FI.
// Do not change this because it won't work currently for other timezones.
let timezone = 2;

// some global variables
let openMeteoUrl = "https://api.open-meteo.com/v1/forecast?daily=temperature_2m_max,temperature_2m_min&timezone=auto";
let eleringUrl = "https://dashboard.elering.ee/api/nps/price";
let data_indx;
let sorted = [];
let heatingTimes = [];
let weatherDate;
let dateStart;
let dateEnd;
let lat = JSON.stringify(Shelly.getComponentConfig("sys").location.lat);
let lon = JSON.stringify(Shelly.getComponentConfig("sys").location.lon);
let shellyUnixtimeUTC = Shelly.getComponentStatus("sys").unixtime;

function getShellyStatus() {
    //find Shelly timezone
    let shellyLocaltime = new Date(shellyUnixtimeUTC * 1000);
    let shellyLocalHour = shellyLocaltime.getHours();
    let shellyUTCHour = shellyLocaltime.toISOString().slice(11, 13);
    let timezone = shellyLocalHour - shellyUTCHour;
    if (timezone > 12) { timezone -= 24; }
    if (timezone < -12) { timezone += 24; }
    timezoneSeconds = timezone * 60 * 60;

    // After 23:00 this script will use tomorrow's prices
    // Running this script before 23:00, today energy prices are used.
    let addDays = shellyLocalHour >= 23 ? 0 : -1;
    let secondsInDay = 60 * 60 * 24;

    print("Shelly local date and time ", shellyLocaltime);
    shellyLocaltime = null;
    // proper date-time format for Elering query
    let isoTime = new Date((shellyUnixtimeUTC + timezoneSeconds + secondsInDay * addDays) * 1000).toISOString().slice(0, 10);
    let isoTimePlusDay = new Date((shellyUnixtimeUTC + timezoneSeconds + (secondsInDay * (addDays + 1))) * 1000).toISOString().slice(0, 10);
    let hourStart = JSON.stringify(24 - timezone);
    let hourEnd = JSON.stringify(24 - timezone - 1);
    dateStart = isoTime + "T" + hourStart + ":00Z";
    dateEnd = isoTimePlusDay + "T" + hourEnd + ":00Z";

    // Let's make proper date format to get weather forecast
    weatherDate = isoTimePlusDay;

    // Let's call Open-Meteo weather forecast API to get tomorrow min and max temperatures
    print("Starting to fetch weather data for ", weatherDate, " from Open-Meteo.com for your location:", lat, lon, ".")
    Shelly.call("HTTP.GET", { url: openMeteoUrl + "&latitude=" + lat + "&longitude=" + lon + "&start_date=" + weatherDate + "&end_date=" + weatherDate }, function (response) {
        if (response === null || JSON.parse(response.body)["error"]) {
            print("Getting temperature failed. Using default heatingTime parameter and will turn on heating fot ", heatingTime, " hours.");
        }
        else {
            let jsonForecast = JSON.parse(response.body);
            // temperature forecast, averaging tomorrow min and max temperatures 
            let avgTempForecast = (jsonForecast["daily"]["temperature_2m_max"][0] + jsonForecast["daily"]["temperature_2m_min"][0]) / 2;
            // the next line is basically the "smart quadratic equation" which calculates the hetaing hours based on the temperature
            heatingTime = ((startingTemp - avgTempForecast) * (startingTemp - avgTempForecast) + (heatingCurve / powerFactor) * (startingTemp - avgTempForecast)) / 100;
            heatingTime = Math.ceil(heatingTime);
            if (heatingTime > 24) { heatingTime = 24; }
            print("Temperture forecast tomorrow", weatherDate, " is ", avgTempForecast, " heating is turned on for ", heatingTime, " hours.");
            response = null;
            jsonForecast = null;
        }
        find_cheapest();
    }
    );
}

// This is the main function to proceed with the price sorting etc.
function find_cheapest() {
    // Let's get the electricity market price from Elering
    print("Starting to fetch market prices from Elering from ", dateStart, " to ", dateEnd, ".");
    Shelly.call("HTTP.GET", { url: eleringUrl + "?start=" + dateStart + "&end=" + dateEnd }, function (result) {
        if (result === null) {
            // If there is no result, then use the default_start_time and heatingTime
            print("Fetching market prices failed. Adding one big timeslot.");
            setTimer(is_reverse, heatingTime);
            addSchedules(sorted, default_start_time, default_start_time + 1);
        }
        else {
            // Let's hope we got good JSON result and we can proceed normally
            // Example of good json
            // let json = "{success: true,data: {ee: [{timestamp: 1673301600,price: 80.5900},"+
            // "{timestamp: 1673305200,price: 76.0500},{timestamp: 1673308800,price: 79.9500}]}}";   
            print("We got market prices, going to sort them from cheapest to most expensive ...");
            let jsonElering = JSON.parse(result.body);
            result = null;
            let pricesArray = jsonElering["data"][country];
            jsonElering = null;
            sorted = sort(pricesArray, "price");
            pricesArray = null;

            print("Cheapest daily price:", sorted[0].price, " ", new Date((sorted[0].timestamp + timezoneSeconds) * 1000));
            print("Most expensive daily price", sorted[sorted.length - 1].price, " ", new Date((sorted[sorted.length - 1].timestamp + timezoneSeconds) * 1000));

            for (let a = 0; a < sorted.length; a++) {
                if ((a <= heatingTime || sorted[a].price < alwaysOnMaxPrice) && !(sorted[a].price > alwaysOffMinPrice)) {
                    heatingTimes.push({ timestamp: sorted[a].timestamp, price: sorted[a].price });
                }
            }
            sorted = null;

            // The fact is that Shelly RPC calls are limited to 5, one is used already for HTTP.GET and we have only 4 left.
            // These 4 RPC calls are used here. 
            totalHours = heatingTimes.length;
            if (totalHours > 0) {
                data_indx = (totalHours - 4) < 1 ? totalHours : 4;
                print("Starting to add hours 0-3");
                addSchedules(heatingTimes, 0, data_indx);
            }
            if (totalHours - 4 > 0) {
                Timer.set(5 * 1000, false, function () {
                    data_indx = (totalHours - 9) < 1 ? totalHours : 9;
                    print("Starting to add hours 4-8");
                    addSchedules(heatingTimes, 4, data_indx);
                });
            }
            if (totalHours - 9 > 0) {
                Timer.set(12 * 1000, false, function () {
                    data_indx = (totalHours - 14) < 1 ? totalHours : 14;
                    print("Starting to add hours 9-13");
                    addSchedules(heatingTimes, 9, data_indx);
                });
            }
            if (totalHours - 14 > 0) {
                Timer.set(19 * 1000, false, function () {
                    data_indx = (totalHours - 19) < 1 ? totalHours : 19;
                    print("Starting to add hours 14-19");
                    addSchedules(heatingTimes, 14, data_indx);
                });
            }
            if (totalHours - 19 > 0) {
                Timer.set(26 * 1000, false, function () {
                    data_indx = (totalHours - 24) < 1 ? totalHours : 24;
                    print("Starting to add hours 19-23");
                    addSchedules(heatingTimes, 19, data_indx);
                });
            }
        }
    });
}

// Add schedulers, switching them on or off is depends on the "is_reverse" parameter
function addSchedules(sorted_prices, start_indx, data_indx) {
    for (let i = start_indx; i < data_indx; i++) {
        let hour, price;
        if (sorted_prices.length > 0) {
            hour = new Date((sorted_prices[i].timestamp + timezoneSeconds) * 1000).getHours();
            price = sorted_prices[i].price;
        }
        else {
            hour = JSON.stringify(start_indx);
            price = "no price.";
        }
        print("Scheduled start at: ", hour, " price: ", price);
        // Set the start time crontab
        let timer_start = "0 0 " + hour + " * * SUN,MON,TUE,WED,THU,FRI,SAT";
        // Creating one hour schedulers 
        Shelly.call("Schedule.Create", {
            "id": 0, "enable": true, "timespec": timer_start,
            "calls": [{
                "method": "Switch.Set",
                "params": {
                    id: 0,
                    "on": !is_reverse
                }
            }]
        }
        )
    }
    sorted_prices = null;
}

//this function for testing purposes only
function dateTimeToUnixTime(year, month, day, hh, mm) {
    let month_yday = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
    let year_adj = year + 4800;  /* Ensure positive year, multiple of 400. */
    let febs = year_adj - (month <= 2 ? 1 : 0);  /* Februaries since base. */
    let leap_days = 1 + Math.floor(febs / 4) - Math.floor(febs / 100) + Math.floor(febs / 400);
    let days = 365 * year_adj + leap_days + month_yday[month - 1] + day - 1;
    return (days - 2472692) * 86400 + hh * 3600 + mm * 60;  /* Adjust to Unix epoch. */
}

// Shelly doesnt support Javascript sort function so this basic math algorithm will do the sorting job
function sort(array, sortby) {
    // Sorting array from smallest to larger
    let i, j, k, min, max, min_indx, max_indx, tmp;
    j = array.length - 1;
    for (i = 0; i < j; i++) {
        min = max = array[i][sortby];
        min_indx = max_indx = i;
        for (k = i; k <= j; k++) {
            if (array[k][sortby] > max) {
                max = array[k][sortby];
                max_indx = k;
            }
            else if (array[k][sortby] < min) {
                min = array[k][sortby];
                min_indx = k;
            }
        }
        tmp = array[i];
        array.splice(i, 1, array[min_indx]);
        array.splice(min_indx, 1, tmp);

        if (array[min_indx][sortby] === max) {
            tmp = array[j];
            array.splice(j, 1, array[min_indx]);
            array.splice(min_indx, 1, tmp);
        }
        else {
            tmp = array[j];
            array.splice(j, 1, array[max_indx]);
            array.splice(max_indx, 1, tmp);
        }
        j--;
    }
    return array;
    // Huhh, array is finally sorted
}

// Delete all the schedulers before adding new ones
function deleteSchedulers() {
    print("Deleting all existing schedules ...");
    Shelly.call("Schedule.DeleteAll");
}

// Set countdown timer to flip the Shelly status
// Auto_on or auto_off is depends on the "is_reverse" parameter
// Delay_hour is the time period in hour. Shelly needs this in seconds.
function setTimer(is_reverse, delay_hour) {
    let is_on = is_reverse ? "on" : "off";
    print("Setting ", delay_hour, " hour auto_", is_on, "_delay.");
    Shelly.call("Switch.SetConfig", {
        "id": 0,
        config: {
            "name": "Switch0",
            "auto_on": is_reverse,
            "auto_on_delay": delay_hour * 60 * 60,
            "auto_off": !is_reverse,
            "auto_off_delay": delay_hour * 60 * 60
        }
    }
    )
}

function scheduleScript() {
    // This script is run at random moment during the first 15 minutes after 23:00
    let minrand = JSON.stringify(Math.floor(Math.random() * 15));
    let secrand = JSON.stringify(Math.floor(Math.random() * 59));
    let script_schedule = secrand + " " + minrand + " " + "23 * * SUN,MON,TUE,WED,THU,FRI,SAT";
    let script_number = Shelly.getCurrentScriptId();
    print("Creating schedule for this script with the following CRON", script_schedule);
    Shelly.call("Schedule.create", {
        "id": 3, "enable": true, "timespec": script_schedule,
        "calls": [{
            "method": "Script.start",
            "params": {
                "id": script_number
            }
        }]
    })
}

function stopScript() {
    // Stop this script in 1.5 minute from now
    Timer.set(100 * 1000, false, function () {
        print("Stopping the script ...");
        Shelly.call("Script.stop", { "id": script_number });
    });
}

deleteSchedulers();
getShellyStatus();
setTimer(is_reverse, 1);
scheduleScript();
stopScript();
