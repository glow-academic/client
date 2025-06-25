/**
 * RTC utils
 */

export const getIceConfig = async () => {
  const response = await fetch("/rtc/ice");
  return response.json();
};