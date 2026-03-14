let CONFIG = {
  SWITCH_ID: 0,

  MAX_PRICE: 0.22,
  MIN_PRICE: 0.40,

  INTERVAL: 4,
  USAGE_TYPE: 1,
  INCL_BTW: false,

  MAX_SCHEDULES: 18
};

let KVS_URL_KEY = "energyzero_last_url";
let KVS_SCHEDULE_KEY = "energyzero_last_schedule";

function isDST(date) {
  let jan = new Date(date.getFullYear(), 0, 1).getTimezoneOffset();
  let jul = new Date(date.getFullYear(), 6, 1).getTimezoneOffset();
  return Math.min(jan, jul) !== date.getTimezoneOffset();
}

function getNLOffsetHours() {
  let now = new Date();
  return isDST(now) ? 2 : 1;
}

function buildEnergyZeroURL() {

  let now = new Date();

  let start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 23, 0, 0);
  let end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 22, 0, 0);

  let fromISO = start.toISOString();
  let tillISO = end.toISOString();

  let url =
    "https://api.energyzero.nl/v1/energyprices?" +
    "fromDate=" + fromISO +
    "&tillDate=" + tillISO +
    "&interval=" + CONFIG.INTERVAL +
    "&usageType=" + CONFIG.USAGE_TYPE +
    "&inclBtw=" + CONFIG.INCL_BTW;

  Shelly.call("KVS.Set", {
    key: KVS_URL_KEY,
    value: url
  });

  return url;
}

function fetchPrices(retry) {

  if (!retry) retry = 0;

  let url = buildEnergyZeroURL();

  print("Fetching prices from EnergyZero");

  Shelly.call(
    "HTTP.GET",
    { url: url },
    function (res, err) {

      if (err !== 0) {

        if (retry < 3) {
          print("Retry HTTP", retry);
          Timer.set(5000, false, function () {
            fetchPrices(retry + 1);
          });
        }

        return;
      }

      let data = JSON.parse(res.body);
      processPrices(data);

    }
  );
}

function processPrices(data) {

  let prices = data.Prices || data.prices;

  if (!prices) {
    print("No prices found");
    return;
  }

  let offset = getNLOffsetHours();

  let hours = [];

  for (let i = 0; i < prices.length; i++) {

    let p = prices[i];

    let price = p.price || p.Price;

    let utc = new Date(p.readingDate || p.timestamp);
    let local = new Date(utc.getTime() + offset * 3600000);

    let hour = local.getHours();

    if (price <= CONFIG.MAX_PRICE) {
      hours.push(hour);
    }

  }

  hours.sort();

  let blocks = mergeHours(hours);

  createSchedules(blocks);
}

function mergeHours(hours) {

  let blocks = [];

  if (hours.length === 0)
    return blocks;

  let start = hours[0];
  let prev = hours[0];

  for (let i = 1; i < hours.length; i++) {

    if (hours[i] === prev + 1) {
      prev = hours[i];
      continue;
    }

    blocks.push({start: start, end: prev});
    start = hours[i];
    prev = hours[i];

  }

  blocks.push({start: start, end: prev});

  return blocks;
}

function clearSchedules(callback) {

  Shelly.call("Schedule.List", {}, function (res) {

    if (!res.jobs) {
      callback();
      return;
    }

    let jobs = res.jobs;

    function deleteNext(i) {

      if (i >= jobs.length) {
        callback();
        return;
      }

      Shelly.call(
        "Schedule.Delete",
        { id: jobs[i].id },
        function () {
          deleteNext(i + 1);
        }
      );
    }

    deleteNext(0);

  });
}

function createSchedules(blocks) {

  if (blocks.length * 2 > CONFIG.MAX_SCHEDULES) {
    print("Too many schedules, trimming");
    blocks = blocks.slice(0, Math.floor(CONFIG.MAX_SCHEDULES / 2));
  }

  clearSchedules(function () {

    let scheduleMeta = [];

    for (let i = 0; i < blocks.length; i++) {

      let b = blocks[i];

      let onHour = b.start;
      let offHour = b.end + 1;

      createSchedule(onHour, 0, true);
      createSchedule(offHour, 0, false);

      scheduleMeta.push({
        on: onHour,
        off: offHour
      });

    }

    Shelly.call("KVS.Set", {
      key: KVS_SCHEDULE_KEY,
      value: JSON.stringify(scheduleMeta)
    });

  });

}

function createSchedule(hour, minute, state) {

  Shelly.call(
    "Schedule.Create",
    {
      enable: true,
      timespec: "0 " + minute + " " + hour + " * * *",
      calls: [{
        method: "Switch.Set",
        params: {
          id: CONFIG.SWITCH_ID,
          on: state
        }
      }]
    }
  );
}

function runDaily() {

  fetchPrices();

}

Timer.set(
  24 * 60 * 60 * 1000,
  true,
  runDaily
);

runDaily();
