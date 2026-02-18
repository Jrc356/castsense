/**
 * Solar Calculation Module (T3.4)
 * 
 * Local computation of sunrise/sunset times, daylight phase, and season
 */

import SunCalc from 'suncalc';
import { SolarResult } from '../../types/enrichment';

/**
 * Daylight phase definitions
 */
type DaylightPhase = 'pre_dawn' | 'sunrise' | 'day' | 'golden_hour' | 'sunset' | 'after_sunset' | 'night';

/**
 * Season definitions
 */
type Season = 'winter' | 'spring' | 'summer' | 'fall';

/**
 * Format time as HH:MM in local timezone
 */
function formatTimeLocal(date: Date, timezone: string): string {
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: timezone
    });
    return formatter.format(date);
  } catch {
    // Fallback if timezone is invalid
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  }
}

/**
 * Get the current hour in the given timezone
 */
function getHourInTimezone(date: Date, timezone: string): number {
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      hour12: false,
      timeZone: timezone
    });
    return parseInt(formatter.format(date), 10);
  } catch {
    return date.getHours();
  }
}

/**
 * Determine the daylight phase based on current time and sun positions
 * 
 * Phases:
 * - pre_dawn: After midnight, before civil dawn
 * - sunrise: Civil dawn to 30 min after sunrise
 * - day: After sunrise window, before golden hour
 * - golden_hour: ~1 hour before sunset
 * - sunset: Around sunset (30 min before to 30 min after)
 * - after_sunset: 30 min after sunset to civil dusk
 * - night: After civil dusk until midnight
 */
function determineDaylightPhase(
  timestamp: Date,
  sunTimes: SunCalc.GetTimesResult
): DaylightPhase {
  const now = timestamp.getTime();
  
  // Get key sun times
  const sunrise = sunTimes.sunrise?.getTime() || 0;
  const sunset = sunTimes.sunset?.getTime() || 0;
  const dawn = sunTimes.dawn?.getTime() || 0;
  const dusk = sunTimes.dusk?.getTime() || 0;
  const goldenHourStart = sunTimes.goldenHour?.getTime() || 0;
  const goldenHourEnd = sunTimes.goldenHourEnd?.getTime() || 0;

  // Handle invalid/missing times
  if (!sunrise || !sunset) {
    // Polar day/night - approximate based on time
    const hour = timestamp.getHours();
    if (hour >= 6 && hour < 18) return 'day';
    return 'night';
  }

  // Define time windows (30 minutes in ms)
  const thirtyMinutes = 30 * 60 * 1000;

  // Check phases in order
  if (now < dawn) {
    return 'pre_dawn';
  }
  
  if (now < sunrise + thirtyMinutes) {
    return 'sunrise';
  }
  
  // Morning golden hour (around sunrise)
  if (goldenHourEnd && now < goldenHourEnd) {
    return 'day'; // Treat morning golden hour as day for simplicity
  }
  
  // Evening golden hour
  if (goldenHourStart && now >= goldenHourStart && now < sunset - thirtyMinutes) {
    return 'golden_hour';
  }
  
  // Sunset window
  if (now >= sunset - thirtyMinutes && now < sunset + thirtyMinutes) {
    return 'sunset';
  }
  
  // After sunset but before dusk
  if (now >= sunset + thirtyMinutes && now < dusk) {
    return 'after_sunset';
  }
  
  // Night
  if (now >= dusk) {
    return 'night';
  }
  
  // Default to day if between sunrise and golden hour
  return 'day';
}

/**
 * Determine season based on latitude and month
 * 
 * Northern hemisphere:
 * - Winter: Dec, Jan, Feb
 * - Spring: Mar, Apr, May
 * - Summer: Jun, Jul, Aug
 * - Fall: Sep, Oct, Nov
 * 
 * Southern hemisphere: opposite
 */
function determineSeason(lat: number, timestamp: Date, timezone: string): Season {
  // Get month in the local timezone
  let month: number;
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      month: 'numeric',
      timeZone: timezone
    });
    month = parseInt(formatter.format(timestamp), 10);
  } catch {
    month = timestamp.getMonth() + 1;
  }

  // Northern hemisphere seasons
  const northernSeasons: Record<number, Season> = {
    12: 'winter', 1: 'winter', 2: 'winter',
    3: 'spring', 4: 'spring', 5: 'spring',
    6: 'summer', 7: 'summer', 8: 'summer',
    9: 'fall', 10: 'fall', 11: 'fall'
  };

  // Southern hemisphere - flip seasons
  const southernSeasons: Record<number, Season> = {
    12: 'summer', 1: 'summer', 2: 'summer',
    3: 'fall', 4: 'fall', 5: 'fall',
    6: 'winter', 7: 'winter', 8: 'winter',
    9: 'spring', 10: 'spring', 11: 'spring'
  };

  // Use latitude to determine hemisphere
  if (lat >= 0) {
    return northernSeasons[month] || 'spring';
  } else {
    return southernSeasons[month] || 'fall';
  }
}

/**
 * Calculate solar data for a location and time
 * 
 * @param lat - Latitude in decimal degrees
 * @param lon - Longitude in decimal degrees
 * @param timestamp - The timestamp for calculations
 * @param timezone - IANA timezone identifier (e.g., 'America/Chicago')
 * @returns Solar calculation result
 */
export function calculateSolar(
  lat: number,
  lon: number,
  timestamp: Date,
  timezone: string
): SolarResult {
  // Get sun times from suncalc
  const sunTimes = SunCalc.getTimes(timestamp, lat, lon);

  // Format sunrise and sunset in local time
  const sunrise = sunTimes.sunrise;
  const sunset = sunTimes.sunset;

  const sunriseLocal = sunrise ? formatTimeLocal(sunrise, timezone) : '00:00';
  const sunsetLocal = sunset ? formatTimeLocal(sunset, timezone) : '23:59';

  // Determine current daylight phase
  const daylightPhase = determineDaylightPhase(timestamp, sunTimes);

  // Determine season
  const season = determineSeason(lat, timestamp, timezone);

  return {
    sunrise_local: sunriseLocal,
    sunset_local: sunsetLocal,
    daylight_phase: daylightPhase,
    season
  };
}

export default calculateSolar;
