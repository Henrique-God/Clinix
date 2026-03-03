FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS base
USER app
WORKDIR /app
EXPOSE 8080

FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
ARG BUILD_CONFIGURATION=Release
WORKDIR /src
COPY ["Backend/AppointmentsAPI/AppointmentsAPI.csproj", "Backend/AppointmentsAPI/"]
COPY ["Backend/Shared/Shared.csproj", "Backend/Shared/"]
RUN dotnet restore "Backend/AppointmentsAPI/AppointmentsAPI.csproj"
COPY Backend/AppointmentsAPI/ Backend/AppointmentsAPI/
COPY Backend/Shared/ Backend/Shared/
WORKDIR "/src/Backend/AppointmentsAPI"
RUN dotnet build "AppointmentsAPI.csproj" -c $BUILD_CONFIGURATION -o /app/build

FROM build AS publish
ARG BUILD_CONFIGURATION=Release
RUN dotnet publish "AppointmentsAPI.csproj" -c $BUILD_CONFIGURATION -o /app/publish /p:UseAppHost=false

FROM base AS final
WORKDIR /app
COPY --from=publish /app/publish .
ENTRYPOINT ["dotnet", "AppointmentsAPI.dll"]
