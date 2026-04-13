import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Activity, Filter, Link2, Link2Off, Loader2, RefreshCw, X } from "lucide-react";
import { PatientLayout } from "@/components/layouts/PatientLayout";
import { PremiumFeatureGate } from "@/components/premium/PremiumFeatureGate";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { stravaApi } from "@/lib/api/clinix-api";
import {
  formatDistance,
  formatDuration,
  StravaActivityResponse,
} from "@/lib/api/domain";

export default function StravaIntegration() {
  return (
    <PatientLayout>
      <PremiumFeatureGate featureName="integracao com Strava">
        <StravaContent />
      </PremiumFeatureGate>
    </PatientLayout>
  );
}

function StravaContent() {
  const { session } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();

  const code = searchParams.get("code");

  const connectionQuery = useQuery({
    queryKey: ["strava", "connection"],
    queryFn: () => stravaApi.getConnection(session!.token),
    enabled: Boolean(session?.token),
  });

  const activitiesQuery = useQuery({
    queryKey: ["strava", "activities"],
    queryFn: () => stravaApi.listActivities(session!.token, 1, 200),
    enabled: Boolean(session?.token && connectionQuery.data?.connected),
  });

  const callbackMutation = useMutation({
    mutationFn: (authCode: string) => stravaApi.callback(session!.token, authCode),
    onSuccess: () => {
      toast({ title: "Strava conectado com sucesso!" });
      queryClient.invalidateQueries({ queryKey: ["strava"] });
      setSearchParams({});
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao conectar", description: error.message, variant: "destructive" });
      setSearchParams({});
    },
  });

  const connectMutation = useMutation({
    mutationFn: () => stravaApi.getAuthUrl(session!.token),
    onSuccess: (data) => {
      window.location.href = data.authorizationUrl;
    },
    onError: (error: Error) => {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    },
  });

  const syncMutation = useMutation({
    mutationFn: () => stravaApi.sync(session!.token),
    onSuccess: (data) => {
      toast({ title: `${data.activitiesSynced} atividade(s) sincronizada(s).` });
      queryClient.invalidateQueries({ queryKey: ["strava", "activities"] });
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao sincronizar", description: error.message, variant: "destructive" });
    },
  });

  const disconnectMutation = useMutation({
    mutationFn: () => stravaApi.disconnect(session!.token),
    onSuccess: () => {
      toast({ title: "Strava desconectado." });
      queryClient.invalidateQueries({ queryKey: ["strava"] });
    },
    onError: (error: Error) => {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    },
  });

  useEffect(() => {
    if (code && !callbackMutation.isPending && !callbackMutation.isSuccess) {
      callbackMutation.mutate(code);
    }
  }, [code]);

  const [typeFilter, setTypeFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const isConnected = connectionQuery.data?.connected === true;
  const activities = activitiesQuery.data ?? [];

  const activityTypes = useMemo(() => {
    const types = new Set(activities.map((a: StravaActivityResponse) => a.type));
    return Array.from(types).sort();
  }, [activities]);

  const filteredActivities = useMemo(() => {
    return activities.filter((a: StravaActivityResponse) => {
      if (typeFilter !== "all" && a.type !== typeFilter) return false;
      const actDate = new Date(a.startDate);
      if (dateFrom) {
        const from = new Date(dateFrom);
        if (actDate < from) return false;
      }
      if (dateTo) {
        const to = new Date(dateTo);
        to.setHours(23, 59, 59, 999);
        if (actDate > to) return false;
      }
      return true;
    });
  }, [activities, typeFilter, dateFrom, dateTo]);

  const hasActiveFilters = typeFilter !== "all" || dateFrom !== "" || dateTo !== "";

  function clearFilters() {
    setTypeFilter("all");
    setDateFrom("");
    setDateTo("");
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Strava</h1>
        <p className="text-muted-foreground">
          Integre suas atividades fisicas para acompanhamento profissional
        </p>
      </div>

      {connectionQuery.isLoading && (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {!connectionQuery.isLoading && !isConnected && (
        <Card className="p-8 text-center space-y-4">
          <div className="mx-auto w-16 h-16 rounded-full bg-orange-500/10 flex items-center justify-center">
            <Activity className="w-8 h-8 text-orange-500" />
          </div>
          <h3 className="text-lg font-medium">Conecte sua conta Strava</h3>
          <p className="text-muted-foreground max-w-md mx-auto">
            Ao conectar o Strava, suas atividades fisicas serao sincronizadas
            automaticamente, permitindo que profissionais de saude acompanhem
            seu desempenho.
          </p>
          <Button
            onClick={() => connectMutation.mutate()}
            disabled={connectMutation.isPending}
            className="gap-2 bg-orange-500 hover:bg-orange-600"
          >
            {connectMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Link2 className="w-4 h-4" />
            )}
            Conectar com Strava
          </Button>
        </Card>
      )}

      {!connectionQuery.isLoading && isConnected && (
        <>
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-orange-500/10 flex items-center justify-center">
                  <Activity className="w-5 h-5 text-orange-500" />
                </div>
                <div>
                  <p className="font-medium">Strava conectado</p>
                  <p className="text-xs text-muted-foreground">
                    Atleta #{connectionQuery.data?.connection?.stravaAthleteId}
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => syncMutation.mutate()}
                  disabled={syncMutation.isPending}
                  className="gap-2"
                >
                  {syncMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <RefreshCw className="w-4 h-4" />
                  )}
                  Sincronizar
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => disconnectMutation.mutate()}
                  disabled={disconnectMutation.isPending}
                  className="gap-2 text-destructive"
                >
                  <Link2Off className="w-4 h-4" />
                  Desconectar
                </Button>
              </div>
            </div>
          </Card>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">
                Atividades ({filteredActivities.length})
              </h2>
            </div>

            {activities.length > 0 && (
              <Card className="p-4">
                <div className="flex flex-wrap gap-3 items-end">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                      <Filter className="w-3 h-3" /> Tipo
                    </label>
                    <Select value={typeFilter} onValueChange={setTypeFilter}>
                      <SelectTrigger className="w-[160px]">
                        <SelectValue placeholder="Todos" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos</SelectItem>
                        {activityTypes.map((t) => (
                          <SelectItem key={t} value={t}>{t}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">De</label>
                    <Input
                      type="date"
                      className="w-[160px]"
                      value={dateFrom}
                      onChange={(e) => setDateFrom(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">Ate</label>
                    <Input
                      type="date"
                      className="w-[160px]"
                      value={dateTo}
                      onChange={(e) => setDateTo(e.target.value)}
                    />
                  </div>
                  {hasActiveFilters && (
                    <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-1">
                      <X className="w-3 h-3" /> Limpar
                    </Button>
                  )}
                </div>
              </Card>
            )}

            {activitiesQuery.isLoading && (
              <div className="flex justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            )}

            {!activitiesQuery.isLoading && activities.length === 0 && (
              <Card className="p-8 text-center">
                <Activity className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
                <p className="text-muted-foreground">
                  Nenhuma atividade sincronizada. Clique em "Sincronizar" para buscar suas atividades.
                </p>
              </Card>
            )}

            {!activitiesQuery.isLoading && activities.length > 0 && filteredActivities.length === 0 && (
              <Card className="p-8 text-center">
                <Filter className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
                <p className="text-muted-foreground">
                  Nenhuma atividade corresponde aos filtros selecionados.
                </p>
              </Card>
            )}

            <div className="space-y-2">
              {filteredActivities.map((activity: StravaActivityResponse) => (
                <Card key={activity.id} className="p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="font-medium">{activity.name}</h4>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {activity.type} &middot;{" "}
                        {new Date(activity.startDate).toLocaleDateString("pt-BR", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3">
                    <div>
                      <p className="text-xs text-muted-foreground">Distancia</p>
                      <p className="text-sm font-medium">{formatDistance(activity.distanceMeters)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Tempo</p>
                      <p className="text-sm font-medium">{formatDuration(activity.movingTimeSeconds)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Elevacao</p>
                      <p className="text-sm font-medium">{Math.round(activity.totalElevationGain)} m</p>
                    </div>
                    {activity.averageHeartRate != null && (
                      <div>
                        <p className="text-xs text-muted-foreground">FC media</p>
                        <p className="text-sm font-medium">{Math.round(activity.averageHeartRate)} bpm</p>
                      </div>
                    )}
                    {activity.calories != null && activity.averageHeartRate == null && (
                      <div>
                        <p className="text-xs text-muted-foreground">Calorias</p>
                        <p className="text-sm font-medium">{Math.round(activity.calories)} kcal</p>
                      </div>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
