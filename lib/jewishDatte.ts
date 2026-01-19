import { formatJewishDateInHebrew, toJewishDate } from "jewish-date";

export function jewishDateHebrew(date: string | Date) {
  const jewishDate = toJewishDate(new Date(date));

  return formatJewishDateInHebrew(jewishDate);
}
