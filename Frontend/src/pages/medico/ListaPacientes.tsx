import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Calendar, FileText, Search, User } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { DoctorLayout } from "@/components/layouts/DoctorLayout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import { appointmentsApi } from "@/lib/api/clinix-api";
import { getInitials, resolveAppointmentStatus } from "@/lib/api/domain";
import { formatDateLabel } from "@/lib/date-utils";
import { loadDirectoryUsers } from "@/lib/directory";

export default function ListaPacientes() {
  const navigate = useNavigate();
  const { session } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");

  const appointmentsQuery = useQuery({
    queryKey: ["appointments", "doctor", "patients"],
    queryFn: () => appointmentsApi.listDoctorAppointments(session!.token),
    enabled: Boolean(session?.token),
  });

  const patientsQuery = useQuery({
    queryKey: [
      "directory",
      "users",
      "doctor-patients",
      ...(appointmentsQuery.data ?? []).map((appointment) => appointment.patientId).sort(),
    ],
    queryFn: () =>
      loadDirectoryUsers(
        session!.token,
        (appointmentsQuery.data ?? []).map((appointment) => appointment.patientId),
      ),
    enabled: Boolean(session?.token && appointmentsQuery.data?.length),
  });

  const patients = useMemo(() => {
    const appointments = (appointmentsQuery.data ?? []).filter((appointment) => {
      const status = resolveAppointmentStatus(appointment.status);
      return status === "Accepted" || status === "Completed";
    });
    const patientEntries = Object.values(patientsQuery.data ?? {});

    return patientEntries.map((patient) => {
      const patientAppointments = appointments
        .filter((appointment) => appointment.patientId === patient.userId)
        .sort((left, right) => right.startTime.localeCompare(left.startTime));

      return {
        ...patient,
        totalAppointments: patientAppointments.length,
        latestAppointment: patientAppointments[0]?.startTime,
      };
    }).filter((patient) => patient.totalAppointments > 0);
  }, [appointmentsQuery.data, patientsQuery.data]);

  const filteredPatients = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();
    if (!normalizedSearch) {
      return patients;
    }

    return patients.filter((patient) => {
      return (
        patient.name.toLowerCase().includes(normalizedSearch) ||
        (patient.professionalRegister ?? "").toLowerCase().includes(normalizedSearch)
      );
    });
  }, [patients, searchTerm]);

  return (
    <DoctorLayout>
      <div className="animate-slide-up">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold">Pacientes</h1>
            <p className="text-muted-foreground">
              Pessoas com relacionamento de consulta no backend de agendamentos.
            </p>
          </div>

          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome..."
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {appointmentsQuery.isLoading ? (
          <Card className="p-12 text-center bg-secondary/30 border-dashed">
            <p className="text-muted-foreground">Carregando pacientes...</p>
          </Card>
        ) : filteredPatients.length > 0 ? (
          <div className="space-y-4">
            {filteredPatients.map((patient) => (
              <Card key={patient.userId} className="p-4 card-hover">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                      <span className="font-medium text-primary">
                        {getInitials(patient.name)}
                      </span>
                    </div>
                    <div>
                      <h3 className="font-medium">{patient.name}</h3>
                      <div className="flex flex-wrap gap-x-4 text-sm text-muted-foreground">
                        <span>{patient.totalAppointments} consulta(s)</span>
                        <span>{patient.latestAppointment ? formatDateLabel(patient.latestAppointment) : "Sem ultima consulta"}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 sm:gap-4">
                    <div className="text-sm text-muted-foreground flex items-center gap-1">
                      <Calendar className="w-4 h-4" />
                      <span className="hidden sm:inline">Ultima consulta:</span>
                      {patient.latestAppointment ? formatDateLabel(patient.latestAppointment, "d/MM/yyyy") : "—"}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => navigate(`/medico/prontuario/${patient.userId}`)}
                    >
                      <FileText className="w-4 h-4 mr-2" />
                      Prontuario
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="p-12 text-center">
            <User className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
            <p className="text-muted-foreground">Nenhum paciente encontrado.</p>
          </Card>
        )}
      </div>
    </DoctorLayout>
  );
}
