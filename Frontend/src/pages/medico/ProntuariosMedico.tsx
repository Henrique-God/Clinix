import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FileText, Search, ShieldCheck, UserRound } from "lucide-react";
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

export default function ProntuariosMedico() {
  const navigate = useNavigate();
  const { session } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");

  const appointmentsQuery = useQuery({
    queryKey: ["appointments", "doctor", "clinical-records"],
    queryFn: () => appointmentsApi.listDoctorAppointments(session!.token),
    enabled: Boolean(session?.token),
  });

  const patientsQuery = useQuery({
    queryKey: [
      "directory",
      "users",
      "doctor-clinical-records",
      ...(appointmentsQuery.data ?? []).map((appointment) => appointment.patientId).sort(),
    ],
    queryFn: () =>
      loadDirectoryUsers(
        session!.token,
        (appointmentsQuery.data ?? []).map((appointment) => appointment.patientId),
      ),
    enabled: Boolean(session?.token && appointmentsQuery.data?.length),
  });

  const records = useMemo(() => {
    return Object.values(patientsQuery.data ?? {}).map((patient) => {
      const patientAppointments = (appointmentsQuery.data ?? []).filter((appointment) => {
        const status = resolveAppointmentStatus(appointment.status);
        return (
          appointment.patientId === patient.userId &&
          (status === "Accepted" || status === "Completed")
        );
      });
      const completedCount = patientAppointments.filter(
        (appointment) => resolveAppointmentStatus(appointment.status) === "Completed",
      ).length;
      const latestAppointment = patientAppointments
        .map((appointment) => appointment.startTime)
        .sort((left, right) => right.localeCompare(left))[0];

      return {
        ...patient,
        completedCount,
        latestAppointment,
      };
    }).filter((record) => record.completedCount > 0 || Boolean(record.latestAppointment));
  }, [appointmentsQuery.data, patientsQuery.data]);

  const filteredRecords = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();
    if (!normalizedSearch) {
      return records;
    }

    return records.filter((record) => record.name.toLowerCase().includes(normalizedSearch));
  }, [records, searchTerm]);

  return (
    <DoctorLayout>
      <div className="animate-slide-up space-y-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-2xl font-bold">Prontuários</h1>
            <p className="text-muted-foreground">
              Acesse os históricos clínicos dos pacientes relacionados ao seu atendimento.
            </p>
          </div>

          <div className="relative w-full lg:w-80">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              className="pl-10"
              placeholder="Buscar prontuário por paciente..."
            />
          </div>
        </div>

        {appointmentsQuery.isLoading ? (
          <Card className="p-12 text-center bg-secondary/30 border-dashed">
            <p className="text-muted-foreground">Carregando prontuários disponíveis...</p>
          </Card>
        ) : filteredRecords.length > 0 ? (
          <div className="grid gap-4 xl:grid-cols-2">
            {filteredRecords.map((record) => (
              <Card key={record.userId} className="p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex gap-4">
                    <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
                      <span className="font-semibold text-primary">
                        {getInitials(record.name)}
                      </span>
                    </div>
                    <div className="space-y-2">
                      <div>
                        <h2 className="font-semibold">{record.name}</h2>
                        <p className="text-sm text-muted-foreground">
                          Último atendimento:{" "}
                          {record.latestAppointment
                            ? formatDateLabel(record.latestAppointment)
                            : "Sem registro"}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                        <span className="status-badge bg-primary/10 text-primary">
                          {record.completedCount} consulta(s) concluídas
                        </span>
                        <span className="status-badge bg-secondary text-foreground">
                          Histórico Clinix
                        </span>
                      </div>
                    </div>
                  </div>
                  <ShieldCheck className="h-5 w-5 text-primary" />
                </div>

                <div className="mt-5 flex justify-end">
                  <Button onClick={() => navigate(`/medico/prontuario/${record.userId}`)}>
                    <FileText className="mr-2 h-4 w-4" />
                    Abrir prontuário
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="p-12 text-center">
            <UserRound className="mx-auto mb-4 h-12 w-12 text-muted-foreground opacity-50" />
            <p className="font-medium">Nenhum prontuário disponível</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Os prontuários aparecem aqui quando houver relacionamento clínico e permissão ativa.
            </p>
          </Card>
        )}
      </div>
    </DoctorLayout>
  );
}
