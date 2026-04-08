import { DirectoryUser, DoctorDirectoryItem } from "./api/contracts";
import { usersApi } from "./api/clinix-api";

export async function loadDirectoryUsers(token: string, userIds: string[]) {
  const uniqueIds = Array.from(new Set(userIds.filter(Boolean)));
  const users = await Promise.all(
    uniqueIds.map(async (userId) => {
      const user = await usersApi.getDirectoryUser(token, userId);
      return [userId, user] as const;
    }),
  );

  return Object.fromEntries(users) as Record<string, DirectoryUser>;
}

export function buildSpecialties(doctors: DoctorDirectoryItem[]) {
  return Array.from(
    new Set(doctors.flatMap((doctor) => doctor.specialties).filter(Boolean)),
  ).sort((left, right) => left.localeCompare(right, "pt-BR"));
}
