import { differenceInMinutes, format, getDay, isAfter, isBefore, parseISO } from 'date-fns';

interface OvertimeCalculation {
  totalHours: number;
  regularHours: number;
  overtimeHours: number;
  nightHours: number;
  holidayHours: number;
  breakfastDeduction: number;
  lunchDeduction: number;
}

const HOLIDAYS: string[] = [];

export const isHoliday = (date: Date): boolean => {
  const dateString = format(date, 'yyyy-MM-dd');
  return HOLIDAYS.includes(dateString);
};

export const calculateOperationHours = (
  checkInTime: string,
  checkOutTime: string
): OvertimeCalculation => {
  const checkIn = parseISO(checkInTime);
  const checkOut = parseISO(checkOutTime);

  const dayOfWeek = getDay(checkIn);
  const checkInHour = checkIn.getHours();
  const checkInMinute = checkIn.getMinutes();

  const totalMinutes = differenceInMinutes(checkOut, checkIn);
  let workMinutes = totalMinutes;

  let breakfastDeduction = 0;
  let lunchDeduction = 0;

  if (checkInHour < 6) {
    breakfastDeduction = 60;
  } else if (checkInHour === 6 && checkInMinute === 0) {
    breakfastDeduction = 60;
  }

  if (dayOfWeek === 0) {
    lunchDeduction = 60;
  }

  workMinutes -= breakfastDeduction;
  workMinutes -= lunchDeduction;

  let regularMinutes = 0;
  let overtimeMinutes = 0;
  let nightMinutes = 0;
  let holidayMinutes = 0;

  if (isHoliday(checkIn) || dayOfWeek === 0) {
    holidayMinutes = workMinutes;
  } else {
    let standardMinutes = 0;

    if (dayOfWeek >= 1 && dayOfWeek <= 4) {
      standardMinutes = 9.5 * 60;
    } else if (dayOfWeek === 5) {
      standardMinutes = 8 * 60;
    } else if (dayOfWeek === 6) {
      standardMinutes = 3 * 60;
    }

    if (workMinutes <= standardMinutes) {
      regularMinutes = workMinutes;
    } else {
      regularMinutes = standardMinutes;
      overtimeMinutes = workMinutes - standardMinutes;
    }

    let currentTime = new Date(checkIn);
    const endTime = new Date(checkOut);

    while (currentTime < endTime) {
      const hour = currentTime.getHours();

      if (hour >= 21 || hour < 6) {
        nightMinutes += 1;
        if (regularMinutes > 0) {
          regularMinutes -= 1;
        } else if (overtimeMinutes > 0) {
          overtimeMinutes -= 1;
        }
      }

      currentTime = new Date(currentTime.getTime() + 60000);
    }
  }

  const regularHours = regularMinutes / 60;
  const overtimeHours = overtimeMinutes / 60;
  const nightHours = (nightMinutes / 60) * 1.35;
  const holidayHours = (holidayMinutes / 60) * 1.75;

  return {
    totalHours: workMinutes / 60,
    regularHours: Number(regularHours.toFixed(2)),
    overtimeHours: Number(overtimeHours.toFixed(2)),
    nightHours: Number(nightHours.toFixed(2)),
    holidayHours: Number(holidayHours.toFixed(2)),
    breakfastDeduction: breakfastDeduction / 60,
    lunchDeduction: lunchDeduction / 60,
  };
};
