import { BiometricAttendanceType, VerifyMethod } from "../../generated/prisma/client";

export interface AttendanceEvent {
  biometricId: string;
  attendanceTime: Date;
  type: BiometricAttendanceType;
  verifyMethod: VerifyMethod;
}

/**
 * Parses ZKTeco ADMS plain-text raw payload into AttendanceEvent objects.
 * Format: UserPIN\tTime\tStatus\tVerify_Type\tWorkCode\tReserved
 * Example: 1001\t2026-08-03 10:12:44\t0\t1\t0\t0
 */
export const parseZKTecoPayload = (payload: string): AttendanceEvent[] => {
  const lines = payload.split(/\r?\n/);
  const events: AttendanceEvent[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const parts = trimmed.split("\t");
    if (parts.length < 2) continue; // Minimum required: PIN and Time

    const biometricId = parts[0];
    const timeString = parts[1];
    
    // Default values if not provided
    let statusId = parts.length > 2 ? parseInt(parts[2], 10) : 0;
    let verifyId = parts.length > 3 ? parseInt(parts[3], 10) : 1;

    // Parse Time
    const attendanceTime = new Date(timeString.replace(" ", "T") + "Z"); // Assuming UTC or handling timezone if needed

    // Map Status to AttendanceType
    let type: BiometricAttendanceType = BiometricAttendanceType.CHECK_IN;
    if (statusId === 1 || statusId === 5) {
      type = BiometricAttendanceType.CHECK_OUT;
    }

    // Map Verify Type
    let verifyMethod: VerifyMethod = VerifyMethod.FINGERPRINT;
    if (verifyId === 15) verifyMethod = VerifyMethod.FACE;
    else if (verifyId === 4) verifyMethod = VerifyMethod.RFID;
    else if (verifyId === 3) verifyMethod = VerifyMethod.PASSWORD;

    events.push({
      biometricId,
      attendanceTime,
      type,
      verifyMethod,
    });
  }

  return events;
};
