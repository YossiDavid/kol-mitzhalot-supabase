/** Parse YYYY-MM-DD as local calendar date (avoids UTC off-by-one). */
function parseBirthDate(birthDate: string | Date): {
  year: number;
  month: number;
  day: number;
} {
  if (typeof birthDate === "string") {
    const iso = birthDate.trim().slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
      const [y, m, d] = iso.split("-").map(Number);
      return { year: y, month: m - 1, day: d };
    }
  }
  const birth = new Date(birthDate);
  return {
    year: birth.getFullYear(),
    month: birth.getMonth(),
    day: birth.getDate(),
  };
}

export default function calculateAge(birthDate: string | Date): string {
  const birth = parseBirthDate(birthDate);
  const now = new Date();

  let age = now.getFullYear() - birth.year;
  const monthDiff = now.getMonth() - birth.month;

  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birth.day)) {
    age--;
  }

  return String(age);
}
