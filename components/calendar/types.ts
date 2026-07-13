export type CalendarAppointment = {
  id: string;
  doctorId: string;
  doctorName: string;
  patientId: string;
  patientName: string;
  locationId: string | null;
  serviceId: string | null;
  serviceName: string | null;
  startsAt: string;
  endsAt: string;
  status:
    | "pending_confirmation"
    | "confirmed"
    | "completed"
    | "cancelled"
    | "no_show";
  notes: string | null;
};

export type WaitlistRow = {
  id: string;
  patientId: string;
  patientName: string;
  doctorId: string | null;
  serviceId: string | null;
  locationId: string | null;
  preferredFrom: string | null;
  preferredTo: string | null;
  notes: string | null;
  status: "waiting" | "offered" | "booked" | "cancelled";
  createdAt: string;
};
