FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS base
USER app
WORKDIR /app
EXPOSE 8080

FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
ARG BUILD_CONFIGURATION=Release
WORKDIR /src
COPY ["Backend/ChatBotAPI/ChatBotAPI.csproj", "Backend/ChatBotAPI/"]
COPY ["Backend/Shared/Shared.csproj", "Backend/Shared/"]
RUN dotnet restore "Backend/ChatBotAPI/ChatBotAPI.csproj"
COPY Backend/ChatBotAPI/ Backend/ChatBotAPI/
COPY Backend/Shared/ Backend/Shared/
WORKDIR "/src/Backend/ChatBotAPI"
RUN dotnet build "ChatBotAPI.csproj" -c $BUILD_CONFIGURATION -o /app/build

FROM build AS publish
ARG BUILD_CONFIGURATION=Release
RUN dotnet publish "ChatBotAPI.csproj" -c $BUILD_CONFIGURATION -o /app/publish /p:UseAppHost=false

FROM base AS final
WORKDIR /app
COPY --from=publish /app/publish .
ENTRYPOINT ["dotnet", "ChatBotAPI.dll"]
