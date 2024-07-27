# Use energy smartly and cheaply with Shelly
- Just forked, start soon working on it
- I will only wil use the HEAT_LOWPRICE part, and make it suitable for the EnergyZero API

- [Smart and cheap heating with Shelly](#smart-and-cheap-heating-with-shelly)
  - [Script Overview](#script-overview)
  - [Configuration parameters](#configuration-parameters)
  - [Important to know](#important-to-know)
- [Smart heating algorithms](#smart-heating-algorithms)
  - [Weather Forecast Algorithm](#weather-forecast-algorithm)
    - [Advantages of Weather Forecast-Based Heating](#advantages-of-weather-forecast-based-heating)
    - [Shelly Geolocation](#shelly-geolocation)
    - [Heating curve](#heating-curve)
  - [Time Period Algorithm](#time-period-algorithm)
- [Does it Truly Reduce My Electric Bills](#does-it-truly-reduce-my-electric-bills)
- [How to Install this Script](#how-to-install-this-script)
  - [Installation](#installation)
  - [Configuring Script Parameters](#configuring-script-parameters)
  - [How to Verify Script Execution](#how-to-verify-script-execution)
  - [How the Script Operates](#how-the-script-operates)
- [Troubleshooting](#troubleshooting)
  - [Message "This schedule contains invalid call method or params"](#message-this-schedule-contains-invalid-call-method-or-params)
  - [Message "Id3: #1 Scheduler at: 12:00 price: 185.91 EUR/MWh (energy price + transmission). FAILED, 20 schedulers is the Shelly limit."](#message-id3-1-scheduler-at-1200-price-18591-eurmwh-energy-price--transmission-failed-20-schedulers-is-the-shelly-limit)
  - [Error "Couldn't get script"](#error-couldnt-get-script)
  - [Advanced → Key Value Storage → Script Data](#advanced--key-value-storage--script-data)

## Script Overview
This Shelly script is designed to retrieve energy market prices from Elering and
activate heating during the most cost-effective hours each day, employing various algorithms. 

1. Dynamic calculation of heating time for the next day based on weather forecasts.
2. Division of heating into time periods, with activation during the cheapest hour within each period.
3. Utilization of min-max price levels to maintain the Shelly system consistently on or off.

The script runs daily after 23:00 or as necessary during the day to set up heating time slots for the upcoming period.    

## Configuration parameters

* ``heatingMode: HEAT24H_FCST`` - Heating mode, options are described in the following table.

> You can customize or change the heating modes to better suit your personal preferences and specific situations. This flexibility allows you to adjust the system based on your needs, energy considerations, and comfort requirements.

|Heating mode|Description|Best usage|
|---|---|---|
|``HEAT24H_FCST``|The heating time for **24-hour** period depends on the **outside temperature**.|Concrete floor heating system or big water tank capable of retaining thermal energy for a duration of at least 10 to 15 hours.|
|``HEAT12H_FCST``|The heating time for each **12-hour** period depends on the **outside temperature**.|Gypsum (kipsivalu) floor heating system or water tank capable of retaining thermal energy for a duration of 5 to 10 hours.
|``HEAT6H_FCST``|The heating time for each **6-hour** period depends on the **outside temperature**.|Air source heat pumps, radiators or underfloor heating panels with small water tank capable of retaining energy for a duration of 3 to 6 hours.
|``HEAT24H_20H``|Heating is activated during the **20** most cost-effective hours in a **day**.|Ventilation system.
|``HEAT24H_12H``|Heating is activated during the **12** most cost-effective hours in a **day**.|Big water tank 1000L or more.
|``HEAT24H_8H``|Heating is activated during the **8** most cost-effective hours in a **day**.|Big water tank 1000L or more.
|``HEAT12H_6H``|Heating is activated during the **six** most cost-effective hours within every **12-hour** period.|Big water tank 1000L or more with heavy usage.
|``HEAT12H_2H``|Heating is activated during the **two** most cost-effective hours within every **12-hour** period. |A 150L hot water boiler for a little household.
|``HEAT12H_1H``|Heating is activated during the **single** most cost-effective hours within every **12-hour** period. |A 100L hot water boiler for a single person.
|``HEAT6H_2H``|Heating is activated during the **two** most cost-effective hours within every **6-hour** period.|A 200L hot water boiler for a household with four or more people.
|``HEAT6H_1H``|Heating is activated during the **single** most cost-effective hours within every **6-hour** period. |A 100L hot water boiler for a small household with two people.
|``HEAT4H_2H``|Heating is activated during the **two** most cost-effective hours within every **4-hour** period.|A 200L hot water boiler for a household with six or more people with heavy usage.
|``HEAT4H_1H``|Heating is activated during the **single** most cost-effective hours within every **4-hour** period.|A 100L hot water boiler for a household with four or more people.
|``HEAT_LOWPRICE``|Heating is only activated during hours when the **price is lower** than the specified ``alwaysOnLowPrice``.|
   
* ``elektrilevi: VORK2KUU`` - Elektrilevi transmission fee, options are the following.

|Heating mode|Description|
|---|---|
|``VORK1``|Elektrilevi Võrk1. Day and night rate is 72 EUR/MWh|
|``VORK2``|Elektrilevi Võrk2. Day 87 and night 50 EUR/MWh|
|``VORK2KUU``|Elektrilevi Võrk2 with monthly fee. Day 56 and night 33 EUR/MWh|
|``VORK4``|Elektrilevi Võrk4. Day 37 and night 21 EUR/MWh|
|``NONE``|Transmission fee is set to 0.|

* ``alwaysOnLowPrice: 10`` - Keep heating always ON if energy price lower than this value (EUR/MWh).

* ``alwaysOffHighPrice: 300`` - Keep heating always OFF if energy price higher than this value (EUR/MWh).

* ``isOutputInverted: false`` - Configures the relay state to either normal or inverted.
    * ``true`` - Inverted relay state. This is required by many heating systems like Nibe or Thermia.
    * ``false`` - Normal relay state. 

* ``relayID: 0`` - Configures the Shelly relay ID when employing a Shelly device with multiple relays. Default ``0``.

* ``defaultTimer: 60`` - Configures the default timer duration, in minutes, for toggling the Shelly state. The default value is set to ``60`` to align with hourly changes in energy prices.

* ``country: "ee"`` - Specifies the country for energy prices: 
    * ``ee`` - Estonia
    * ``fi`` - Finland
    * ``lt`` - Lithuania
    * ``lv`` - Latvia

* ``heatingCurve: 0`` - Adjusts the heating curve by shifting it to the left or right. Default ``0``, shifting by 1 equals 1h. This setting is applicable only if weather forecast used.
    * ``-10`` - less heating
    * ``10`` - more heating

* ``powerFactor: 0.5`` - Adjusts the heating curve to be either more gradual (flat) or more aggressive (steep). Default ``0.5``. This setting is applicable only if weather forecast used.
    * ``0`` - flat
    * ``1`` - steep

## Important to know

* <p>When the script is stopped, all schedules are deleted. Shelly only follows the heating algorithm when the script is running.</p>
* <p>Up to two instances of this script can run concurrently, both employing different algorithm. These instances can either operate with the same switch output using Shelly Plus 1 or use different switch outputs, as supported by devices like Shelly PRO 4PM.</p>
* <p>Shelly allows three scripts to run simultaneously. In practice, only two heating scripts can run concurrently because the third script is reserved for the essential "watchdog" script. This "watchdog" script ensures proper cleanup when the heating script is stopped or deleted.</p>
* <p>To mitigate the impact of power or internet outages, this script operates continuously. It checks every minute to confirm whether updates are needed for energy market prices or the current weather forecast.</p>
* <p>The "enable" button for this script must be activated. This setting ensures that the script starts after a power outage, restart, or firmware update.</p>
* <p>This script exclusively handles schedulers generated by its own processes. In contrast to the previous version, which featured a "delete all schedulers" command, this script is designed to delete only those schedulers that it has created.</p>
* <p>When saving the script, avoid immediately clicking "Start" to prevent potential issues with Shelly that may occur if you initiate the start process too quickly. Initiate Start once the saving process, which may take 3-6 seconds, is complete.</p>
* <p>This solution will only yield benefits if you have an hourly priced energy contract. If your energy contract features a flat rate, this solution will not contribute to reducing your energy bill.</p>
* This script depends on the internet and these two services:
    * Electricity market price from [Elering API](https://dashboard.elering.ee/assets/api-doc.html#/nps-controller/getPriceUsingGET),
    * Weather forecast from [Open-Meteo API](https://open-meteo.com/en/docs).

<br>

# Smart heating algorithms

## Weather Forecast Algorithm

> This algorithm calculates the heating time for the next day based on weather forecasts. It is particularly effective for various home heating systems, including those with substantial water tanks capable of retaining thermal energy. This approach optimizes energy usage by aligning heating needs with anticipated weather conditions.

### Advantages of Weather Forecast-Based Heating

* Temperature Responsiveness:

When the outside temperature is a mild +17 degrees Celsius, no heating is necessary. Conversely, as the temperature drops to -5 degrees Celsius, there is a need for some heating, and for extremely cold conditions like -20 degrees Celsius, significant amount of heating is required. 

* Smart Heating Management:

Utilizing weather forecasts allows for smart and adaptive heating management. The system will proactively adjust heating times based on the outside temperature, creating a responsive and dynamic heating schedule.

* Location-Specific Forecast:

To provide accurate weather forecasts, location data is necessary. This enables the system to deliver precise predictions for your home's climate, allowing for a customized and effective heating strategy. 

### Shelly Geolocation

> Ensure that your Shelly device has the correct location information by checking Shelly &rarr; Settings &rarr; Geolocation &rarr; Latitude/Longitude.

Note: Shelly's location is determined based on your internet provider's IP address, which may or may not accurately reflect your home location. Verify and update the latitude and longitude settings as needed.

### Heating curve

The relationship between temperature and heating time is known as the *heating curve*.

Heating time is influenced by the insulation of your household. For instance, an old and uninsulated house may require 10 hours of heating at -5 degrees, whereas a new A-class house might only need 6 hours.

To account for these differences, the script includes the parameter ``heatingCurve``, allowing users to customize the heating curve based on their specific household characteristics.

* 24 hour period graph represents visually how heating time varies with outside temperature and the ``heatingCurve`` parameter which shifts the heating curve to the left or right, whereas shifting 1 equals 1h. The Shelly device has a maximum limit of 20 schedulers, representing the maximum heating hours the script can manage within a 24-hour period. If more heating hours are needed, the script employs a 12-hour algorithm.

<img src="images/HeatingCurve24.jpg" alt="Heating curve for 24h period" width="750">

____

* 12 hour period graph represents visually how heating time varies with outside temperature and the ``heatingCurve`` parameter.

<img src="images/HeatingCurve12.jpg" alt="Heating curve for 12h period" width="750">

For those interested in the mathematical aspect, the linear equation used to calculate heating time is: ``(Temperature Forecast) * PowerFactor + (Temperature Forecast + heatingCurve)``.

## Time Period Algorithm

> This algorithm divides heating into distinct time periods, activating heating during the most cost-effective hours within each period. It is well-suited for use cases such as hot water boilers, where usage is contingent on the household size rather than external temperature. This method optimizes energy efficiency by aligning heating with periods of lower energy costs.

* A 24-hour graph with 10 heating hours visually shows when the most affordable times for heating are chosen during the day. The red bar represents heating hours within the day.

<img src="images/Heating24_10.jpg" alt="Heating period 24h" width="750">

___

* A 4-hour graph with 1 heating hours visually shows how the most affordable time for heating is chosen during each of the 4h-period. The red bar represents heating hour within the period.

<img src="images/Heating4_1.jpg" alt="Heating period 24h" width="750">

</br>

# Does it Truly Reduce My Electric Bills
In short: yes.

Here's a more detailed explanation. While your overall daily electric consumption remains the same, this script optimizes the activation of your heating devices for the most economical hours. Consequently, even with the same energy consumption, your electricity bill is reduced.

Appliances like water heaters, water tanks, ground-source or air-source heat pumps, electric radiators, underfloor electric heaters, and air conditioning are examples of energy-intensive devices that benefit from being activated during the most cost-effective times of the day.

Electricity prices can fluctuate significantly, sometimes varying up to 100 times during a day. Check electricity market prices for more information. https://dashboard.elering.ee/et/nps/price


# How to Install this Script

## Installation

1. Optain a Shelly Plus, Pro or Gen3 device [Shelly devices](https://www.shelly.cloud/en-ee/products/).
2. Connect the Shelly device to your personal WiFi network. Refer to the [Shelly web interface guides.](https://kb.shelly.cloud/knowledge-base/web-interface-guides)
3. The Shelly firmware must be version 1.0.0 or higher. The script is not compatible with the firmware 0.14.* or older.
4. Open the Shelly device web page: Click Settings &rarr; Device Information &rarr; Device IP &rarr; click on the IP address. The Shelly device web page will open, on the left menu click "<> Scripts".
5. Click the "Library" button (do not click "Add Script") &rarr; Configure URL &rarr; copy-paste and save the following link. By following this method, you can ensure that you always have the latest version of the script.  `https://raw.githubusercontent.com/LeivoSepp/Smart-heating-management-with-Shelly/master/manifest.json`

<img src="images/insertcode.jpg" alt="Insert code" width="750">

6. Configure Parameters:
    - Set heating mode based on your requirements.
    - Set the Elektrilevi transmission fee contract.
    - Set the output relay mode: normal or inverted. 
    - Set the price when the heating is always on.
    - Set the highest price when the heating will never turn on.
7. Name the script, for instance, "Heating 24h-Forecast," and save. However, avoid immediately clicking "Start" to prevent potential issues with Shelly that may occur if you initiate the start process too quickly.
8. Initiate Start once the saving process is complete.

## Configuring Script Parameters

1. Access the Shelly device web page: Navigate to Settings → Device Information → Device IP → click on the IP address. The Shelly device web page will open; on the left menu, select "<> Scripts."
2. Choose the script you wish to modify.
3. Scroll to the top of the script until you encounter "USER SETTINGS, START MODIFICATION."
4. Adjust parameters as per your specific requirements.

<img src="images/parameters.jpg" alt="Configure Parameters" width="750">

## How to Verify Script Execution

1. In Shelly app or web page, navigate to "Schedules".
2. Inspect the scheduled times when the Shelly will be activated.
3. Schedulers are organized based on the time.
4. Advanced users can inspect KVS storage: [Advanced → Key Value Storage → Script Data](#advanced--key-value-storage--script-data)

## How the Script Operates

1. Internet Connection: 
    * The script needs the internet to download daily electricity prices and weather forecasts.
2. Daily Operation:
    * It runs every day after 23:00 or as needed during the day to set up heating times.
3. Workflow:
    * The script follows a flowchart to determine the best heating hours based on market prices and weather forecasts.

```mermaid
flowchart TD
    0[Start loop] --> A
    A[Get Shelly time and location] --> K{Is weather forecast used?}
    K -- Yes --> B{Get weather forecast <br> from Open-Meteo.com API}
    B -- Succeeded </br>Calculate heating time --> D{Get electricity market price <br> from Elering API}
    K -- No --> D
    B -- Failed</br>Check again in 1 minute --> B
    D -- Succeeded</br>Calculate heating schedules --> L{Check, if market price and </br> forecast data is accurate}
    D -- Failed</br>Check again in 1 minute --> D
    L -- Yes</br>Check again in 1 minute --> L
    L -- No</br>Start the script --> 0
```

4. Watchdog workflow

```mermaid
flowchart TD
    0[Start heating script] --> A
    A[Create 'watchdog' script </br>with an event handler] --> K{Is heating script </br>stopped or deleted?}
    K -- Yes --> B[Find all this script schedules</br>and delete them]
```

# Troubleshooting

## Message "This schedule contains invalid call method or params"

Currently, in Shelly device web page, all schedules are labeled with the message "This schedule contains an invalid call method or params," and attempting to click on any schedule fails to open them.

This as a Shelly bug. It's important to note two key points regarding this issue:

1. All schedules are accessible and viewable without any problems through the Shelly cloud or mobile app. Therefore, there is no cause for concern about the integrity of the schedules or their functionality.
2. A temporary solution has been identified for accessing schedules through the device web page. By clicking on the schedule and then refreshing the page, users can successfully open the schedule.

<img src="images/InvalidSchedule.jpg" alt="Invalid Schedules" width="750">

## Message "Id3: #1 Scheduler at: 12:00 price: 185.91 EUR/MWh (energy price + transmission). FAILED, 20 schedulers is the Shelly limit."

The attempt to add a scheduler has failed due to the Shelly-imposed limit of 20 schedulers. This limit is applicable to the entire device, irrespective of the Shelly model, including multichannel devices such as the Pro4PM. 

> To address this limitation, we recommend utilizing the heating mode HEAT12H_FCST. This mode calculates schedules every twelve hours, enabling you to create up to 12 schedules within each twelve-hour cycle. This alternative mode ensures flexibility in scheduling while adhering to the device's limitations.

<img src="images/ScheduleLimit.jpg" alt="Invalid Schedules" width="750">

## Error "Couldn't get script"

There is an issue within the Shelly system that may affect your experience when attempting to open scripts through the Shelly cloud or mobile app. The encountered error, "Couldn't get script," is a known bug preventing the opening of scripts larger than 15kB via these platforms.

To navigate around this inconvenience, we suggest the following workarounds:

1. Open the Script Through Device Web Page:
Access the device web page to successfully open any script. This method provides a direct and reliable solution to view and manage your scripts seamlessly.

2. Alternative Solution Through Shelly Cloud:
If accessing the device web page is not feasible, follow these steps on the Shelly cloud:

   1. Delete the existing script.
   2. Create a new script.
   3. Copy and paste the entire script into the scripting window.
   4. Configure all necessary settings.
   5. Save and close the script.
   6. Run the script.

    If any issues arise during this process, you can repeat the workaround by starting from the script deletion step.

<img src="images/CouldntGetScript.jpg" alt="Couldn't get script." width="750">

## Advanced &rarr; Key Value Storage &rarr; Script Data

The script saves data in Shelly KVS (Key-Value-Storage) to preserve it in case of power outages or restarts.

To access the stored data on the Shelly device web page, navigate to **Advanced &rarr; KVS**.

1. Key: ``schedulerIDs1`` Value: ``[12,13,14,15,16,17,18,19,23,24]``
   
    The numeric values represent schedule ID numbers created by the script. This information is crucial for each script to identify and manage schedules associated with it. It aids in the proper deletion of outdated schedules when creating new ones is necessary.

2. Key: ``timestamp1`` Value: ``Wed Jan 3 2024 21:13:24 GMT+0200`` 
   
   This timestamp indicates the time when the script successfully retrieved market prices from Elering and created schedules. While this information is primarily for your reference, it offers insights into the timeline of script activities.

<img src="images/kvs.jpg" alt="Key Value Storage" width="750">
