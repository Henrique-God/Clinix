#See https://aka.ms/customizecontainer to learn how to customize your debug container and how Visual Studio uses this Dockerfile to build your images for faster debugging.

FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS base
USER app
WORKDIR /app
EXPOSE 8080
EXPOSE 8081

# Estágio de build do Frontend
FROM node:20-slim AS frontend-build
WORKDIR /src/frontend
COPY Frontend/package*.json ./
RUN npm install --loglevel=error
COPY Frontend/ ./
RUN npm run build


FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
ARG BUILD_CONFIGURATION=Release
WORKDIR /src
COPY ["Backend/Clinix.csproj", "Backend/"]
RUN dotnet restore "./Backend/Clinix.csproj"
COPY Backend/ Backend/
WORKDIR "/src/Backend"
RUN dotnet build "./Clinix.csproj" -c $BUILD_CONFIGURATION -o /app/build

FROM build AS publish
ARG BUILD_CONFIGURATION=Release
RUN dotnet publish "./Clinix.csproj" -c $BUILD_CONFIGURATION -o /app/publish /p:UseAppHost=false

FROM base AS final
WORKDIR /app
COPY --from=publish /app/publish .

COPY --from=frontend-build /src/frontend/dist ./wwwroot
ENTRYPOINT ["dotnet", "Clinix.dll"]